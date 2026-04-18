import { describe, it, expect } from 'vitest'
import { cellToWorld, worldToCell, GRID_COLS, GRID_ROWS, CELL_SIZE } from './grid'

describe('cellToWorld', () => {
  it('cell (0,0) maps to top-left corner center', () => {
    const { x, z } = cellToWorld(0, 0)
    const halfW = (GRID_COLS * CELL_SIZE) / 2
    const halfH = (GRID_ROWS * CELL_SIZE) / 2
    expect(x).toBeCloseTo(-halfW + CELL_SIZE / 2)
    expect(z).toBeCloseTo(-halfH + CELL_SIZE / 2)
  })

  it('cell (GRID_COLS-1, GRID_ROWS-1) maps to bottom-right corner center', () => {
    const { x, z } = cellToWorld(GRID_COLS - 1, GRID_ROWS - 1)
    const halfW = (GRID_COLS * CELL_SIZE) / 2
    const halfH = (GRID_ROWS * CELL_SIZE) / 2
    expect(x).toBeCloseTo(halfW - CELL_SIZE / 2)
    expect(z).toBeCloseTo(halfH - CELL_SIZE / 2)
  })

  it('cellToWorld and worldToCell are inverses for interior cells', () => {
    for (const [col, row] of [[3, 7], [10, 0], [0, 15], [19, 19]] as const) {
      const world = cellToWorld(col, row)
      const cell = worldToCell(world.x, world.z)
      expect(cell.col).toBe(col)
      expect(cell.row).toBe(row)
    }
  })
})

describe('worldToCell', () => {
  it('clamps out-of-bounds world coords to grid edges', () => {
    const { col } = worldToCell(-9999, 0)
    expect(col).toBe(0)
    const { row } = worldToCell(0, 9999)
    expect(row).toBe(GRID_ROWS - 1)
  })
})
