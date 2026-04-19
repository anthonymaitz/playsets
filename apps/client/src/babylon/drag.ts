import {
  Scene,
  PointerEventTypes,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  Vector3,
  Observer,
} from '@babylonjs/core'
import type { PointerInfo, ArcRotateCamera } from '@babylonjs/core'
import { SpriteManager } from './sprites'
import { worldToCell, cellToWorld } from './grid'

export interface DragCallbacks {
  onDragMove: (instanceId: string, col: number, row: number) => void
  onDragDrop: (instanceId: string, col: number, row: number) => void
  onSpriteClick: (instanceId: string) => void
  canDrop?: (col: number, row: number) => boolean
}

export class DragController {
  private dragging: {
    instanceId: string
    originalCol: number
    originalRow: number
  } | null = null
  private ghost: Mesh | null = null
  private hasMoved = false
  private justDropped = false
  private observer: Observer<PointerInfo> | null = null
  private onBlur = (): void => { this.onUp() }
  private onWindowPointerUp = (): void => { this.onUp() }

  isDragging(): boolean { return this.dragging !== null }

  consumeJustDropped(): boolean {
    const v = this.justDropped
    this.justDropped = false
    return v
  }

  constructor(
    private scene: Scene,
    private spriteManager: SpriteManager,
    private camera: ArcRotateCamera,
    private callbacks: DragCallbacks,
    private reattachCamera: () => void = () => camera.attachControl(true, false, 0),
  ) {
    this.observer = this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERDOWN) this.onDown(info)
      if (info.type === PointerEventTypes.POINTERMOVE) this.onMove()
      if (info.type === PointerEventTypes.POINTERUP) this.onUp()
    })
    window.addEventListener('blur', this.onBlur)
    // Catch pointer-up outside the canvas so drags always terminate cleanly
    window.addEventListener('pointerup', this.onWindowPointerUp)
  }

  private onDown(info: PointerInfo): void {
    if ((info.event as PointerEvent).button !== 0) return  // left button only
    // Pick sprite meshes specifically — skips wall boxes so tokens behind walls remain grabbable
    const pickResult = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      (mesh) => !!this.spriteManager.getInstanceId(mesh),
    )
    const picked = pickResult?.pickedMesh
    if (!picked) return
    const instanceId = this.spriteManager.getInstanceId(picked)
    if (!instanceId) return
    if (picked.metadata?.draggable === false) return
    this.spriteManager.hidePlacementGhost()

    const mesh = this.spriteManager.getMesh(instanceId)
    if (!mesh) return
    const { col, row } = worldToCell(mesh.position.x, mesh.position.z)

    this.dragging = { instanceId, originalCol: col, originalRow: row }
    this.hasMoved = false
    this.camera.detachControl()
    this.spriteManager.setHighlight(instanceId, true)

    this.ghost = MeshBuilder.CreateBox('ghost', { size: 0.85 }, this.scene)
    const ghostMat = new StandardMaterial('ghost-mat', this.scene)
    ghostMat.diffuseColor = new Color3(0.5, 0.8, 1)
    ghostMat.alpha = 0.4
    this.ghost.material = ghostMat
    const { x, z } = cellToWorld(col, row)
    this.ghost.position = new Vector3(x, 0.3, z)
  }

  private onMove(): void {
    if (!this.dragging || !this.ghost) return
    const cell = this.pickGroundCell()
    if (!cell) return
    this.hasMoved = true
    const { x, z } = cellToWorld(cell.col, cell.row)
    this.ghost.position.x = x
    this.ghost.position.z = z
    this.callbacks.onDragMove(this.dragging.instanceId, cell.col, cell.row)
  }

  private onUp(): void {
    if (!this.dragging) return
    const { instanceId, originalCol, originalRow } = this.dragging

    this.reattachCamera()

    if (!this.hasMoved) {
      this.callbacks.onSpriteClick(instanceId)
    } else {
      this.justDropped = true
      const cell = this.pickGroundCell()
      const allowed = cell && (!this.callbacks.canDrop || this.callbacks.canDrop(cell.col, cell.row))
      const dest = allowed ? cell! : { col: originalCol, row: originalRow }
      this.spriteManager.move(instanceId, dest.col, dest.row)
      this.callbacks.onDragDrop(instanceId, dest.col, dest.row)
    }

    this.spriteManager.setHighlight(instanceId, false)
    this.ghost?.dispose()
    this.ghost = null
    this.dragging = null
  }

  private pickGroundCell(): { col: number; row: number } | null {
    const pick = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      (mesh) => mesh.name === 'ground',
    )
    if (!pick?.hit || !pick.pickedPoint) return null
    return worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
  }

  dispose(): void {
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('pointerup', this.onWindowPointerUp)
    this.scene.onPointerObservable.remove(this.observer)
    this.observer = null
    this.ghost?.dispose()
    this.ghost = null
  }
}
