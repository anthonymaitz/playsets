import { Scene, MeshBuilder, StandardMaterial, DynamicTexture, Texture, Mesh, Vector3 } from '@babylonjs/core'
import { cellToWorld, CELL_SIZE } from './grid'
import { generateRoomTiles, normalizeRect } from './buildingUtils'
import type { BuildingTile } from '../types'
import { nanoid } from 'nanoid'

const TILE_Y = 0.01

export class BuildingManager {
  private meshes = new Map<string, Mesh>()
  private textureCache = new Map<string, Texture>()
  private previewMeshes: Mesh[] = []
  private previewStartCell: { col: number; row: number } | null = null

  constructor(private scene: Scene) {}

  private getOrLoadTexture(path: string): Texture {
    if (this.textureCache.has(path)) return this.textureCache.get(path)!
    const SIZE = 64
    const dt = new DynamicTexture(`dtex-${path}`, { width: SIZE, height: SIZE }, this.scene, false)
    const ctx = dt.getContext() as CanvasRenderingContext2D
    const isWall = path.includes('wall')
    if (isWall) {
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.strokeStyle = '#6B3410'
      ctx.lineWidth = 3
      ctx.strokeRect(3, 3, SIZE - 6, SIZE - 6)
    } else {
      ctx.fillStyle = '#8B7355'
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.fillStyle = '#7A6245'
      ctx.fillRect(4, 4, 26, 26)
      ctx.fillRect(34, 34, 26, 26)
    }
    dt.update()
    this.textureCache.set(path, dt)
    return dt
  }

  private createTilePlane(id: string, col: number, row: number, path: string, alpha = 1): Mesh {
    const isWall = path.includes('wall')
    const pos = cellToWorld(col, row)
    let mesh: Mesh
    if (isWall) {
      mesh = MeshBuilder.CreateBox(`btile-${id}`, { width: CELL_SIZE, height: 1.6, depth: CELL_SIZE }, this.scene)
      mesh.position.set(pos.x, 0.8, pos.z)
    } else {
      mesh = MeshBuilder.CreatePlane(`btile-${id}`, { size: CELL_SIZE }, this.scene)
      mesh.rotation.x = Math.PI / 2
      mesh.position.set(pos.x, TILE_Y, pos.z)
    }
    mesh.renderingGroupId = 0
    const mat = new StandardMaterial(`bmat-${id}`, this.scene)
    const tex = this.getOrLoadTexture(path)
    mat.diffuseTexture = tex
    mat.emissiveTexture = tex
    mat.useAlphaFromDiffuseTexture = true
    mat.alpha = alpha
    mat.backFaceCulling = false
    mesh.material = mat
    return mesh
  }

  placeTile(tile: BuildingTile, path: string): void {
    if (this.meshes.has(tile.instanceId)) return
    this.meshes.set(tile.instanceId, this.createTilePlane(tile.instanceId, tile.col, tile.row, path))
  }

  removeTile(instanceId: string): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    const mat = mesh.material
    mesh.dispose()
    mat?.dispose()
    this.meshes.delete(instanceId)
  }

  loadSnapshot(tiles: BuildingTile[]): void {
    this.clearTiles()
    for (const tile of tiles) this.placeTile(tile, this.tilePath(tile.tileId))
  }

  private tilePath(tileId: string): string {
    return `/assets/tiles/${tileId}.svg`
  }

  private clearTiles(): void {
    for (const mesh of this.meshes.values()) {
      const mat = mesh.material
      mesh.dispose()
      mat?.dispose()
    }
    this.meshes.clear()
  }

  beginPreview(col: number, row: number): void {
    this.previewStartCell = { col, row }
    this.clearPreview()
  }

  setPreviewStart(col: number, row: number): void {
    this.previewStartCell = { col, row }
  }

  getPreviewStart(): { startCol: number; startRow: number } | null {
    if (!this.previewStartCell) return null
    return { startCol: this.previewStartCell.col, startRow: this.previewStartCell.row }
  }

  updatePreview(endCol: number, endRow: number, wallPath: string, floorPath: string): void {
    if (!this.previewStartCell) return
    this.clearPreview()
    const { minCol, minRow, maxCol, maxRow } = normalizeRect({
      startCol: this.previewStartCell.col,
      startRow: this.previewStartCell.row,
      endCol,
      endRow,
    })
    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const isPerimeter = col === minCol || col === maxCol || row === minRow || row === maxRow
        const mesh = this.createTilePlane(`preview-${col}-${row}`, col, row, isPerimeter ? wallPath : floorPath, 0.45)
        this.previewMeshes.push(mesh)
      }
    }
  }

  getPreviewWorldCorners(endCol: number, endRow: number): {
    nw: Vector3; ne: Vector3; sw: Vector3; se: Vector3; center: Vector3
  } | null {
    if (!this.previewStartCell) return null
    const { minCol, minRow, maxCol, maxRow } = normalizeRect({
      startCol: this.previewStartCell.col,
      startRow: this.previewStartCell.row,
      endCol,
      endRow,
    })
    const half = CELL_SIZE / 2
    const Y = 0.15
    const nw = cellToWorld(minCol, minRow)
    const ne = cellToWorld(maxCol, minRow)
    const sw = cellToWorld(minCol, maxRow)
    const se = cellToWorld(maxCol, maxRow)
    const cx = cellToWorld((minCol + maxCol) / 2, (minRow + maxRow) / 2)
    return {
      nw: new Vector3(nw.x - half, Y, nw.z - half),
      ne: new Vector3(ne.x + half, Y, ne.z - half),
      sw: new Vector3(sw.x - half, Y, sw.z + half),
      se: new Vector3(se.x + half, Y, se.z + half),
      center: new Vector3(cx.x, Y + 0.6, cx.z),
    }
  }

  cancelPreview(): void {
    this.clearPreview()
    this.previewStartCell = null
  }

  commitPreview(
    endCol: number,
    endRow: number,
    wallTileId: string,
    floorTileId: string,
    existingTiles: Record<string, BuildingTile>,
    mergeMode: 'open' | 'walled',
  ): { tiles: BuildingTile[], removedIds: string[] } {
    if (!this.previewStartCell) return { tiles: [], removedIds: [] }
    this.clearPreview()

    const { minCol, minRow, maxCol, maxRow } = normalizeRect({
      startCol: this.previewStartCell.col,
      startRow: this.previewStartCell.row,
      endCol,
      endRow,
    })

    const removedIds: string[] = []
    let effectiveTiles = existingTiles

    if (mergeMode === 'open') {
      // Clear Room 2's entire footprint — normalization pass below fixes all type issues
      const filtered: Record<string, BuildingTile> = {}
      for (const [id, tile] of Object.entries(existingTiles)) {
        if (tile.col >= minCol && tile.col <= maxCol && tile.row >= minRow && tile.row <= maxRow) {
          removedIds.push(id)
          this.removeTile(id)
        } else {
          filtered[id] = tile
        }
      }
      effectiveTiles = filtered
    }

    const tileDefs = generateRoomTiles(
      { startCol: this.previewStartCell.col, startRow: this.previewStartCell.row, endCol, endRow },
      wallTileId,
      floorTileId,
      effectiveTiles,
      mergeMode,
    )
    const newTiles: BuildingTile[] = tileDefs.map((def) => ({ instanceId: nanoid(), ...def }))
    for (const tile of newTiles) this.placeTile(tile, this.tilePath(tile.tileId))
    this.previewStartCell = null

    if (mergeMode !== 'open') return { tiles: newTiles, removedIds }

    // Build position-keyed view of all tiles after placement
    const allAfter: Record<string, BuildingTile> = { ...effectiveTiles }
    for (const t of newTiles) allAfter[t.instanceId] = t
    const occupied = new Set(Object.values(allAfter).map(t => `${t.col},${t.row}`))

    // Pass 1: edge detection — painted cell with any empty cardinal neighbor → wall
    type PosEntry = { tile: BuildingTile; correctType: 'wall' | 'floor'; inExisting: boolean }
    const posMap = new Map<string, PosEntry>()
    for (const [id, tile] of Object.entries(allAfter)) {
      const hasEmptyNeighbor =
        !occupied.has(`${tile.col - 1},${tile.row}`) ||
        !occupied.has(`${tile.col + 1},${tile.row}`) ||
        !occupied.has(`${tile.col},${tile.row - 1}`) ||
        !occupied.has(`${tile.col},${tile.row + 1}`)
      posMap.set(`${tile.col},${tile.row}`, {
        tile,
        correctType: hasEmptyNeighbor ? 'wall' : 'floor',
        inExisting: id in existingTiles,
      })
    }

    // Pass 2: inner corner — a floor tile diagonal to two perpendicular walls
    // (whose shared diagonal is not a wall) closes a concave perimeter gap.
    // Walls sit on painted floor tiles only; no new cells are added outside the room.
    const diags: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
    for (const [key, entry] of posMap) {
      if (entry.correctType !== 'floor') continue
      const col = entry.tile.col
      const row = entry.tile.row
      for (const [dc, dr] of diags) {
        const hWall = posMap.get(`${col + dc},${row}`)?.correctType === 'wall'
        const vWall = posMap.get(`${col},${row + dr}`)?.correctType === 'wall'
        const diagWall = posMap.get(`${col + dc},${row + dr}`)?.correctType === 'wall'
        if (hWall && vWall && !diagWall) {
          entry.correctType = 'wall'
          break
        }
      }
    }

    // Pass 3: apply corrections — dispose mistyped meshes, place correct ones
    const finalTiles: BuildingTile[] = []
    for (const entry of posMap.values()) {
      const currentType = entry.tile.tileId.includes('wall') ? 'wall' : 'floor'
      if (currentType === entry.correctType) {
        if (!entry.inExisting) finalTiles.push(entry.tile)
        continue
      }
      const correctTileId = entry.correctType === 'wall' ? wallTileId : floorTileId
      this.removeTile(entry.tile.instanceId)
      const fixed: BuildingTile = { instanceId: nanoid(), tileId: correctTileId, col: entry.tile.col, row: entry.tile.row }
      this.placeTile(fixed, this.tilePath(correctTileId))
      finalTiles.push(fixed)
      if (entry.inExisting) removedIds.push(entry.tile.instanceId)
    }

    return { tiles: finalTiles, removedIds }
  }

  private clearPreview(): void {
    for (const mesh of this.previewMeshes) {
      const mat = mesh.material
      mesh.dispose()
      mat?.dispose()
    }
    this.previewMeshes = []
  }

  reset(): void {
    this.clearTiles()
    this.cancelPreview()
  }

  dispose(): void {
    this.reset()
    for (const tex of this.textureCache.values()) tex.dispose()
    this.textureCache.clear()
  }
}
