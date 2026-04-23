import {
  Engine, Scene, ArcRotateCamera, HemisphericLight,
  Vector3, Color3, Color4, MeshBuilder, StandardMaterial,
  PointerEventTypes, type AbstractMesh,
} from '@babylonjs/core'

type Token = {
  x: number; y: number; type: string; id: string; isMe?: boolean
}

const COLORS: Record<string, Color3> = {
  player_me: new Color3(0.88, 0.33, 0.33),
  player:    new Color3(1.0,  0.60, 0.0),
  npc:       new Color3(0.29, 0.50, 0.76),
  door:      new Color3(0.30, 0.69, 0.31),
}

class PlaysetsBoardElement extends HTMLElement {
  private engine: Engine | null = null
  private scene: Scene | null = null

  static get observedAttributes() { return ['walls', 'tokens'] }

  connectedCallback() {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'width:100%;height:100%;display:block;'
    this.appendChild(canvas)
    this.initScene(canvas)
  }

  attributeChangedCallback(name: string, _old: string | null, newVal: string | null) {
    if (!this.scene) return
    if (name === 'walls') this.rebuildMap()
    if (name === 'tokens') this.syncTokens()
  }

  disconnectedCallback() {
    this.engine?.dispose()
    this.engine = null
    this.scene = null
  }

  private parseJSON<T>(attr: string, fallback: T): T {
    try { return JSON.parse(this.getAttribute(attr) ?? '') as T } catch { return fallback }
  }

  private initScene(canvas: HTMLCanvasElement) {
    const engine = new Engine(canvas, true)
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.1, 0.1, 0.12, 1)
    this.engine = engine
    this.scene = scene

    const walls = this.parseJSON<number[][]>('walls', [])
    const h = walls.length, w = walls[0]?.length ?? 0

    const camera = new ArcRotateCamera('cam', -Math.PI / 4, Math.PI / 3.5, Math.max(w, h) * 0.85, new Vector3((w - 1) / 2, 0, (h - 1) / 2), scene)
    // no attachControl — clicks go to tile picking

    new HemisphericLight('light', new Vector3(0, 1, 0), scene)

    this.buildMap(walls)
    this.syncTokens()

    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERDOWN) return
      const mesh = info.pickInfo?.pickedMesh
      if (!mesh?.name.startsWith('floor-')) return
      const [, xs, ys] = mesh.name.split('-')
      this.dispatchEvent(new CustomEvent('cellclick', {
        bubbles: true,
        detail: { x: parseInt(xs, 10), y: parseInt(ys, 10) },
      }))
    })

    engine.resize()
    engine.runRenderLoop(() => scene.render())
    new ResizeObserver(() => engine.resize()).observe(canvas)
  }

  private buildMap(walls: number[][]): void {
    if (!this.scene) return
    const fm = new StandardMaterial('floor-mat', this.scene)
    fm.diffuseColor = new Color3(0.83, 0.77, 0.63)
    const wm = new StandardMaterial('wall-mat', this.scene)
    wm.diffuseColor = new Color3(0.16, 0.16, 0.16)

    for (let y = 0; y < walls.length; y++) {
      for (let x = 0; x < walls[y].length; x++) {
        if (walls[y][x] === 1) {
          const m = MeshBuilder.CreateBox(`wall-${x}-${y}`, { width: 1, height: 0.6, depth: 1 }, this.scene)
          m.position = new Vector3(x, 0.3, y)
          m.material = wm; m.isPickable = false
        } else {
          const m = MeshBuilder.CreateBox(`floor-${x}-${y}`, { width: 0.97, height: 0.1, depth: 0.97 }, this.scene)
          m.position = new Vector3(x, 0, y)
          m.material = fm
        }
      }
    }
  }

  private rebuildMap(): void {
    const walls = this.parseJSON<number[][]>('walls', [])
    this.scene?.meshes.slice().forEach((m: AbstractMesh) => {
      if (m.name.startsWith('floor-') || m.name.startsWith('wall-')) m.dispose()
    })
    this.buildMap(walls)
    // Reposition camera — walls arrive reactively after initScene, so radius was 0
    const camera = this.scene?.activeCamera as ArcRotateCamera | null
    if (camera && walls.length > 0) {
      const h = walls.length, w = walls[0]?.length ?? 0
      camera.target = new Vector3((w - 1) / 2, 0, (h - 1) / 2)
      camera.radius = Math.max(w, h) * 0.85
    }
  }

  private syncTokens(): void {
    if (!this.scene) return
    const tokens = this.parseJSON<Token[]>('tokens', [])
    const seen = new Set<string>()

    for (const t of tokens) {
      const id = `token-${t.id}`
      seen.add(id)
      let mesh = this.scene.getMeshByName(id)
      if (!mesh) {
        mesh = MeshBuilder.CreateCylinder(id, { diameter: 0.6, height: 0.7, tessellation: 12 }, this.scene)
        mesh.isPickable = false
        const mat = new StandardMaterial(`mat-${id}`, this.scene)
        const key = t.type === 'player' && t.isMe ? 'player_me' : t.type
        mat.diffuseColor = COLORS[key] ?? COLORS.npc
        mesh.material = mat
      }
      mesh.position = new Vector3(t.x, 0.45, t.y)
    }

    for (const m of this.scene.meshes) {
      if (m.name.startsWith('token-') && !seen.has(m.name)) m.dispose()
    }
  }
}

if (!customElements.get('playsets-board')) {
  customElements.define('playsets-board', PlaysetsBoardElement)
}