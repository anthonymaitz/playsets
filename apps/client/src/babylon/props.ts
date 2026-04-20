import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core'
import type { BuilderProp } from '../types'
import type { BuildingManager } from './buildings'
import { cellToWorld } from './grid'

const FRAME_COLOR = new Color3(0.42, 0.26, 0.13)
const PANEL_COLOR = new Color3(0.6, 0.38, 0.18)

interface PropRenderEntry {
  prop: BuilderProp
  frameMeshes: Mesh[]
  panel: Mesh | null
}

export class PropManager {
  private entries = new Map<string, PropRenderEntry>()

  constructor(private scene: Scene) {}

  place(prop: BuilderProp, buildingManager: BuildingManager): void {
    if (this.entries.has(prop.instanceId)) return
    const { x, z } = cellToWorld(prop.col, prop.row)

    buildingManager.hideWallAt(prop.col, prop.row)

    const frameMeshes: Mesh[] = []
    const header = this.makeBox(`prop-header-${prop.instanceId}`, 1, 0.2, 0.15, x, 1.5, z, FRAME_COLOR)
    const leftJamb = this.makeBox(`prop-ljamb-${prop.instanceId}`, 0.15, 1.4, 0.15, x - 0.425, 0.7, z, FRAME_COLOR)
    const rightJamb = this.makeBox(`prop-rjamb-${prop.instanceId}`, 0.15, 1.4, 0.15, x + 0.425, 0.7, z, FRAME_COLOR)
    frameMeshes.push(header, leftJamb, rightJamb)

    const panel = this.makeBox(`prop-panel-${prop.instanceId}`, 0.7, 1.35, 0.08, x, 0.675, z, PANEL_COLOR)
    panel.isVisible = !prop.state.open

    this.entries.set(prop.instanceId, { prop, frameMeshes, panel })
  }

  remove(instanceId: string, buildingManager: BuildingManager): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    buildingManager.showWallAt(entry.prop.col, entry.prop.row)
    for (const m of entry.frameMeshes) { m.material?.dispose(); m.dispose() }
    if (entry.panel) { entry.panel.material?.dispose(); entry.panel.dispose() }
    this.entries.delete(instanceId)
  }

  setState(instanceId: string, state: Record<string, string | number | boolean>): void {
    const entry = this.entries.get(instanceId)
    if (!entry || !entry.panel) return
    entry.prop = { ...entry.prop, state }
    entry.panel.isVisible = !state.open
  }

  loadSnapshot(props: BuilderProp[], buildingManager: BuildingManager): void {
    this.clear(buildingManager)
    for (const p of props) this.place(p, buildingManager)
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
      for (const m of entry.frameMeshes) { m.material?.dispose(); m.dispose() }
      if (entry.panel) { entry.panel.material?.dispose(); entry.panel.dispose() }
    }
    this.entries.clear()
  }

  private makeBox(name: string, w: number, h: number, d: number, x: number, y: number, z: number, color: Color3): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene)
    mesh.position.set(x, y, z)
    mesh.renderingGroupId = 1
    const mat = new StandardMaterial(`${name}-mat`, this.scene)
    mat.diffuseColor = color
    mat.emissiveColor = color.scale(0.3)
    mesh.material = mat
    return mesh
  }
}
