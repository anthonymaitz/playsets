import { describe, it, expect } from 'vitest'
import { cellToWorld, worldToCell, CELL_SIZE } from './grid'

describe('cellToWorld', () => {
  it('cell (0,0) center is at world (0.5, 0.5)', () => {
    const { x, z } = cellToWorld(0, 0)
    expect(x).toBeCloseTo(CELL_SIZE / 2)
    expect(z).toBeCloseTo(CELL_SIZE / 2)
  })

  it('cell (5, 3) center is at world (5.5, 3.5)', () => {
    const { x, z } = cellToWorld(5, 3)
    expect(x).toBeCloseTo(5.5)
    expect(z).toBeCloseTo(3.5)
  })

  it('negative cells work correctly', () => {
    const { x, z } = cellToWorld(-1, -1)
    expect(x).toBeCloseTo(-0.5)
    expect(z).toBeCloseTo(-0.5)
  })

  it('cellToWorld and worldToCell are inverses', () => {
    for (const [col, row] of [[-5, -3], [0, 0], [3, 7], [10, 0], [100, 200]] as const) {
      const world = cellToWorld(col, row)
      const cell = worldToCell(world.x, world.z)
      expect(cell.col).toBe(col)
      expect(cell.row).toBe(row)
    }
  })
})

describe('worldToCell', () => {
  it('maps world coordinates to the containing cell', () => {
    expect(worldToCell(0.5, 0.5).col).toBe(0)
    expect(worldToCell(1.0, 1.0).col).toBe(1)
    expect(worldToCell(-0.1, -0.1).col).toBe(-1)
  })

  it('supports arbitrary large coordinates', () => {
    const { col, row } = worldToCell(9999.5, -8888.5)
    expect(col).toBe(9999)
    expect(row).toBe(-8889)
  })
})
