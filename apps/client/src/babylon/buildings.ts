import { Scene, MeshBuilder, StandardMaterial, Texture, Mesh, Vector3 } from '@babylonjs/core'
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
    const tex = new Texture(path, this.scene)
    tex.hasAlpha = true
    this.textureCache.set(path, tex)
    return tex
  }

  private createTilePlane(id: string, col: number, row: number, path: string, alpha = 1): Mesh {
    const plane = MeshBuilder.CreatePlane(`btile-${id}`, { size: CELL_SIZE }, this.scene)
    plane.rotation.x = Math.PI / 2
    const pos = cellToWorld(col, row)
    plane.position.set(pos.x, TILE_Y, pos.z)
    plane.renderingGroupId = 0
    const mat = new StandardMaterial(`bmat-${id}`, this.scene)
    mat.diffuseTexture = this.getOrLoadTexture(path)
    mat.useAlphaFromDiffuseTexture = true
    mat.alpha = alpha
    mat.backFaceCulling = false
    plane.material = mat
    return plane
  }

  placeTile(tile: BuildingTile, path: string): void {
    if (this.meshes.has(tile.instanceId)) return
    this.meshes.set(tile.instanceId, this.createTilePlane(tile.instanceId, tile.col, tile.row, path))
  }

  removeTile(instanceId: string): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    mesh.dispose(false, true)
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
    for (const mesh of this.meshes.values()) mesh.dispose(false, true)
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
  ): BuildingTile[] {
    if (!this.previewStartCell) return []
    this.clearPreview()
    const tileDefs = generateRoomTiles(
      { startCol: this.previewStartCell.col, startRow: this.previewStartCell.row, endCol, endRow },
      wallTileId,
      floorTileId,
      existingTiles,
      mergeMode,
    )
    const tiles: BuildingTile[] = tileDefs.map((def) => ({ instanceId: nanoid(), ...def }))
    for (const tile of tiles) this.placeTile(tile, this.tilePath(tile.tileId))
    this.previewStartCell = null
    return tiles
  }

  private clearPreview(): void {
    for (const mesh of this.previewMeshes) mesh.dispose(false, true)
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
