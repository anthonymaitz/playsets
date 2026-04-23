import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core'
import type { Roof } from '../types'
import { cellToWorld } from './grid'

const TILE_COLORS: Record<string, Color3> = {
  'roof-thatch':   new Color3(0.65, 0.55, 0.30),
  'roof-wood':     new Color3(0.45, 0.28, 0.12),
  'roof-stone':    new Color3(0.50, 0.50, 0.52),
  'roof-red-tile': new Color3(0.70, 0.25, 0.15),
}

const TOKEN_COLOR = new Color3(0.55, 0.25, 0.85)

interface RoofEntry {
  roof: Roof
  cellMeshes: Mesh[]
  token: Mesh | null
}

export class RoofManager {
  private entries = new Map<string, RoofEntry>()

  constructor(private scene: Scene, private isHost: boolean) {}

  place(roof: Roof): void {
    if (this.entries.has(roof.instanceId)) return
    const color = TILE_COLORS[roof.tileId] ?? TILE_COLORS['roof-thatch']

    const cellMeshes: Mesh[] = []
    for (const { col, row } of roof.cells) {
      const { x, z } = cellToWorld(col, row)
      const mesh = MeshBuilder.CreateBox(
        `roof-cell-${roof.instanceId}-${col}-${row}`,
        { width: 0.98, height: 0.06, depth: 0.98 },
        this.scene,
      )
      mesh.position.set(x, 1.70, z)
      mesh.renderingGroupId = 10
      mesh.isVisible = roof.visible
      const mat = new StandardMaterial(`roof-cell-mat-${roof.instanceId}-${col}-${row}`, this.scene)
      mat.diffuseColor = color
      mat.emissiveColor = color.scale(0.2)
      mesh.material = mat
      cellMeshes.push(mesh)
    }

    let token: Mesh | null = null
    if (this.isHost) {
      const { x, z } = cellToWorld(roof.tokenCol, roof.tokenRow)
      token = MeshBuilder.CreateBox(`roof-token-${roof.instanceId}`, { size: 0.28 }, this.scene)
      token.position.set(x, 1.95, z)
      token.renderingGroupId = 10
      token.metadata = { roofInstanceId: roof.instanceId }
      const mat = new StandardMaterial(`roof-token-mat-${roof.instanceId}`, this.scene)
      mat.diffuseColor = TOKEN_COLOR
      mat.emissiveColor = TOKEN_COLOR.scale(0.5)
      token.material = mat
    }

    this.entries.set(roof.instanceId, { roof, cellMeshes, token })
  }

  remove(instanceId: string): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    for (const m of entry.cellMeshes) { m.material?.dispose(); m.dispose() }
    if (entry.token) { entry.token.material?.dispose(); entry.token.dispose() }
    this.entries.delete(instanceId)
  }

  setVisible(instanceId: string, visible: boolean): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    entry.roof = { ...entry.roof, visible }
    for (const m of entry.cellMeshes) m.isVisible = visible
  }

  setTile(instanceId: string, tileId: string): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    entry.roof = { ...entry.roof, tileId }
    const color = TILE_COLORS[tileId] ?? TILE_COLORS['roof-thatch']
    for (const m of entry.cellMeshes) {
      const mat = m.material as StandardMaterial | null
      if (mat) {
        mat.diffuseColor = color
        mat.emissiveColor = color.scale(0.2)
      }
    }
  }

  loadSnapshot(roofs: Roof[]): void {
    for (const id of [...this.entries.keys()]) this.remove(id)
    for (const r of roofs) this.place(r)
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      for (const m of entry.cellMeshes) { m.material?.dispose(); m.dispose() }
      if (entry.token) { entry.token.material?.dispose(); entry.token.dispose() }
    }
    this.entries.clear()
  }
}
