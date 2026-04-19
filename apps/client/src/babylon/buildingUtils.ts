import type { BuildingTile } from '../types'

export interface RoomRect {
  startCol: number
  startRow: number
  endCol: number
  endRow: number
}

export interface NormalizedRect {
  minCol: number
  minRow: number
  maxCol: number
  maxRow: number
}

export function normalizeRect(rect: RoomRect): NormalizedRect {
  return {
    minCol: Math.min(rect.startCol, rect.endCol),
    minRow: Math.min(rect.startRow, rect.endRow),
    maxCol: Math.max(rect.startCol, rect.endCol),
    maxRow: Math.max(rect.startRow, rect.endRow),
  }
}

export function generateRoomTiles(
  rect: RoomRect,
  wallTileId: string,
  floorTileId: string,
  existingTiles: Record<string, BuildingTile>,
  mergeMode: 'open' | 'walled',
): Array<{ tileId: string; col: number; row: number }> {
  const { minCol, minRow, maxCol, maxRow } = normalizeRect(rect)

  const occupied = new Set<string>()
  if (mergeMode === 'open') {
    for (const tile of Object.values(existingTiles)) {
      occupied.add(`${tile.col},${tile.row}`)
    }
  }

  const result: Array<{ tileId: string; col: number; row: number }> = []
  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      if (mergeMode === 'open' && occupied.has(`${col},${row}`)) continue
      const isPerimeter = col === minCol || col === maxCol || row === minRow || row === maxRow
      result.push({ tileId: isPerimeter ? wallTileId : floorTileId, col, row })
    }
  }
  return result
}
