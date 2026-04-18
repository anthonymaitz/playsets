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
import type { SpriteInstance, FacingDir } from '../types'

const SPRITE_HEIGHT = CELL_SIZE * 1.6
const TERRAIN_HEIGHT = CELL_SIZE * 0.4

// Facing direction → rotation.y angle for the ground indicator (pointing from center toward direction)
const FACING_ANGLE: Record<FacingDir, number> = {
  s: 0,
  n: Math.PI,
  e: -Math.PI / 2,
  w: Math.PI / 2,
}

function resolveSpritePath(basePath: string, facing: FacingDir): string {
  const isFront = facing === 's' || facing === 'e'
  return basePath.replace(/\.svg$/, `${isFront ? '_front' : '_back'}.svg`)
}

export class SpriteManager {
  private meshes = new Map<string, Mesh>()
  private indicators = new Map<string, Mesh>()
  private textureCache = new Map<string, Texture>()
  private ghost: { mesh: Mesh; mat: StandardMaterial; spriteId: string } | null = null

  constructor(private scene: Scene) {}

  private getTexture(path: string): Texture {
    const cached = this.textureCache.get(path)
    if (cached) return cached
    const tex = new Texture(path, this.scene, false, true)
    this.textureCache.set(path, tex)
    return tex
  }

  place(instance: SpriteInstance, basePath: string): void {
    if (this.meshes.has(instance.instanceId)) return
    const { x, z } = cellToWorld(instance.col, instance.row)
    const isTerrain = instance.spriteId.startsWith('terrain/')
    const hasDir = instance.spriteId.startsWith('tokens/')
    const h = isTerrain ? TERRAIN_HEIGHT : SPRITE_HEIGHT

    const facing: FacingDir = instance.facing ?? 's'
    const spritePath = hasDir ? resolveSpritePath(basePath, facing) : basePath

    const plane = MeshBuilder.CreatePlane(
      `sprite-${instance.instanceId}`,
      { width: CELL_SIZE * 0.9, height: h },
      this.scene,
    )
    plane.position = new Vector3(x, h / 2, z)
    plane.billboardMode = Mesh.BILLBOARDMODE_Y

    const mat = new StandardMaterial(`mat-${instance.instanceId}`, this.scene)
    const tex = this.getTexture(spritePath)
    tex.hasAlpha = true
    mat.diffuseTexture = tex
    mat.useAlphaFromDiffuseTexture = true
    mat.backFaceCulling = false
    plane.material = mat

    plane.metadata = {
      instanceId: instance.instanceId,
      draggable: !isTerrain,
      basePath,
      hasDirections: hasDir,
    }
    this.meshes.set(instance.instanceId, plane)

    if (hasDir) this.upsertIndicator(instance.instanceId, x, z, facing)
  }

  private upsertIndicator(instanceId: string, x: number, z: number, facing: FacingDir): void {
    let ind = this.indicators.get(instanceId)
    if (!ind) {
      ind = MeshBuilder.CreateDisc(`dir-${instanceId}`, { radius: 0.22, tessellation: 3 }, this.scene)
      ind.rotation.x = -Math.PI / 2
      ind.position = new Vector3(x, 0.02, z)
      const mat = new StandardMaterial(`dir-mat-${instanceId}`, this.scene)
      mat.diffuseColor = new Color3(1, 0.85, 0.1)
      mat.emissiveColor = new Color3(0.6, 0.5, 0)
      mat.backFaceCulling = false
      ind.material = mat
      this.indicators.set(instanceId, ind)
    }
    ind.rotation.y = FACING_ANGLE[facing]
    ind.position.x = x
    ind.position.z = z
  }

  setFacing(instanceId: string, facing: FacingDir): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh?.metadata?.hasDirections) return
    const mat = mesh.material as StandardMaterial
    const basePath = mesh.metadata.basePath as string
    const newPath = resolveSpritePath(basePath, facing)
    const tex = this.getTexture(newPath)
    tex.hasAlpha = true
    mat.diffuseTexture = tex
    this.upsertIndicator(instanceId, mesh.position.x, mesh.position.z, facing)
  }

  move(instanceId: string, col: number, row: number): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    const { x, z } = cellToWorld(col, row)
    mesh.position.x = x
    mesh.position.z = z
    const ind = this.indicators.get(instanceId)
    if (ind) { ind.position.x = x; ind.position.z = z }
  }

  remove(instanceId: string): void {
    this.meshes.get(instanceId)?.dispose()
    this.meshes.delete(instanceId)
    this.indicators.get(instanceId)?.dispose()
    this.indicators.delete(instanceId)
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

  showPlacementGhost(spriteId: string, path: string, col: number, row: number): void {
    const { x, z } = cellToWorld(col, row)
    const isTerrain = spriteId.startsWith('terrain/')
    const h = isTerrain ? TERRAIN_HEIGHT : SPRITE_HEIGHT
    if (this.ghost?.spriteId !== spriteId) {
      this.hidePlacementGhost()
      const mesh = MeshBuilder.CreatePlane('placement-ghost', { width: CELL_SIZE * 0.9, height: h }, this.scene)
      mesh.billboardMode = Mesh.BILLBOARDMODE_Y
      const mat = new StandardMaterial('placement-ghost-mat', this.scene)
      const tex = this.getTexture(path)
      tex.hasAlpha = true
      mat.diffuseTexture = tex
      mat.useAlphaFromDiffuseTexture = true
      mat.backFaceCulling = false
      mat.alpha = 0.65
      mesh.material = mat
      this.ghost = { mesh, mat, spriteId }
    }
    this.ghost.mesh.position = new Vector3(x, h / 2, z)
    this.ghost.mesh.isVisible = true
  }

  hidePlacementGhost(): void {
    if (!this.ghost) return
    this.ghost.mesh.dispose()
    this.ghost.mat.dispose()
    this.ghost = null
  }

  clear(): void {
    for (const mesh of this.meshes.values()) mesh.dispose()
    this.meshes.clear()
    for (const ind of this.indicators.values()) ind.dispose()
    this.indicators.clear()
    for (const tex of this.textureCache.values()) tex.dispose()
    this.textureCache.clear()
  }
}
