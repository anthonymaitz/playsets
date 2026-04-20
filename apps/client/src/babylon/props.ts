import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core'
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
  'window-wood': 'punch-through',
  'painting':    'wall-decor',
  'rug':         'floor-decor',
  'bartop':      'floor-object',
}

/** Derive category from propId. Falls back to 'floor-object' for unknown props. */
export function getPropCategory(propId: string): PropCategory {
  return PROP_CATEGORIES[propId] ?? 'floor-object'
}

// ── Entry ────────────────────────────────────────────────────────────────────
interface PropRenderEntry {
  prop: BuilderProp
  category: PropCategory
  allMeshes: Mesh[]      // ALL meshes — used for dispose and move
  panel: Mesh | null     // togglable mesh (door panel, window glass) or null
}

// ── Manager ──────────────────────────────────────────────────────────────────
export class PropManager {
  private entries = new Map<string, PropRenderEntry>()

  constructor(private scene: Scene) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  place(prop: BuilderProp, category: PropCategory, buildingManager: BuildingManager): void {
    if (this.entries.has(prop.instanceId)) return
    const { x, z } = cellToWorld(prop.col, prop.row)

    let allMeshes: Mesh[] = []
    let panel: Mesh | null = null

    switch (prop.propId) {
      case 'door-wood':
        ;({ allMeshes, panel } = this.placeDoor(prop, x, z))
        buildingManager.hideWallAt(prop.col, prop.row)
        break

      case 'window-wood':
        ;({ allMeshes, panel } = this.placeWindow(prop, x, z))
        buildingManager.hideWallAt(prop.col, prop.row)
        break

      case 'painting':
        ;({ allMeshes } = this.placePainting(prop, x, z))
        // wall-decor: wall stays visible
        break

      case 'rug':
        ;({ allMeshes } = this.placeRug(prop, x, z))
        break

      case 'bartop':
        ;({ allMeshes } = this.placeBartop(prop, x, z))
        break

      default:
        console.warn(`[PropManager] Unknown propId: ${prop.propId}`)
        return
    }

    // Tag every mesh for picking
    for (const m of allMeshes) {
      m.metadata = { propInstanceId: prop.instanceId }
    }

    this.entries.set(prop.instanceId, { prop, category, allMeshes, panel })
  }

  remove(instanceId: string, buildingManager: BuildingManager): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    if (entry.category === 'punch-through') {
      buildingManager.showWallAt(entry.prop.col, entry.prop.row)
    }
    for (const m of entry.allMeshes) { m.material?.dispose(); m.dispose() }
    this.entries.delete(instanceId)
  }

  setState(instanceId: string, state: Record<string, string | number | boolean>): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    entry.prop = { ...entry.prop, state }
    if (entry.panel) {
      // door panel: hidden when open; window glass: hidden when open
      entry.panel.isVisible = state.open !== true
    }
  }

  move(instanceId: string, col: number, row: number, buildingManager: BuildingManager): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    const oldProp = entry.prop
    // Restore old position if punch-through
    if (entry.category === 'punch-through') buildingManager.showWallAt(oldProp.col, oldProp.row)
    // Update stored position
    entry.prop = { ...entry.prop, col, row }
    // Hide new wall if punch-through
    if (entry.category === 'punch-through') buildingManager.hideWallAt(col, row)
    // Move all meshes by delta
    const { x: oldX, z: oldZ } = cellToWorld(oldProp.col, oldProp.row)
    const { x: newX, z: newZ } = cellToWorld(col, row)
    const dx = newX - oldX
    const dz = newZ - oldZ
    for (const m of entry.allMeshes) {
      m.position.x += dx
      m.position.z += dz
    }
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

  dispose(): void {
    for (const entry of this.entries.values()) {
      for (const m of entry.allMeshes) { m.material?.dispose(); m.dispose() }
    }
    this.entries.clear()
  }

  // ── Prop builders ──────────────────────────────────────────────────────────

  /** door-wood — punch-through */
  private placeDoor(prop: BuilderProp, x: number, z: number): { allMeshes: Mesh[]; panel: Mesh } {
    const id = prop.instanceId
    const header    = this.makeBox(`prop-header-${id}`,  1,    0.2,  0.15, x,          1.5,   z, FRAME_COLOR)
    const leftJamb  = this.makeBox(`prop-ljamb-${id}`,   0.15, 1.4,  0.15, x - 0.425, 0.7,   z, FRAME_COLOR)
    const rightJamb = this.makeBox(`prop-rjamb-${id}`,   0.15, 1.4,  0.15, x + 0.425, 0.7,   z, FRAME_COLOR)
    const panel     = this.makeBox(`prop-panel-${id}`,   0.7,  1.35, 0.08, x,          0.675, z, PANEL_COLOR)
    panel.isVisible = prop.state.open !== true
    return { allMeshes: [header, leftJamb, rightJamb, panel], panel }
  }

  /** window-wood — punch-through, fills full wall cell slot with opening + glass */
  private placeWindow(prop: BuilderProp, x: number, z: number): { allMeshes: Mesh[]; panel: Mesh } {
    const id = prop.instanceId
    // Side pillars fill full cell height, blending with surrounding walls
    const leftPillar  = this.makeBox(`prop-wlp-${id}`,   0.15, 1.6,  0.15, x - 0.425, 0.8,  z, FRAME_COLOR)
    const rightPillar = this.makeBox(`prop-wrp-${id}`,   0.15, 1.6,  0.15, x + 0.425, 0.8,  z, FRAME_COLOR)
    // Top and bottom fills close the wall slot above/below the opening
    const topFill     = this.makeBox(`prop-wtf-${id}`,   0.7,  0.5,  0.15, x,          1.35, z, FRAME_COLOR)
    const botFill     = this.makeBox(`prop-wbf-${id}`,   0.7,  0.4,  0.15, x,          0.2,  z, FRAME_COLOR)
    // Sill at bottom of opening
    const sill        = this.makeBox(`prop-wsill-${id}`, 0.72, 0.06, 0.12, x,          0.43, z, new Color3(0.55, 0.34, 0.16))
    // Glass pane in the opening (hidden when open)
    const glass       = this.makeBox(`prop-wglass-${id}`, 0.66, 0.6, 0.04, x,          0.76, z, GLASS_COLOR, 0.5)
    glass.isVisible = prop.state.open !== true
    return { allMeshes: [leftPillar, rightPillar, topFill, botFill, sill, glass], panel: glass }
  }

  /** painting — wall-decor; rendered just outside wall's near face (z - 0.52) */
  private placePainting(prop: BuilderProp, x: number, z: number): { allMeshes: Mesh[] } {
    const id = prop.instanceId
    // Wall box near face is at z - 0.5; offset just outside so depth test passes
    const wz = z - 0.52
    const canvas = this.makeBox(`prop-canvas-${id}`, 0.6,  0.4,  0.04, x, 1.0, wz,        CANVAS_COLOR, 1, true)
    const inner  = this.makeBox(`prop-art-${id}`,    0.48, 0.28, 0.05, x, 1.0, wz - 0.01, ART_COLOR,    1, true)
    return { allMeshes: [canvas, inner] }
  }

  /** rug — floor-decor */
  private placeRug(prop: BuilderProp, x: number, z: number): { allMeshes: Mesh[] } {
    const id     = prop.instanceId
    const base   = this.makeBox(`prop-rug-${id}`,       0.92, 0.08, 0.92, x, 0.04, z, RUG_COLOR)
    const center = this.makeBox(`prop-rug-ctr-${id}`,   0.66, 0.09, 0.66, x, 0.045, z, new Color3(0.75, 0.3, 0.35))
    return { allMeshes: [base, center] }
  }

  /** bartop — floor-object */
  private placeBartop(prop: BuilderProp, x: number, z: number): { allMeshes: Mesh[] } {
    const id       = prop.instanceId
    const top      = this.makeBox(`prop-btop-${id}`,  1.0,  0.1,  0.6,  x, 0.9,   z,          COUNTER_COLOR)
    const body     = this.makeBox(`prop-bbody-${id}`, 0.95, 0.85, 0.55, x, 0.425, z,          COUNTER_BODY)
    const footRail = this.makeBox(`prop-bfoot-${id}`, 0.8,  0.04, 0.04, x, 0.1,   z - 0.25,  METAL_COLOR)
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
    mesh.position.set(x, y, z)
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
