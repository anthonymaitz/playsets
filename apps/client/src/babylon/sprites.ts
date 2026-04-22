import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Texture,
  Mesh,
  Vector3,
  Color3,
  AbstractMesh,
  ShadowGenerator,
  PointLight,
  ArcRotateCamera,
} from '@babylonjs/core'
import { cellToWorld, CELL_SIZE } from './grid'
import { getCameraSnapIndex, computeSpriteVariant } from './cameraFacing'
import { LAYER_HEIGHT } from './layers'
import type { SpriteInstance, FacingDir, AnimationName } from '../types'

const SPRITE_HEIGHT = CELL_SIZE * 1.6
const TERRAIN_HEIGHT = CELL_SIZE * 0.4

// Directional shadow constants — must stay in sync with sun direction (0.5, -0.8, 0.5) in WeatherSystem
// Shadow falls toward +X +Z. Length = SPRITE_HEIGHT * horiz/vert = 1.6 * 0.707/0.8 ≈ 1.414
const SHADOW_LENGTH = SPRITE_HEIGHT * (Math.SQRT2 / 2) / 0.8
const SHADOW_OFFSET_X = (Math.SQRT2 / 2) * SHADOW_LENGTH / 2  // 0.5
const SHADOW_OFFSET_Z = (Math.SQRT2 / 2) * SHADOW_LENGTH / 2  // 0.5
// rotation.x=-π/2 (flat, normal up), rotation.y=-3π/4 (local-Y → shadow direction)
const SHADOW_ROT_X = -Math.PI / 2
const SHADOW_ROT_Y = -3 * Math.PI / 4

// Facing direction → rotation.y angle for the ground indicator (pointing from center toward direction)
const FACING_ANGLE: Record<FacingDir, number> = {
  s: 0,
  n: Math.PI,
  e: -Math.PI / 2,
  w: Math.PI / 2,
}

function resolveSpritePath(basePath: string, isFront: boolean): string {
  return basePath.replace(/\.svg$/, `${isFront ? '_front' : '_back'}.svg`)
}

export class SpriteManager {
  private meshes = new Map<string, Mesh>()
  private indicators = new Map<string, Mesh>()
  private tokenShadows = new Map<string, Mesh>()
  private textureCache = new Map<string, Texture>()
  private ghost: { mesh: Mesh; mat: StandardMaterial; spriteId: string } | null = null
  private animationHandlers = new Map<string, () => void>()
  private shadowGen: ShadowGenerator | null = null
  private shadowsEnabled = false
  private torchLights = new Map<string, { light: PointLight; cleanup: () => void }>()
  private lastSnapIndex = -1

  constructor(private scene: Scene, private camera?: ArcRotateCamera, private isHost = false) {
    if (camera) {
      const fn = () => {
        const si = getCameraSnapIndex(camera.alpha)
        if (si === this.lastSnapIndex) return
        this.lastSnapIndex = si
        for (const [instanceId, mesh] of this.meshes) {
          if (!mesh.metadata?.hasDirections) continue
          const facing = mesh.metadata.facing as FacingDir | undefined
          if (facing) this._applyFacingVariant(instanceId, facing, si)
        }
      }
      scene.registerBeforeRender(fn)
    }
  }

  setShadowGenerator(gen: ShadowGenerator | null): void {
    this.shadowGen = gen
    this.shadowsEnabled = gen !== null
    if (gen) {
      for (const mesh of this.meshes.values()) gen.addShadowCaster(mesh)
    }
    for (const s of this.tokenShadows.values()) s.isVisible = this.shadowsEnabled
  }

  private getTexture(path: string): Texture {
    if (path.startsWith('data:')) {
      const tex = new Texture(path, this.scene, false, true)
      tex.hasAlpha = true
      return tex
    }
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
    const hasDir = instance.spriteId.startsWith('tokens/') || !!instance.definitionId
    const h = isTerrain ? TERRAIN_HEIGHT : SPRITE_HEIGHT

    const facing: FacingDir = instance.facing ?? 's'
    let spritePath: string
    let initialMirrored = false
    if (hasDir) {
      const snapIndex = this.camera ? getCameraSnapIndex(this.camera.alpha) : 0
      const variant = computeSpriteVariant(facing, snapIndex)
      spritePath = resolveSpritePath(basePath, variant.isFront)
      initialMirrored = variant.isMirrored
    } else {
      spritePath = basePath
    }

    const plane = MeshBuilder.CreatePlane(
      `sprite-${instance.instanceId}`,
      { width: CELL_SIZE * 0.9, height: h },
      this.scene,
    )
    const layerY = ((instance.layerIndex ?? 5) - 5) * LAYER_HEIGHT
    plane.position = new Vector3(x, layerY + h / 2 - (instance.zOrder ?? 0) * 0.03, z)
    plane.billboardMode = Mesh.BILLBOARDMODE_Y
    plane.renderingGroupId = 1
    if (initialMirrored) plane.scaling.x = -1

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
      facing,
      layerIndex: instance.layerIndex ?? 5,
      isTerrain,
      h,
      zOrder: instance.zOrder ?? 0,
    }
    this.meshes.set(instance.instanceId, plane)
    if (this.shadowGen) this.shadowGen.addShadowCaster(plane)

    if (!isTerrain) this._createTokenShadow(instance.instanceId, x, z, spritePath, layerY)

    if (hasDir) this.upsertIndicator(instance.instanceId, x, z, facing, layerY)

    if (instance.hidden) this.setHidden(instance.instanceId, true)
  }

  private _createTokenShadow(instanceId: string, x: number, z: number, spritePath: string, layerY = 0): void {
    const sp = MeshBuilder.CreatePlane(`shadow-${instanceId}`, {
      width: CELL_SIZE * 0.9,
      height: SHADOW_LENGTH,
    }, this.scene)
    sp.rotation.x = SHADOW_ROT_X
    sp.rotation.y = SHADOW_ROT_Y
    sp.position = new Vector3(x + SHADOW_OFFSET_X, layerY + 0.01, z + SHADOW_OFFSET_Z)
    const sm = new StandardMaterial(`shadow-mat-${instanceId}`, this.scene)
    sm.diffuseTexture = this.getTexture(spritePath)
    sm.useAlphaFromDiffuseTexture = true
    sm.diffuseColor = Color3.Black()
    sm.emissiveColor = Color3.Black()
    sm.specularColor = Color3.Black()
    sm.alpha = 0.55
    sm.backFaceCulling = false
    sp.material = sm
    sp.isPickable = false
    sp.isVisible = this.shadowsEnabled
    this.tokenShadows.set(instanceId, sp)
  }

  private upsertIndicator(instanceId: string, x: number, z: number, facing: FacingDir, layerY = 0): void {
    let ind = this.indicators.get(instanceId)
    if (!ind) {
      ind = MeshBuilder.CreateDisc(`dir-${instanceId}`, { radius: 0.22, tessellation: 3 }, this.scene)
      ind.rotation.x = -Math.PI / 2
      ind.position = new Vector3(x, layerY + 0.02, z)
      const mat = new StandardMaterial(`dir-mat-${instanceId}`, this.scene)
      mat.diffuseColor = new Color3(1, 0.85, 0.1)
      mat.emissiveColor = new Color3(0.6, 0.5, 0)
      mat.backFaceCulling = false
      ind.material = mat
      this.indicators.set(instanceId, ind)
    }
    ind.rotation.y = FACING_ANGLE[facing]
    ind.position.x = x
    ind.position.y = layerY + 0.02
    ind.position.z = z
  }

  setFacing(instanceId: string, facing: FacingDir): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh?.metadata?.hasDirections) return
    mesh.metadata.facing = facing
    const snapIndex = this.camera ? getCameraSnapIndex(this.camera.alpha) : 0
    this._applyFacingVariant(instanceId, facing, snapIndex)
  }

  setZOrder(instanceId: string, zOrder: number): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    const h = (mesh.metadata?.isTerrain as boolean) ? TERRAIN_HEIGHT : SPRITE_HEIGHT
    const layerY = ((mesh.metadata?.layerIndex as number ?? 5) - 5) * LAYER_HEIGHT
    mesh.metadata.zOrder = zOrder
    mesh.position.y = layerY + h / 2 - zOrder * 0.03
  }

  setLayer(instanceId: string, layerIndex: number): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    mesh.metadata.layerIndex = layerIndex
    const layerY = (layerIndex - 5) * LAYER_HEIGHT
    const h: number = mesh.metadata.isTerrain ? TERRAIN_HEIGHT : SPRITE_HEIGHT
    const zOrder: number = mesh.metadata.zOrder ?? 0
    mesh.position.y = layerY + h / 2 - zOrder * 0.03
    const shadow = this.tokenShadows.get(instanceId)
    if (shadow) shadow.position.y = layerY + 0.01
    const ind = this.indicators.get(instanceId)
    if (ind) ind.position.y = layerY + 0.02
  }

  setLayerVisibility(layerIndex: number, visible: boolean): void {
    for (const [instanceId, mesh] of this.meshes) {
      if ((mesh.metadata?.layerIndex as number ?? 5) !== layerIndex) continue
      mesh.isVisible = visible
      const shadow = this.tokenShadows.get(instanceId)
      if (shadow) shadow.isVisible = visible && this.shadowsEnabled
      const ind = this.indicators.get(instanceId)
      if (ind) ind.isVisible = visible
    }
  }

  /** Update the front and back data URLs for a custom token, and refresh the visible texture. */
  setTokenDataUrls(instanceId: string, frontUrl: string, backUrl: string): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    mesh.metadata.frontDataUrl = frontUrl
    mesh.metadata.backDataUrl = backUrl
    // Refresh visible texture based on current facing
    const facing: FacingDir = mesh.metadata.facing ?? 's'
    const snapIndex = this.camera ? getCameraSnapIndex(this.camera.alpha) : 0
    this._applyFacingVariant(instanceId, facing, snapIndex)
  }

  updateTexture(instanceId: string, url: string): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    const mat = mesh.material as StandardMaterial
    const oldTex = mat.diffuseTexture
    const tex = new Texture(url, this.scene, false, true)
    tex.hasAlpha = true
    mat.diffuseTexture = tex
    oldTex?.dispose()

    const shadow = this.tokenShadows.get(instanceId)
    if (shadow && shadow.material instanceof StandardMaterial) {
      const sm = shadow.material as StandardMaterial
      const oldShadowTex = sm.diffuseTexture
      sm.diffuseTexture = new Texture(url, this.scene, false, true)
      sm.diffuseTexture.hasAlpha = true
      oldShadowTex?.dispose()
    }
  }

  private _applyFacingVariant(instanceId: string, facing: FacingDir, snapIndex: number): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    const { isFront, isMirrored } = computeSpriteVariant(facing, snapIndex)
    const basePath = mesh.metadata.basePath as string
    if (basePath.startsWith('data:')) {
      // Custom token — use stored front/back data URLs
      const url: string = isFront
        ? (mesh.metadata.frontDataUrl ?? basePath)
        : (mesh.metadata.backDataUrl ?? mesh.metadata.frontDataUrl ?? basePath)
      const mat = mesh.material as StandardMaterial
      const oldTex = mat.diffuseTexture
      const tex = new Texture(url, this.scene, false, true)
      tex.hasAlpha = true
      mat.diffuseTexture = tex
      oldTex?.dispose()
      const sp = this.tokenShadows.get(instanceId)
      if (sp && sp.material instanceof StandardMaterial) {
        const sm = sp.material as StandardMaterial
        const oldShadowTex = sm.diffuseTexture
        sm.diffuseTexture = new Texture(url, this.scene, false, true)
        sm.diffuseTexture.hasAlpha = true
        oldShadowTex?.dispose()
      }
    } else {
      const spritePath = resolveSpritePath(basePath, isFront)
      const tex = this.getTexture(spritePath)
      tex.hasAlpha = true
      ;(mesh.material as StandardMaterial).diffuseTexture = tex
      const sp = this.tokenShadows.get(instanceId)
      if (sp && sp.material instanceof StandardMaterial) {
        ;(sp.material as StandardMaterial).diffuseTexture = tex
      }
    }
    mesh.scaling.x = isMirrored ? -1 : 1
    const layerY = ((mesh.metadata.layerIndex as number ?? 5) - 5) * LAYER_HEIGHT
    this.upsertIndicator(instanceId, mesh.position.x, mesh.position.z, facing, layerY)
  }

  move(instanceId: string, col: number, row: number): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    const { x, z } = cellToWorld(col, row)
    mesh.position.x = x
    mesh.position.z = z
    const ind = this.indicators.get(instanceId)
    if (ind) { ind.position.x = x; ind.position.z = z }
    const sp = this.tokenShadows.get(instanceId)
    if (sp) { sp.position.x = x + SHADOW_OFFSET_X; sp.position.z = z + SHADOW_OFFSET_Z }
  }

  remove(instanceId: string): void {
    const handler = this.animationHandlers.get(instanceId)
    if (handler) { this.scene.unregisterBeforeRender(handler); this.animationHandlers.delete(instanceId) }
    this.meshes.get(instanceId)?.dispose()
    this.meshes.delete(instanceId)
    this.indicators.get(instanceId)?.dispose()
    this.indicators.delete(instanceId)
    this.tokenShadows.get(instanceId)?.dispose()
    this.tokenShadows.delete(instanceId)
    const torch = this.torchLights.get(instanceId)
    if (torch) { torch.cleanup(); this.torchLights.delete(instanceId) }
  }

  setAnimation(instanceId: string, animation: AnimationName): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    const existing = this.animationHandlers.get(instanceId)
    if (existing) {
      this.scene.unregisterBeforeRender(existing)
      this.animationHandlers.delete(instanceId)
      mesh.rotation.y = 0
      mesh.position.y = mesh.metadata?.baseY ?? mesh.position.y
    }
    if (!animation) return
    const baseY = mesh.position.y
    mesh.metadata = { ...mesh.metadata, baseY }
    let t = 0
    const handler = () => {
      t += 0.04
      if (animation === 'dance') {
        mesh.rotation.y = Math.sin(t * 3) * 0.4
        mesh.position.y = baseY + Math.abs(Math.sin(t * 4)) * 0.15
      } else if (animation === 'sleep') {
        mesh.position.y = baseY + Math.sin(t * 0.8) * 0.08
        const s = 1 + Math.sin(t * 0.6) * 0.04
        mesh.scaling.x = s
        mesh.scaling.y = s
      }
    }
    this.scene.registerBeforeRender(handler)
    this.animationHandlers.set(instanceId, handler)
  }

  setStatuses(instanceId: string, statuses: string[]): void {
    const mesh = this.meshes.get(instanceId)
    const existing = this.torchLights.get(instanceId)
    if (existing) {
      existing.cleanup()
      this.torchLights.delete(instanceId)
    }
    if (statuses.includes('🕯️') && mesh) {
      const light = new PointLight(`torch-${instanceId}`, new Vector3(mesh.position.x, 1.0, mesh.position.z), this.scene)
      light.diffuse = new Color3(1.0, 0.65, 0.2)
      light.specular = new Color3(1.0, 0.5, 0.1)
      light.intensity = 2.8
      light.range = 4
      let flickerT = 0
      const flickerFn = () => {
        flickerT += 0.05
        light.intensity = 1.8 + Math.sin(flickerT * 7.3) * 0.3 + Math.sin(flickerT * 13.1) * 0.15
        if (mesh) {
          light.position.x = mesh.position.x
          light.position.z = mesh.position.z
          // Offset toward camera so the billboard's front face receives the light
          if (this.camera) {
            const dx = this.camera.position.x - mesh.position.x
            const dz = this.camera.position.z - mesh.position.z
            const len = Math.sqrt(dx * dx + dz * dz)
            if (len > 0.001) {
              light.position.x += (dx / len) * 0.6
              light.position.z += (dz / len) * 0.6
            }
          }
        }
      }
      this.scene.registerBeforeRender(flickerFn)
      this.torchLights.set(instanceId, {
        light,
        cleanup: () => { this.scene.unregisterBeforeRender(flickerFn); light.dispose() },
      })
    }
  }

  setHidden(instanceId: string, hidden: boolean): void {
    const mesh = this.meshes.get(instanceId)
    if (mesh) {
      if (hidden) {
        if (this.isHost) {
          mesh.isVisible = true
          mesh.visibility = 0.3
        } else {
          mesh.isVisible = false
          mesh.visibility = 1
        }
      } else {
        mesh.isVisible = true
        mesh.visibility = 1
      }
    }
    const ind = this.indicators.get(instanceId)
    if (ind) ind.isVisible = !hidden
    const sp = this.tokenShadows.get(instanceId)
    if (sp) sp.isVisible = !hidden && this.shadowsEnabled
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
      mesh.renderingGroupId = 1
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
    for (const handler of this.animationHandlers.values()) { this.scene.unregisterBeforeRender(handler) }
    this.animationHandlers.clear()
    for (const mesh of this.meshes.values()) mesh.dispose()
    this.meshes.clear()
    for (const ind of this.indicators.values()) ind.dispose()
    this.indicators.clear()
    for (const sp of this.tokenShadows.values()) sp.dispose()
    this.tokenShadows.clear()
    for (const torch of this.torchLights.values()) torch.cleanup()
    this.torchLights.clear()
    for (const tex of this.textureCache.values()) tex.dispose()
    this.textureCache.clear()
  }
}
