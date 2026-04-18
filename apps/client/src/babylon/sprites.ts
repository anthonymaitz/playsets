import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Texture,
  Mesh,
  Vector3,
  Color3,
  AbstractMesh,
} from '@babylonjs/core'
import { cellToWorld, CELL_SIZE } from './grid'
import type { SpriteInstance } from '../types'

const SPRITE_HEIGHT = CELL_SIZE * 1.6

export class SpriteManager {
  private meshes = new Map<string, Mesh>()
  private textureCache = new Map<string, Texture>()

  constructor(private scene: Scene) {}

  private getTexture(path: string): Texture {
    const cached = this.textureCache.get(path)
    if (cached) return cached
    const tex = new Texture(path, this.scene, false, false)
    this.textureCache.set(path, tex)
    return tex
  }

  place(instance: SpriteInstance, spritePath: string): void {
    if (this.meshes.has(instance.instanceId)) return
    const { x, z } = cellToWorld(instance.col, instance.row)

    const plane = MeshBuilder.CreatePlane(
      `sprite-${instance.instanceId}`,
      { width: CELL_SIZE * 0.9, height: SPRITE_HEIGHT },
      this.scene,
    )
    plane.position = new Vector3(x, SPRITE_HEIGHT / 2, z)
    plane.billboardMode = Mesh.BILLBOARDMODE_Y

    const mat = new StandardMaterial(`mat-${instance.instanceId}`, this.scene)
    const tex = this.getTexture(spritePath)
    tex.hasAlpha = true
    mat.diffuseTexture = tex
    mat.useAlphaFromDiffuseTexture = true
    mat.backFaceCulling = false
    plane.material = mat

    plane.metadata = { instanceId: instance.instanceId }
    this.meshes.set(instance.instanceId, plane)
  }

  move(instanceId: string, col: number, row: number): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    const { x, z } = cellToWorld(col, row)
    mesh.position.x = x
    mesh.position.z = z
  }

  remove(instanceId: string): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    mesh.dispose()
    this.meshes.delete(instanceId)
  }

  setHighlight(instanceId: string, on: boolean): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh || !(mesh.material instanceof StandardMaterial)) return
    ;(mesh.material as StandardMaterial).emissiveColor = on
      ? new Color3(0.4, 0.4, 0.4)
      : Color3.Black()
  }

  getInstanceId(picked: AbstractMesh): string | undefined {
    return picked.metadata?.instanceId as string | undefined
  }

  getMesh(instanceId: string): Mesh | undefined {
    return this.meshes.get(instanceId)
  }

  clear(): void {
    for (const mesh of this.meshes.values()) mesh.dispose()
    this.meshes.clear()
    for (const tex of this.textureCache.values()) tex.dispose()
    this.textureCache.clear()
  }
}
