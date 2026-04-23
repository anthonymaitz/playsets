import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, TransformNode } from '@babylonjs/core'
import type { BuilderProp, PropCategory } from '../types'
import type { BuildingManager } from './buildings'
import { cellToWorld } from './grid'

// ── Shared colors ────────────────────────────────────────────────────────────
const FRAME_COLOR   = new Color3(0.42, 0.26, 0.13)   // wood frame
const PANEL_COLOR   = new Color3(0.6,  0.38, 0.18)   // door panel
const GLASS_COLOR   = new Color3(0.6,  0.75, 0.9)    // window glass
const CANVAS_COLOR  = new Color3(0.7,  0.5,  0.3)    // painting frame (gold)
const ART_COLOR     = new Color3(0.3,  0.5,  0.7)    // placeholder painting
const RUG_COLOR     = new Color3(0.6,  0.2,  0.25)   // red-ish rug
const COUNTER_COLOR = new Color3(0.4,  0.25, 0.1)    // dark wood counter top
const COUNTER_BODY  = new Color3(0.35, 0.22, 0.09)   // slightly darker body
const METAL_COLOR   = new Color3(0.2,  0.2,  0.2)    // foot rail

// ── Category lookup ───────────────────────────────────────────────────────────
const PROP_CATEGORIES: Record<string, PropCategory> = {
  'door-wood':   'punch-through',
  'window-wood': 'wall-decor',   // wall stays visible — frame overlays it
  'painting':    'wall-decor',
  'rug':         'floor-decor',
  'bartop':      'floor-object',
  'stair-up':    'floor-object',
  'stair-down':  'floor-object',
}

/** Derive category from propId. Falls back to 'floor-object' for unknown props. */
export function getPropCategory(propId: string): PropCategory {
  return PROP_CATEGORIES[propId] ?? 'floor-object'
}

// ── Entry ────────────────────────────────────────────────────────────────────
interface PropRenderEntry {
  prop: BuilderProp
  category: PropCategory
  root: TransformNode   // all meshes are children; rotate root for wall orientation
  allMeshes: Mesh[]     // for dispose and mesh picking
  panel: Mesh | null    // togglable (door panel, window glass)
}

// ── Manager ──────────────────────────────────────────────────────────────────
export class PropManager {
  private entries = new Map<string, PropRenderEntry>()

  constructor(private scene: Scene) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  place(prop: BuilderProp, category: PropCategory, buildingManager: BuildingManager): void {
    if (this.entries.has(prop.instanceId)) return
    const { x, z } = cellToWorld(prop.col, prop.row)

    const root = new TransformNode(`prop-root-${prop.instanceId}`, this.scene)
    root.position.set(x, -(prop.zOrder ?? 0) * 0.03, z)
    root.metadata = { layerIndex: prop.layerIndex ?? 5 }
    // z-axis wall: west wall uses -90°, east wall uses +90°
    if (prop.state.facing === 'west') root.rotation.y = -Math.PI / 2
    else if (prop.state.facing === 'east') root.rotation.y = Math.PI / 2
    // floor-object: ↘ = 90° rotation (long axis swap); floor-decor: ↘ = X-axis mirror
    if (prop.state.mirrored) {
      if (category === 'floor-object') root.rotation.y = Math.PI / 2
      else root.scaling.x = -1
    }

    let allMeshes: Mesh[] = []
    let panel: Mesh | null = null

    switch (prop.propId) {
      case 'door-wood':
        ;({ allMeshes, panel } = this.placeDoor(prop))
        buildingManager.hideWallAt(prop.col, prop.row, prop.layerIndex ?? 5)
        break
      case 'window-wood':
        ;({ allMeshes, panel } = this.placeWindow(prop))
        break
      case 'painting':
        ;({ allMeshes } = this.placePainting(prop))
        break
      case 'rug':
        ;({ allMeshes } = this.placeRug(prop))
        break
      case 'bartop':
        ;({ allMeshes } = this.placeBartop(prop))
        break
      case 'stair-up': {
        const step1 = MeshBuilder.CreateBox(`stair-s1-${prop.instanceId}`, { width: 0.8, height: 0.2, depth: 0.8 }, this.scene)
        step1.position.set(0, 0.1, 0)
        const step2 = MeshBuilder.CreateBox(`stair-s2-${prop.instanceId}`, { width: 0.8, height: 0.4, depth: 0.4 }, this.scene)
        step2.position.set(0, 0.2, -0.2)
        const step3 = MeshBuilder.CreateBox(`stair-s3-${prop.instanceId}`, { width: 0.8, height: 0.6, depth: 0.4 }, this.scene)
        step3.position.set(0, 0.3, -0.5)
        const stairMat = new StandardMaterial(`stair-mat-${prop.instanceId}`, this.scene)
        stairMat.diffuseColor = new Color3(0.6, 0.5, 0.35)
        for (const m of [step1, step2, step3]) { m.material = stairMat }
        allMeshes = [step1, step2, step3]
        break
      }
      case 'stair-down': {
        const step1 = MeshBuilder.CreateBox(`stair-s1-${prop.instanceId}`, { width: 0.8, height: 0.2, depth: 0.8 }, this.scene)
        step1.position.set(0, 0.1, 0)
        const step2 = MeshBuilder.CreateBox(`stair-s2-${prop.instanceId}`, { width: 0.8, height: 0.4, depth: 0.4 }, this.scene)
        step2.position.set(0, 0.2, 0.2)
        const step3 = MeshBuilder.CreateBox(`stair-s3-${prop.instanceId}`, { width: 0.8, height: 0.6, depth: 0.4 }, this.scene)
        step3.position.set(0, 0.3, 0.5)
        const stairMat2 = new StandardMaterial(`stair-mat2-${prop.instanceId}`, this.scene)
        stairMat2.diffuseColor = new Color3(0.5, 0.4, 0.28)
        for (const m of [step1, step2, step3]) { m.material = stairMat2 }
        allMeshes = [step1, step2, step3]
        break
      }
      default:
        console.warn(`[PropManager] Unknown propId: ${prop.propId}`)
        root.dispose()
        return
    }

    for (const m of allMeshes) {
      m.parent = root
      m.metadata = { propInstanceId: prop.instanceId }
      m.renderingGroupId = prop.layerIndex ?? 5
    }

    this.entries.set(prop.instanceId, { prop, category, root, allMeshes, panel })
  }

  remove(instanceId: string, buildingManager: BuildingManager): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    if (entry.category === 'punch-through') {
      buildingManager.showWallAt(entry.prop.col, entry.prop.row, entry.prop.layerIndex ?? 5)
    }
    for (const m of entry.allMeshes) { m.material?.dispose(); m.dispose() }
    entry.root.dispose()
    this.entries.delete(instanceId)
  }

  setState(instanceId: string, state: Record<string, string | number | boolean>): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    entry.prop = { ...entry.prop, state }
    if (entry.panel) entry.panel.isVisible = state.open !== true
    if ('mirrored' in state) {
      if (entry.category === 'floor-object') entry.root.rotation.y = state.mirrored ? Math.PI / 2 : 0
      else entry.root.scaling.x = state.mirrored ? -1 : 1
    }
  }

  setPropZOrder(instanceId: string, zOrder: number): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    entry.prop = { ...entry.prop, zOrder }
    entry.root.position.y = -zOrder * 0.03
  }

  getInstanceIdsAt(col: number, row: number): string[] {
    const ids: string[] = []
    for (const [id, entry] of this.entries) {
      if (entry.prop.col === col && entry.prop.row === row) ids.push(id)
    }
    return ids
  }

  move(instanceId: string, col: number, row: number, buildingManager: BuildingManager): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    const oldProp = entry.prop
    const layer = entry.prop.layerIndex ?? 5
    if (entry.category === 'punch-through') buildingManager.showWallAt(oldProp.col, oldProp.row, layer)
    entry.prop = { ...entry.prop, col, row }
    if (entry.category === 'punch-through') buildingManager.hideWallAt(col, row, layer)
    const { x, z } = cellToWorld(col, row)
    entry.root.position.x = x
    entry.root.position.z = z
  }

  loadSnapshot(
    props: BuilderProp[],
    getCategory: (propId: string) => PropCategory,
    buildingManager: BuildingManager,
  ): void {
    this.clear(buildingManager)
    for (const p of props) this.place(p, getCategory(p.propId), buildingManager)
  }

  getInstanceIdAt(col: number, row: number): string | null {
    for (const [id, entry] of this.entries) {
      if (entry.prop.col === col && entry.prop.row === row) return id
    }
    return null
  }

  clear(buildingManager: BuildingManager): void {
    for (const instanceId of [...this.entries.keys()]) {
      this.remove(instanceId, buildingManager)
    }
  }

  setLayerVisibility(layerIndex: number, visible: boolean): void {
    for (const entry of this.entries.values()) {
      if ((entry.root.metadata?.layerIndex as number ?? 5) === layerIndex) {
        for (const mesh of entry.allMeshes) {
          mesh.isVisible = visible
          mesh.isPickable = visible
        }
      }
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      for (const m of entry.allMeshes) { m.material?.dispose(); m.dispose() }
      entry.root.dispose()
    }
    this.entries.clear()
  }

  // ── Prop builders — all positions are LOCAL (relative to root at cell center) ──

  /** door-wood — punch-through; frame spans x-axis by default, rotated for z-facing walls */
  private placeDoor(prop: BuilderProp): { allMeshes: Mesh[]; panel: Mesh } {
    const id = prop.instanceId
    const header    = this.makeBox(`prop-header-${id}`,  1,    0.2,  0.15,  0,       1.5,   0,  FRAME_COLOR)
    const leftJamb  = this.makeBox(`prop-ljamb-${id}`,   0.15, 1.4,  0.15, -0.425,  0.7,   0,  FRAME_COLOR)
    const rightJamb = this.makeBox(`prop-rjamb-${id}`,   0.15, 1.4,  0.15,  0.425,  0.7,   0,  FRAME_COLOR)
    const panel     = this.makeBox(`prop-panel-${id}`,   0.7,  1.35, 0.08,  0,       0.675, 0,  PANEL_COLOR)
    panel.isVisible = prop.state.open !== true
    return { allMeshes: [header, leftJamb, rightJamb, panel], panel }
  }

  /** window-wood — wall-decor; frame on both faces so it's visible from either side */
  private placeWindow(prop: BuilderProp): { allMeshes: Mesh[]; panel: Mesh } {
    const id = prop.instanceId
    const fa = -0.52   // face A (local -z)
    const fb = +0.52   // face B (local +z)
    const leftJamb1  = this.makeBox(`prop-wlj1-${id}`, 0.10, 0.82, 0.06, -0.33, 0.86, fa, FRAME_COLOR, 1, true)
    const rightJamb1 = this.makeBox(`prop-wrj1-${id}`, 0.10, 0.82, 0.06,  0.33, 0.86, fa, FRAME_COLOR, 1, true)
    const topRail1   = this.makeBox(`prop-wtr1-${id}`, 0.80, 0.08, 0.06,  0,    1.25, fa, FRAME_COLOR, 1, true)
    const botSill1   = this.makeBox(`prop-wbs1-${id}`, 0.80, 0.10, 0.06,  0,    0.47, fa, FRAME_COLOR, 1, true)
    const leftJamb2  = this.makeBox(`prop-wlj2-${id}`, 0.10, 0.82, 0.06, -0.33, 0.86, fb, FRAME_COLOR, 1, true)
    const rightJamb2 = this.makeBox(`prop-wrj2-${id}`, 0.10, 0.82, 0.06,  0.33, 0.86, fb, FRAME_COLOR, 1, true)
    const topRail2   = this.makeBox(`prop-wtr2-${id}`, 0.80, 0.08, 0.06,  0,    1.25, fb, FRAME_COLOR, 1, true)
    const botSill2   = this.makeBox(`prop-wbs2-${id}`, 0.80, 0.10, 0.06,  0,    0.47, fb, FRAME_COLOR, 1, true)
    // Glass centered in wall depth (renderingGroupId=1 renders over wall mesh so no z-fight)
    const glass = this.makeBox(`prop-wgl-${id}`, 0.65, 0.74, 0.96, 0, 0.86, 0, GLASS_COLOR, 0.4, true)
    glass.isVisible = prop.state.open !== true
    return {
      allMeshes: [leftJamb1, rightJamb1, topRail1, botSill1, leftJamb2, rightJamb2, topRail2, botSill2, glass],
      panel: glass,
    }
  }

  /** painting — wall-decor; canvas on exterior face at local z = -0.52 */
  private placePainting(prop: BuilderProp): { allMeshes: Mesh[] } {
    const id = prop.instanceId
    const wz = -0.52
    const canvas = this.makeBox(`prop-canvas-${id}`, 0.6,  0.4,  0.04, 0, 1.0, wz,        CANVAS_COLOR, 1, true)
    const inner  = this.makeBox(`prop-art-${id}`,    0.48, 0.28, 0.05, 0, 1.0, wz - 0.01, ART_COLOR,    1, true)
    return { allMeshes: [canvas, inner] }
  }

  /** rug — floor-decor */
  private placeRug(prop: BuilderProp): { allMeshes: Mesh[] } {
    const id     = prop.instanceId
    const base   = this.makeBox(`prop-rug-${id}`,     0.92, 0.08, 0.92, 0, 0.04,  0, RUG_COLOR)
    const center = this.makeBox(`prop-rug-ctr-${id}`, 0.66, 0.09, 0.66, 0, 0.045, 0, new Color3(0.75, 0.3, 0.35))
    return { allMeshes: [base, center] }
  }

  /** bartop — floor-object */
  private placeBartop(prop: BuilderProp): { allMeshes: Mesh[] } {
    const id     = prop.instanceId
    const top      = this.makeBox(`prop-btop-${id}`,  1.0,  0.1,  0.6,  0, 0.9,   0,     COUNTER_COLOR)
    const body     = this.makeBox(`prop-bbody-${id}`, 0.95, 0.85, 0.55, 0, 0.425, 0,     COUNTER_BODY)
    const footRail = this.makeBox(`prop-bfoot-${id}`, 0.8,  0.04, 0.04, 0, 0.1,  -0.25,  METAL_COLOR)
    return { allMeshes: [top, body, footRail] }
  }

  // ── Mesh factory ───────────────────────────────────────────────────────────

  private makeBox(
    name: string,
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    color: Color3,
    alpha = 1,
    twoSided = false,
  ): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene)
    mesh.position.set(x, y, z)   // local position — parented to root in place()
    mesh.renderingGroupId = 1
    const mat = new StandardMaterial(`${name}-mat`, this.scene)
    mat.diffuseColor  = color
    mat.emissiveColor = color.scale(0.3)
    mat.alpha         = alpha
    if (twoSided) mat.backFaceCulling = false
    mesh.material = mat
    return mesh
  }
}
