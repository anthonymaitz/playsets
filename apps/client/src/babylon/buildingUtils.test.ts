import { describe, it, expect } from 'vitest'
import { normalizeRect, generateRoomTiles } from './buildingUtils'
import type { BuildingTile } from '../types'

describe('normalizeRect', () => {
  it('passes through already-normalized rect', () => {
    expect(normalizeRect({ startCol: 1, startRow: 1, endCol: 3, endRow: 3 }))
      .toEqual({ minCol: 1, minRow: 1, maxCol: 3, maxRow: 3 })
  })

  it('normalizes reversed drag (start > end)', () => {
    expect(normalizeRect({ startCol: 5, startRow: 5, endCol: 2, endRow: 1 }))
      .toEqual({ minCol: 2, minRow: 1, maxCol: 5, maxRow: 5 })
  })
})

describe('generateRoomTiles', () => {
  const noExisting: Record<string, BuildingTile> = {}

  it('1x1 room produces one wall tile', () => {
    const tiles = generateRoomTiles({ startCol: 2, startRow: 2, endCol: 2, endRow: 2 }, 'wall', 'floor', noExisting, 'walled')
    expect(tiles).toHaveLength(1)
    expect(tiles[0]).toMatchObject({ tileId: 'wall', col: 2, row: 2 })
  })

  it('2x2 room has 4 wall tiles and 0 floor tiles', () => {
    const tiles = generateRoomTiles({ startCol: 0, startRow: 0, endCol: 1, endRow: 1 }, 'wall', 'floor', noExisting, 'walled')
    expect(tiles).toHaveLength(4)
    expect(tiles.every((t) => t.tileId === 'wall')).toBe(true)
  })

  it('3x3 room has 8 walls and 1 floor', () => {
    const tiles = generateRoomTiles({ startCol: 0, startRow: 0, endCol: 2, endRow: 2 }, 'wall', 'floor', noExisting, 'walled')
    const walls = tiles.filter((t) => t.tileId === 'wall')
    const floors = tiles.filter((t) => t.tileId === 'floor')
    expect(walls).toHaveLength(8)
    expect(floors).toHaveLength(1)
    expect(floors[0]).toMatchObject({ col: 1, row: 1 })
  })

  it('4x3 room has 10 walls and 2 floors', () => {
    const tiles = generateRoomTiles({ startCol: 0, startRow: 0, endCol: 3, endRow: 2 }, 'wall', 'floor', noExisting, 'walled')
    expect(tiles.filter((t) => t.tileId === 'wall')).toHaveLength(10)
    expect(tiles.filter((t) => t.tileId === 'floor')).toHaveLength(2)
  })

  it('open merge mode skips positions occupied by existing tiles', () => {
    const existing: Record<string, BuildingTile> = {
      i1: { instanceId: 'i1', tileId: 'wall', col: 0, row: 0 },
    }
    const tiles = generateRoomTiles({ startCol: 0, startRow: 0, endCol: 1, endRow: 1 }, 'wall', 'floor', existing, 'open')
    expect(tiles.some((t) => t.col === 0 && t.row === 0)).toBe(false)
    expect(tiles).toHaveLength(3)
  })

  it('walled merge mode places tiles over existing', () => {
    const existing: Record<string, BuildingTile> = {
      i1: { instanceId: 'i1', tileId: 'wall', col: 0, row: 0 },
    }
    const tiles = generateRoomTiles({ startCol: 0, startRow: 0, endCol: 1, endRow: 1 }, 'wall', 'floor', existing, 'walled')
    expect(tiles).toHaveLength(4)
  })

  it('reversed drag normalizes to same result as forward drag', () => {
    const fwd = generateRoomTiles({ startCol: 0, startRow: 0, endCol: 2, endRow: 2 }, 'wall', 'floor', noExisting, 'walled')
    const rev = generateRoomTiles({ startCol: 2, startRow: 2, endCol: 0, endRow: 0 }, 'wall', 'floor', noExisting, 'walled')
    expect(rev).toHaveLength(fwd.length)
  })

  it('1xN corridor produces all wall tiles', () => {
    const tiles = generateRoomTiles({ startCol: 0, startRow: 0, endCol: 0, endRow: 4 }, 'wall', 'floor', noExisting, 'walled')
    expect(tiles.every((t) => t.tileId === 'wall')).toBe(true)
  })
})
