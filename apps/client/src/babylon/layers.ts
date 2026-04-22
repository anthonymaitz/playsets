import { Scene, MeshBuilder, StandardMaterial, DynamicTexture, Mesh } from '@babylonjs/core'
import type { LayerBackground, LayerConfig } from '../types'

export const LAYER_HEIGHT = 1.6
const GROUND_SIZE = 1000
const LAYER_COUNT = 9

function makeBackgroundTexture(scene: Scene, bg: Exclude<LayerBackground, 'transparent'>, id: string): DynamicTexture {
  const SIZE = 128
  const dt = new DynamicTexture(`layer-tex-${bg}-${id}`, { width: SIZE, height: SIZE }, scene, false)
  const ctx = dt.getContext() as CanvasRenderingContext2D
  if (bg === 'grass') {
    ctx.fillStyle = '#2d5a1b'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.strokeStyle = '#4a7a40'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2)
  } else {
    // dirt
    ctx.fillStyle = '#5a3a1a'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.fillStyle = '#4a2e12'
    ctx.fillRect(10, 15, 20, 20)
    ctx.fillRect(50, 60, 25, 18)
    ctx.fillRect(90, 30, 18, 22)
    ctx.fillStyle = '#6b4520'
    ctx.fillRect(30, 80, 15, 15)
    ctx.fillRect(70, 100, 22, 12)
  }
  dt.update()
  return dt
}

function makeStarfieldTexture(scene: Scene): DynamicTexture {
  const SIZE = 128
  const dt = new DynamicTexture('layer-starfield', { width: SIZE, height: SIZE }, scene, false)
  const ctx = dt.getContext() as CanvasRenderingContext2D
  ctx.fillStyle = '#020008'
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(Math.random() * SIZE)
    const y = Math.floor(Math.random() * SIZE)
    const alpha = 0.4 + Math.random() * 0.6
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`
    ctx.fillRect(x, y, 1, 1)
  }
  dt.update()
  return dt
}

export class LayerBackgroundManager {
  private planes = new Map<number, Mesh>()
  private fallbackPlane: Mesh | null = null
  private configs: Record<number, LayerConfig>

  constructor(private scene: Scene, initialConfigs: Record<number, LayerConfig>) {
    this.configs = { ...initialConfigs }
    this._sync()
  }

  private layerY(layerIndex: number): number {
    return (layerIndex - 5) * LAYER_HEIGHT - 0.01
  }

  private _makePlane(layerIndex: number, bg: Exclude<LayerBackground, 'transparent'>): Mesh {
    const plane = MeshBuilder.CreateGround(
      `layer-bg-${layerIndex}`,
      { width: GROUND_SIZE, height: GROUND_SIZE },
      this.scene,
    )
    plane.position.y = this.layerY(layerIndex)
    plane.renderingGroupId = 0
    const mat = new StandardMaterial(`layer-mat-${layerIndex}`, this.scene)
    const tex = makeBackgroundTexture(this.scene, bg, String(layerIndex))
    mat.diffuseTexture = tex
    mat.emissiveTexture = tex
    plane.material = mat
    return plane
  }

  private _disposePlane(plane: Mesh): void {
    plane.material?.dispose()
    plane.dispose()
  }

  private _sync(): void {
    for (const plane of this.planes.values()) this._disposePlane(plane)
    this.planes.clear()
    if (this.fallbackPlane) { this._disposePlane(this.fallbackPlane); this.fallbackPlane = null }

    let anyOpaque = false
    for (let i = 1; i <= LAYER_COUNT; i++) {
      const cfg = this.configs[i] ?? { background: 'transparent', visible: true }
      if (cfg.background !== 'transparent') {
        anyOpaque = true
        const plane = this._makePlane(i, cfg.background)
        plane.isVisible = cfg.visible
        this.planes.set(i, plane)
      }
    }

    if (!anyOpaque) {
      const plane = MeshBuilder.CreateGround(
        'layer-fallback',
        { width: GROUND_SIZE, height: GROUND_SIZE },
        this.scene,
      )
      plane.position.y = this.layerY(1) - LAYER_HEIGHT
      plane.renderingGroupId = 0
      const mat = new StandardMaterial('layer-fallback-mat', this.scene)
      const tex = makeStarfieldTexture(this.scene)
      mat.diffuseTexture = tex
      mat.emissiveTexture = tex
      plane.material = mat
      this.fallbackPlane = plane
    }
  }

  updateLayer(layerIndex: number, patch: Partial<LayerConfig>): void {
    this.configs[layerIndex] = { ...this.configs[layerIndex], ...patch }
    this._sync()
  }

  loadConfigs(configs: Record<number, LayerConfig>): void {
    this.configs = { ...configs }
    this._sync()
  }

  setVisible(layerIndex: number, visible: boolean): void {
    const plane = this.planes.get(layerIndex)
    if (plane) plane.isVisible = visible
    this.configs[layerIndex] = { ...this.configs[layerIndex], visible }
  }

  dispose(): void {
    for (const plane of this.planes.values()) this._disposePlane(plane)
    this.planes.clear()
    if (this.fallbackPlane) { this._disposePlane(this.fallbackPlane); this.fallbackPlane = null }
  }
}
