import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, Mesh } from '@babylonjs/core'

export const GRID_COLS = 20
export const GRID_ROWS = 20
export const CELL_SIZE = 1

export function createGrid(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround(
    'ground',
    { width: GRID_COLS * CELL_SIZE, height: GRID_ROWS * CELL_SIZE },
    scene,
  )
  const mat = new StandardMaterial('ground-mat', scene)
  mat.diffuseColor = new Color3(0.18, 0.18, 0.22)
  mat.specularColor = Color3.Black()
  ground.material = mat

  const lines: Vector3[][] = []
  const halfW = (GRID_COLS * CELL_SIZE) / 2
  const halfH = (GRID_ROWS * CELL_SIZE) / 2

  for (let c = 0; c <= GRID_COLS; c++) {
    const x = -halfW + c * CELL_SIZE
    lines.push([new Vector3(x, 0.01, -halfH), new Vector3(x, 0.01, halfH)])
  }
  for (let r = 0; r <= GRID_ROWS; r++) {
    const z = -halfH + r * CELL_SIZE
    lines.push([new Vector3(-halfW, 0.01, z), new Vector3(halfW, 0.01, z)])
  }
  const lineSystem = MeshBuilder.CreateLineSystem('grid-lines', { lines }, scene)
  lineSystem.color = new Color3(0.35, 0.35, 0.42)

  return ground
}

export function cellToWorld(col: number, row: number): { x: number; z: number } {
  const halfW = (GRID_COLS * CELL_SIZE) / 2
  const halfH = (GRID_ROWS * CELL_SIZE) / 2
  return {
    x: -halfW + col * CELL_SIZE + CELL_SIZE / 2,
    z: -halfH + row * CELL_SIZE + CELL_SIZE / 2,
  }
}

export function worldToCell(worldX: number, worldZ: number): { col: number; row: number } {
  const halfW = (GRID_COLS * CELL_SIZE) / 2
  const halfH = (GRID_ROWS * CELL_SIZE) / 2
  const col = Math.floor((worldX + halfW) / CELL_SIZE)
  const row = Math.floor((worldZ + halfH) / CELL_SIZE)
  return {
    col: Math.max(0, Math.min(GRID_COLS - 1, col)),
    row: Math.max(0, Math.min(GRID_ROWS - 1, row)),
  }
}
