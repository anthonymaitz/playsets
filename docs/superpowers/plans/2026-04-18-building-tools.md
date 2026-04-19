# Building Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a host-only building mode where rectangular rooms are defined by drag-and-resize on the isometric grid, previewed in-scene, then committed as individual cell-sized wall/floor tiles that sync to guests.

**Architecture:** `BuildingManager` (new, parallel to `SpriteManager`) handles tile mesh rendering and the room preview in BabylonJS. A `generateRoomTiles` pure function (separately testable) converts a rect definition into tile positions. Building state lives in a new `buildingTiles` slice on the existing room store. Three new React components handle the bottom palette, the floating in-world control strip, and the corner resize handles. `HostSession` and `GuestSession` each gain a `BuildingManager` reference and handle `building:*` messages.

**Tech Stack:** TypeScript, React 18, BabylonJS 7, Zustand, nanoid, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Modify | `BuildingTile`, `TileCategory`, `TileManifestEntry`, `building:*` GameMessages |
| `src/store/room.ts` | Modify | `buildingTiles` slice |
| `src/babylon/buildingUtils.ts` | Create | `generateRoomTiles`, `normalizeRect` pure functions |
| `src/babylon/buildings.ts` | Create | `BuildingManager` — tile render + preview |
| `src/components/BuildingPalette.tsx` | Create | Bottom palette: wall row, floor row, Build/Erase toggle |
| `src/components/BuildingControls.tsx` | Create | Floating strip (size chip, Open/Walled, Place Room) + corner handles |
| `src/pages/RoomPage.tsx` | Modify | Building mode state, pointer handling, projection loop, toolbar button |
| `src/networking/host.ts` | Modify | `building:*` message handling + snapshot on join |
| `src/networking/guest.ts` | Modify | `building:*` message handling |
| `src/networking/messages.ts` | Modify | `sendBuildingSnapshot` helper |
| `public/assets/tiles/manifest.json` | Create | Tile catalogue |
| `public/assets/tiles/*.svg` | Create | Placeholder tile art |

---

## Task 1: Extend types.ts

**Files:**
- Modify: `apps/client/src/types.ts`

- [ ] **Step 1: Add building types**

Open `apps/client/src/types.ts` and append after the `SpriteManifest` interface:

```ts
export interface BuildingTile {
  instanceId: string
  tileId: string
  col: number
  row: number
}

export type TileCategory = 'wall' | 'floor'

export interface TileManifestEntry {
  id: string
  label: string
  path: string
  category: TileCategory
}
```

- [ ] **Step 2: Add building messages to GameMessage union**

In the `GameMessage` type, add three new variants after the `player:leave` line:

```ts
  | { type: 'building:place'; tile: BuildingTile }
  | { type: 'building:remove'; instanceId: string }
  | { type: 'building:snapshot'; tiles: BuildingTile[] }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "apps/client" && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/types.ts
git commit -m "feat(building): add BuildingTile types and building:* messages"
```

---

## Task 2: Extend room store

**Files:**
- Modify: `apps/client/src/store/room.ts`
- Modify: `apps/client/src/store/room.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `apps/client/src/store/room.test.ts` (after the existing describe block):

```ts
describe('useRoomStore — building tiles', () => {
  beforeEach(() => {
    useRoomStore.getState().reset()
  })

  it('starts with empty buildingTiles', () => {
    expect(Object.keys(useRoomStore.getState().buildingTiles)).toHaveLength(0)
  })

  it('placeTile adds a tile', () => {
    useRoomStore.getState().placeTile({ instanceId: 'b1', tileId: 'wall-wood', col: 2, row: 3 })
    expect(useRoomStore.getState().buildingTiles['b1']).toMatchObject({ col: 2, row: 3 })
  })

  it('removeTile deletes the tile', () => {
    useRoomStore.getState().placeTile({ instanceId: 'b1', tileId: 'wall-wood', col: 2, row: 3 })
    useRoomStore.getState().removeTile('b1')
    expect(useRoomStore.getState().buildingTiles['b1']).toBeUndefined()
  })

  it('loadBuildingSnapshot replaces all tiles', () => {
    useRoomStore.getState().placeTile({ instanceId: 'old', tileId: 'wall-wood', col: 0, row: 0 })
    useRoomStore.getState().loadBuildingSnapshot([
      { instanceId: 'new1', tileId: 'floor-dirt', col: 1, row: 1 },
    ])
    expect(useRoomStore.getState().buildingTiles['old']).toBeUndefined()
    expect(useRoomStore.getState().buildingTiles['new1']).toBeDefined()
  })

  it('reset clears buildingTiles', () => {
    useRoomStore.getState().placeTile({ instanceId: 'b1', tileId: 'wall-wood', col: 0, row: 0 })
    useRoomStore.getState().reset()
    expect(Object.keys(useRoomStore.getState().buildingTiles)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "apps/client" && pnpm test --run
```

Expected: 5 new failures — `buildingTiles`, `placeTile`, `removeTile`, `loadBuildingSnapshot` not found.

- [ ] **Step 3: Extend the store**

In `apps/client/src/store/room.ts`, add to the `RoomStore` interface:

```ts
  buildingTiles: Record<string, BuildingTile>
  placeTile: (t: BuildingTile) => void
  removeTile: (instanceId: string) => void
  loadBuildingSnapshot: (tiles: BuildingTile[]) => void
```

Add the import at the top:

```ts
import type { SpriteInstance, FacingDir, AnimationName, BuildingTile } from '../types'
```

In the `create<RoomStore>` call, add after `sprites: {}`:

```ts
  buildingTiles: {},
  placeTile: (t) => set((state) => ({ buildingTiles: { ...state.buildingTiles, [t.instanceId]: t } })),
  removeTile: (instanceId) =>
    set((state) => {
      const next = { ...state.buildingTiles }
      delete next[instanceId]
      return { buildingTiles: next }
    }),
  loadBuildingSnapshot: (tiles) =>
    set({ buildingTiles: Object.fromEntries(tiles.map((t) => [t.instanceId, t])) }),
```

Update `reset`:

```ts
  reset: () => set({ roomId: null, sprites: {}, buildingTiles: {} }),
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "apps/client" && pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/store/room.ts apps/client/src/store/room.test.ts
git commit -m "feat(building): add buildingTiles slice to room store"
```

---

## Task 3: Tile generation utility

**Files:**
- Create: `apps/client/src/babylon/buildingUtils.ts`
- Create: `apps/client/src/babylon/buildingUtils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/client/src/babylon/buildingUtils.test.ts`:

```ts
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

  it('1×1 room produces one wall tile', () => {
    const tiles = generateRoomTiles({ startCol: 2, startRow: 2, endCol: 2, endRow: 2 }, 'wall', 'floor', noExisting, 'walled')
    expect(tiles).toHaveLength(1)
    expect(tiles[0]).toMatchObject({ tileId: 'wall', col: 2, row: 2 })
  })

  it('2×2 room has 4 wall tiles and 0 floor tiles', () => {
    const tiles = generateRoomTiles({ startCol: 0, startRow: 0, endCol: 1, endRow: 1 }, 'wall', 'floor', noExisting, 'walled')
    expect(tiles).toHaveLength(4)
    expect(tiles.every((t) => t.tileId === 'wall')).toBe(true)
  })

  it('3×3 room has 8 walls and 1 floor', () => {
    const tiles = generateRoomTiles({ startCol: 0, startRow: 0, endCol: 2, endRow: 2 }, 'wall', 'floor', noExisting, 'walled')
    const walls = tiles.filter((t) => t.tileId === 'wall')
    const floors = tiles.filter((t) => t.tileId === 'floor')
    expect(walls).toHaveLength(8)
    expect(floors).toHaveLength(1)
    expect(floors[0]).toMatchObject({ col: 1, row: 1 })
  })

  it('4×3 room has 10 walls and 2 floors', () => {
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

  it('1×N corridor produces all wall tiles', () => {
    const tiles = generateRoomTiles({ startCol: 0, startRow: 0, endCol: 0, endRow: 4 }, 'wall', 'floor', noExisting, 'walled')
    expect(tiles.every((t) => t.tileId === 'wall')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "apps/client" && pnpm test --run
```

Expected: new test file fails — `buildingUtils` module not found.

- [ ] **Step 3: Implement buildingUtils.ts**

Create `apps/client/src/babylon/buildingUtils.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "apps/client" && pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/babylon/buildingUtils.ts apps/client/src/babylon/buildingUtils.test.ts
git commit -m "feat(building): add generateRoomTiles utility with tests"
```

---

## Task 4: BuildingManager

**Files:**
- Create: `apps/client/src/babylon/buildings.ts`

- [ ] **Step 1: Create BuildingManager**

Create `apps/client/src/babylon/buildings.ts`:

```ts
import { Scene, MeshBuilder, StandardMaterial, Texture, Mesh, Vector3, Matrix } from '@babylonjs/core'
import { cellToWorld, CELL_SIZE } from './grid'
import { generateRoomTiles, normalizeRect } from './buildingUtils'
import type { RoomRect } from './buildingUtils'
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

  // --- Render ---

  placeTile(tile: BuildingTile, path: string): void {
    if (this.meshes.has(tile.instanceId)) return
    this.meshes.set(tile.instanceId, this.createTilePlane(tile.instanceId, tile.col, tile.row, path))
  }

  removeTile(instanceId: string): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    mesh.dispose()
    this.meshes.delete(instanceId)
  }

  loadSnapshot(tiles: BuildingTile[]): void {
    this.clearTiles()
    for (const tile of tiles) this.placeTile(tile, `/assets/tiles/${tile.tileId}.svg`)
  }

  private clearTiles(): void {
    for (const mesh of this.meshes.values()) mesh.dispose()
    this.meshes.clear()
  }

  // --- Preview ---

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
    for (const tile of tiles) this.placeTile(tile, `/assets/tiles/${tile.tileId}.svg`)
    this.previewStartCell = null
    return tiles
  }

  private clearPreview(): void {
    for (const mesh of this.previewMeshes) mesh.dispose()
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "apps/client" && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/babylon/buildings.ts
git commit -m "feat(building): add BuildingManager with render and preview"
```

---

## Task 5: Tile assets

**Files:**
- Create: `public/assets/tiles/manifest.json`
- Create: `public/assets/tiles/wall-wood.svg`
- Create: `public/assets/tiles/wall-stone.svg`
- Create: `public/assets/tiles/floor-dirt.svg`
- Create: `public/assets/tiles/floor-stone.svg`

- [ ] **Step 1: Create manifest**

Create `apps/client/public/assets/tiles/manifest.json`:

```json
{
  "tiles": [
    { "id": "wall-wood",   "label": "Wood Wall",   "path": "/assets/tiles/wall-wood.svg",   "category": "wall"  },
    { "id": "wall-stone",  "label": "Stone Wall",  "path": "/assets/tiles/wall-stone.svg",  "category": "wall"  },
    { "id": "floor-dirt",  "label": "Dirt Floor",  "path": "/assets/tiles/floor-dirt.svg",  "category": "floor" },
    { "id": "floor-stone", "label": "Stone Floor", "path": "/assets/tiles/floor-stone.svg", "category": "floor" }
  ]
}
```

- [ ] **Step 2: Create placeholder tile SVGs**

Create `apps/client/public/assets/tiles/wall-wood.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#8B4513" rx="2"/>
  <line x1="0" y1="21" x2="64" y2="21" stroke="#6B3410" stroke-width="2"/>
  <line x1="0" y1="43" x2="64" y2="43" stroke="#6B3410" stroke-width="2"/>
  <line x1="32" y1="0" x2="32" y2="21" stroke="#6B3410" stroke-width="1"/>
  <line x1="16" y1="21" x2="16" y2="43" stroke="#6B3410" stroke-width="1"/>
  <line x1="48" y1="43" x2="48" y2="64" stroke="#6B3410" stroke-width="1"/>
</svg>
```

Create `apps/client/public/assets/tiles/wall-stone.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#696969" rx="2"/>
  <rect x="2" y="2" width="28" height="18" fill="#787878" rx="1"/>
  <rect x="34" y="2" width="28" height="18" fill="#787878" rx="1"/>
  <rect x="2" y="24" width="18" height="18" fill="#787878" rx="1"/>
  <rect x="24" y="24" width="18" height="18" fill="#787878" rx="1"/>
  <rect x="46" y="24" width="16" height="18" fill="#787878" rx="1"/>
  <rect x="2" y="46" width="28" height="16" fill="#787878" rx="1"/>
  <rect x="34" y="46" width="28" height="16" fill="#787878" rx="1"/>
</svg>
```

Create `apps/client/public/assets/tiles/floor-dirt.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#8B7355"/>
  <circle cx="12" cy="15" r="2" fill="#7A6245" opacity="0.6"/>
  <circle cx="40" cy="8" r="1.5" fill="#7A6245" opacity="0.6"/>
  <circle cx="55" cy="30" r="2" fill="#7A6245" opacity="0.6"/>
  <circle cx="20" cy="48" r="1.5" fill="#7A6245" opacity="0.6"/>
  <circle cx="45" cy="52" r="2" fill="#7A6245" opacity="0.6"/>
  <circle cx="8" cy="38" r="1" fill="#9A8365" opacity="0.5"/>
  <circle cx="35" cy="35" r="1.5" fill="#9A8365" opacity="0.5"/>
</svg>
```

Create `apps/client/public/assets/tiles/floor-stone.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#555555"/>
  <rect x="2" y="2" width="28" height="28" fill="#5e5e5e" rx="1"/>
  <rect x="34" y="2" width="28" height="28" fill="#5e5e5e" rx="1"/>
  <rect x="2" y="34" width="28" height="28" fill="#5e5e5e" rx="1"/>
  <rect x="34" y="34" width="28" height="28" fill="#5e5e5e" rx="1"/>
</svg>
```

- [ ] **Step 3: Verify Vite serves the assets**

```bash
cd "apps/client" && pnpm dev
```

Open `http://localhost:5173/assets/tiles/manifest.json` — should return JSON.
Open `http://localhost:5173/assets/tiles/wall-wood.svg` — should show the brown SVG.

- [ ] **Step 4: Commit**

```bash
git add apps/client/public/assets/tiles/
git commit -m "feat(building): add tile manifest and placeholder SVG tiles"
```

---

## Task 6: BuildingPalette component

**Files:**
- Create: `apps/client/src/components/BuildingPalette.tsx`

- [ ] **Step 1: Create the component**

Create `apps/client/src/components/BuildingPalette.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { TileManifestEntry, TileCategory } from '../types'

interface Props {
  wallTileId: string
  floorTileId: string
  mode: 'build' | 'erase'
  onWallSelect: (tileId: string) => void
  onFloorSelect: (tileId: string) => void
  onModeChange: (mode: 'build' | 'erase') => void
}

export function BuildingPalette({ wallTileId, floorTileId, mode, onWallSelect, onFloorSelect, onModeChange }: Props) {
  const [tiles, setTiles] = useState<TileManifestEntry[]>([])

  useEffect(() => {
    fetch('/assets/tiles/manifest.json')
      .then((r) => r.json())
      .then((data: { tiles: TileManifestEntry[] }) => setTiles(data.tiles))
      .catch(() => {})
  }, [])

  const byCategory = (cat: TileCategory) => tiles.filter((t) => t.category === cat)

  const Row = ({ category, selectedId, onSelect }: { category: TileCategory; selectedId: string; onSelect: (id: string) => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 36, fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 }}>
        {category}
      </span>
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto' }}>
        {byCategory(category).map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            title={t.label}
            style={{
              width: 40, height: 40, flexShrink: 0, border: '2px solid',
              borderColor: selectedId === t.id ? '#f0a84a' : 'rgba(255,255,255,0.1)',
              borderRadius: 4, background: 'rgba(255,255,255,0.06)',
              cursor: 'pointer', padding: 2, overflow: 'hidden',
            }}
          >
            <img src={t.path} alt={t.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 44, right: 0,
      background: 'rgba(10,15,10,0.92)', borderTop: '1px solid rgba(255,255,255,0.1)',
      padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <Row category="wall" selectedId={wallTileId} onSelect={onWallSelect} />
        <Row category="floor" selectedId={floorTileId} onSelect={onFloorSelect} />
      </div>
      <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
        {(['build', 'erase'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: mode === m ? '#c8893a' : 'rgba(255,255,255,0.06)',
              color: mode === m ? '#000' : 'rgba(255,255,255,0.5)',
              textTransform: 'capitalize',
            }}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "apps/client" && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/BuildingPalette.tsx
git commit -m "feat(building): add BuildingPalette component"
```

---

## Task 7: BuildingControls component

**Files:**
- Create: `apps/client/src/components/BuildingControls.tsx`

- [ ] **Step 1: Create the component**

Create `apps/client/src/components/BuildingControls.tsx`:

```tsx
import { useEffect, useRef } from 'react'

export interface ScreenCorners {
  nw: { x: number; y: number }
  ne: { x: number; y: number }
  sw: { x: number; y: number }
  se: { x: number; y: number }
  center: { x: number; y: number }
  width: number
  height: number
}

interface Props {
  corners: ScreenCorners | null
  mergeMode: 'open' | 'walled'
  onMergeModeChange: (m: 'open' | 'walled') => void
  onPlace: () => void
  onCornerDragStart: (corner: 'nw' | 'ne' | 'sw' | 'se') => void
}

const HANDLE_SIZE = 16

export function BuildingControls({ corners, mergeMode, onMergeModeChange, onPlace, onCornerDragStart }: Props) {
  if (!corners) return null

  const Handle = ({ corner, pos }: { corner: 'nw' | 'ne' | 'sw' | 'se'; pos: { x: number; y: number } }) => (
    <div
      onPointerDown={(e) => { e.stopPropagation(); onCornerDragStart(corner) }}
      style={{
        position: 'absolute',
        left: pos.x - HANDLE_SIZE / 2,
        top: pos.y - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        background: '#fff',
        border: '2px solid #c8893a',
        borderRadius: 3,
        cursor: 'crosshair',
        touchAction: 'none',
        boxShadow: '0 1px 6px rgba(0,0,0,0.5)',
        zIndex: 10,
      }}
    />
  )

  return (
    <>
      <Handle corner="nw" pos={corners.nw} />
      <Handle corner="ne" pos={corners.ne} />
      <Handle corner="sw" pos={corners.sw} />
      <Handle corner="se" pos={corners.se} />

      {/* Floating control strip */}
      <div style={{
        position: 'absolute',
        left: corners.center.x,
        top: corners.center.y,
        transform: 'translate(-50%, -100%)',
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(10,15,10,0.88)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 8, padding: '6px 10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'auto',
      }}>
        <span style={{ color: 'rgba(200,137,58,0.9)', fontSize: 11, fontFamily: 'monospace', paddingRight: 6, borderRight: '1px solid rgba(255,255,255,0.1)' }}>
          {corners.width} × {corners.height}
        </span>

        <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
          {(['open', 'walled'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onMergeModeChange(m)}
              style={{
                padding: '4px 8px', fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: mergeMode === m ? '#c8893a' : 'rgba(255,255,255,0.06)',
                color: mergeMode === m ? '#000' : 'rgba(255,255,255,0.45)',
                textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

        <button
          onClick={onPlace}
          style={{
            padding: '5px 14px', borderRadius: 5, background: '#4a7a40', color: '#fff',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', letterSpacing: 0.3,
          }}
        >
          Place Room
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "apps/client" && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/BuildingControls.tsx
git commit -m "feat(building): add BuildingControls floating strip and corner handles"
```

---

## Task 8: RoomPage — building mode wiring

**Files:**
- Modify: `apps/client/src/pages/RoomPage.tsx`

- [ ] **Step 1: Add imports**

Add to the existing imports in `RoomPage.tsx`:

```ts
import { Vector3, Matrix, PointerEventTypes } from '@babylonjs/core'
import { BuildingManager } from '../babylon/buildings'
import { BuildingPalette } from '../components/BuildingPalette'
import { BuildingControls } from '../components/BuildingControls'
import type { ScreenCorners } from '../components/BuildingControls'
import { normalizeRect } from '../babylon/buildingUtils'
import type { BuildingTile } from '../types'
```

Note: `PointerEventTypes` is already imported — remove the duplicate if present.

- [ ] **Step 2: Add building mode state and refs**

Inside `RoomPage()`, after the existing `useState` declarations, add:

```ts
const [buildingMode, setBuildingMode] = useState(false)
const [buildMode, setBuildMode] = useState<'build' | 'erase'>('build')
const [wallTileId, setWallTileId] = useState('wall-wood')
const [floorTileId, setFloorTileId] = useState('floor-dirt')
const [mergeMode, setMergeMode] = useState<'open' | 'walled'>('open')
const [screenCorners, setScreenCorners] = useState<ScreenCorners | null>(null)

const buildingManagerRef = useRef<BuildingManager | null>(null)
const buildingModeRef = useRef(false)
const buildModeRef = useRef<'build' | 'erase'>('build')
const wallTileIdRef = useRef('wall-wood')
const floorTileIdRef = useRef('floor-dirt')
const mergeModeRef = useRef<'open' | 'walled'>('open')
const previewEndRef = useRef<{ col: number; row: number } | null>(null)
const draggingCornerRef = useRef<'nw' | 'ne' | 'sw' | 'se' | null>(null)
```

- [ ] **Step 3: Keep refs in sync with state**

After the existing `useEffect` that syncs `cameraAlphaRef`, add:

```ts
useEffect(() => { buildingModeRef.current = buildingMode }, [buildingMode])
useEffect(() => { buildModeRef.current = buildMode }, [buildMode])
useEffect(() => { wallTileIdRef.current = wallTileId }, [wallTileId])
useEffect(() => { floorTileIdRef.current = floorTileId }, [floorTileId])
useEffect(() => { mergeModeRef.current = mergeMode }, [mergeMode])
```

- [ ] **Step 4: Create BuildingManager in scene setup**

In the main `useEffect` that creates the scene (the one that initialises `spriteManagerRef`, `dragControllerRef`, etc.), add after `spriteManagerRef.current = new SpriteManager(...)`:

```ts
buildingManagerRef.current = new BuildingManager(scene)
```

And in the cleanup function of that same `useEffect`, add:

```ts
buildingManagerRef.current?.dispose()
buildingManagerRef.current = null
```

- [ ] **Step 5: Suspend token interactions and register building pointer observer**

In the `DragCallbacks` object passed to `DragController`, wrap each callback so it exits early when building mode is active:

```ts
const dragCallbacks: DragCallbacks = {
  onDragMove: (instanceId, col, row) => {
    if (buildingModeRef.current) return
    // ... existing onDragMove body
  },
  onDragDrop: (instanceId, col, row) => {
    if (buildingModeRef.current) return
    // ... existing onDragDrop body
  },
  onSpriteClick: (instanceId) => {
    if (buildingModeRef.current) return
    // ... existing onSpriteClick body
  },
}
```

Then, in the same scene-setup `useEffect`, after the `DragController` is created, add:

```ts
scene.onPointerObservable.add((info) => {
  if (!buildingModeRef.current) return
  const bm = buildingManagerRef.current
  if (!bm) return

  if (info.type === PointerEventTypes.POINTERDOWN) {
    const pick = scene.pick(scene.pointerX, scene.pointerY)
    if (!pick.hit || !pick.pickedPoint) return
    const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
    if (buildModeRef.current === 'build') {
      bm.beginPreview(col, row)
      bm.updatePreview(col, row, `/assets/tiles/${wallTileIdRef.current}.svg`, `/assets/tiles/${floorTileIdRef.current}.svg`)
      previewEndRef.current = { col, row }
    } else {
      // building mode is host-only, so session is always HostSession here
      const { buildingTiles } = useRoomStore.getState()
      for (const [id, tile] of Object.entries(buildingTiles)) {
        if (tile.col === col && tile.row === row) {
          ;(sessionRef.current as HostSession).localAction({ type: 'building:remove', instanceId: id })
          break
        }
      }
    }
  }

  if (info.type === PointerEventTypes.POINTERMOVE && buildModeRef.current === 'build' && bm.getPreviewStart()) {
    if (draggingCornerRef.current) return // corner drag handles its own update
    const pick = scene.pick(scene.pointerX, scene.pointerY)
    if (!pick.hit || !pick.pickedPoint) return
    const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
    bm.updatePreview(col, row, `/assets/tiles/${wallTileIdRef.current}.svg`, `/assets/tiles/${floorTileIdRef.current}.svg`)
    previewEndRef.current = { col, row }
  }
})
```

Note: replace the erase `localAction`/`send` calls in Step 9 Task below — the networking wiring is cleaner after HostSession/GuestSession are updated. For now this is a placeholder.

- [ ] **Step 6: Corner projection loop**

After the scene-setup `useEffect`, add a separate `useEffect` for corner projection:

```ts
useEffect(() => {
  const scene = sceneRef.current
  const canvas = canvasRef.current
  if (!buildingMode || !scene || !canvas) return

  const observer = scene.onBeforeRenderObservable.add(() => {
    const bm = buildingManagerRef.current
    const end = previewEndRef.current
    if (!bm || !end) { setScreenCorners(null); return }

    const worldCorners = bm.getPreviewWorldCorners(end.col, end.row)
    if (!worldCorners) { setScreenCorners(null); return }

    const engine = scene.getEngine()
    const camera = scene.activeCamera!
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    const transform = scene.getTransformMatrix()

    const project = (v: Vector3) => {
      const s = Vector3.Project(v, Matrix.Identity(), transform, viewport)
      return { x: s.x, y: s.y }
    }

    const rect = bm.getPreviewStart()
    if (!rect) { setScreenCorners(null); return }
    const { minCol, minRow, maxCol, maxRow } = normalizeRect({ startCol: rect.startCol, startRow: rect.startRow, endCol: end.col, endRow: end.row })

    setScreenCorners({
      nw: project(worldCorners.nw),
      ne: project(worldCorners.ne),
      sw: project(worldCorners.sw),
      se: project(worldCorners.se),
      center: project(worldCorners.center),
      width: maxCol - minCol + 1,
      height: maxRow - minRow + 1,
    })
  })

  return () => { scene.onBeforeRenderObservable.remove(observer) }
}, [buildingMode])
```

- [ ] **Step 7: Window-level pointer events for corner drag**

Add a `useEffect` for corner drag:

```ts
useEffect(() => {
  if (!buildingMode) return

  const onMove = (e: PointerEvent) => {
    const corner = draggingCornerRef.current
    const bm = buildingManagerRef.current
    const scene = sceneRef.current
    if (!corner || !bm || !scene) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const pick = scene.pick(e.clientX - rect.left, e.clientY - rect.top)
    if (!pick.hit || !pick.pickedPoint) return
    const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)

    // Reanchor: find opposite corner, set as new start
    const previewRect = bm.getPreviewStart()
    const end = previewEndRef.current
    if (previewRect && end) {
      const { minCol, minRow, maxCol, maxRow } = normalizeRect({ startCol: previewRect.startCol, startRow: previewRect.startRow, endCol: end.col, endRow: end.row })
      const opposites = {
        nw: { col: maxCol, row: maxRow },
        ne: { col: minCol, row: maxRow },
        sw: { col: maxCol, row: minRow },
        se: { col: minCol, row: minRow },
      }
      bm.setPreviewStart(opposites[corner].col, opposites[corner].row)
    }
    bm.updatePreview(col, row, `/assets/tiles/${wallTileIdRef.current}.svg`, `/assets/tiles/${floorTileIdRef.current}.svg`)
    previewEndRef.current = { col, row }
  }

  const onUp = () => { draggingCornerRef.current = null }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  return () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
}, [buildingMode])
```

- [ ] **Step 8: handlePlaceRoom function**

Add this function inside `RoomPage` (alongside the other handlers):

```ts
const handlePlaceRoom = () => {
  const bm = buildingManagerRef.current
  const end = previewEndRef.current
  if (!bm || !end) return
  const { buildingTiles } = useRoomStore.getState()
  const tiles = bm.commitPreview(end.col, end.row, wallTileId, floorTileId, buildingTiles, mergeMode)
  for (const tile of tiles) {
    useRoomStore.getState().placeTile(tile)
    // Networking: send each tile — wired properly in Task 9
    sendMsg(sessionRef.current as HostSession, { type: 'building:place', tile })
  }
  previewEndRef.current = null
  setScreenCorners(null)
}
```

- [ ] **Step 9: Add toolbar button and render building UI**

In the JSX return, find the left toolbar section (where SpritePicker is rendered). Add a 🏠 button that only appears for the host, and render `BuildingPalette` + `BuildingControls` when building mode is active.

In the existing toolbar area (find where other toolbar buttons are rendered, typically near the `SpritePicker`), add:

```tsx
{isHost && (
  <button
    onClick={() => {
      setBuildingMode((prev) => {
        if (prev) buildingManagerRef.current?.cancelPreview()
        return !prev
      })
    }}
    style={{
      width: 36, height: 36, borderRadius: 6, border: 'none', cursor: 'pointer',
      background: buildingMode ? '#c8893a' : 'rgba(255,255,255,0.08)',
      boxShadow: buildingMode ? '0 0 8px rgba(200,137,58,0.5)' : 'none',
      fontSize: 16,
    }}
    title="Building Tools"
  >
    🏠
  </button>
)}
```

In the return JSX, inside the outermost container div (before the closing tag), add:

```tsx
{buildingMode && (
  <>
    <BuildingPalette
      wallTileId={wallTileId}
      floorTileId={floorTileId}
      mode={buildMode}
      onWallSelect={setWallTileId}
      onFloorSelect={setFloorTileId}
      onModeChange={setBuildMode}
    />
    <BuildingControls
      corners={screenCorners}
      mergeMode={mergeMode}
      onMergeModeChange={setMergeMode}
      onPlace={handlePlaceRoom}
      onCornerDragStart={(corner) => { draggingCornerRef.current = corner }}
    />
  </>
)}
```

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd "apps/client" && pnpm tsc --noEmit
```

Expected: no errors. Fix any import issues that arise.

- [ ] **Step 11: Visual smoke test**

```bash
cd "apps/client" && pnpm dev
```

- Open `http://localhost:5173` and create a room as host (add `?host=1` to URL if needed).
- Click 🏠 in the toolbar — palette should appear at the bottom.
- Drag on the grid — a semi-transparent room preview should appear.
- Drag corner handles — preview should resize.
- Click Place Room — tiles should commit (visible as flat coloured planes on the grid).
- Toggle to Erase, click a placed tile — it should disappear.

- [ ] **Step 12: Commit**

```bash
git add apps/client/src/pages/RoomPage.tsx
git commit -m "feat(building): wire building mode into RoomPage"
```

---

## Task 9: Networking

**Files:**
- Modify: `apps/client/src/networking/host.ts`
- Modify: `apps/client/src/networking/guest.ts`
- Modify: `apps/client/src/networking/messages.ts`

- [ ] **Step 1: Add sendBuildingSnapshot to messages.ts**

In `apps/client/src/networking/messages.ts`, add after `sendSnapshot`:

```ts
import type { BuildingTile } from '../types'

export function sendBuildingSnapshot(peer: PeerConnection, tiles: BuildingTile[]): void {
  peer.sendReliable({ type: 'building:snapshot', tiles })
}
```

- [ ] **Step 2: Update host.ts — add BuildingManager, handle building:* messages**

In `apps/client/src/networking/host.ts`, add the import:

```ts
import type { BuildingManager } from '../babylon/buildings'
```

Add `buildingManager: BuildingManager` as a constructor parameter alongside `spriteManager`:

```ts
constructor(
  private scene: Scene,
  private spriteManager: SpriteManager,
  private buildingManager: BuildingManager,
  _cursorManager: CursorManager,
  onRoomCreated: (roomId: string) => void,
)
```

In `handleGuestJoined` → `onConnected` callback, after `sendSnapshot(peer, ...)`, add:

```ts
const { buildingTiles } = useRoomStore.getState()
sendBuildingSnapshot(peer, Object.values(buildingTiles))
```

Add the import at the top:

```ts
import { broadcastReliable, sendSnapshot, sendBuildingSnapshot } from './messages'
```

In `handleMessage`, add cases inside the `switch`:

```ts
case 'building:place': {
  useRoomStore.getState().placeTile(msg.tile)
  this.buildingManager.placeTile(msg.tile, `/assets/tiles/${msg.tile.tileId}.svg`)
  break
}
case 'building:remove': {
  useRoomStore.getState().removeTile(msg.instanceId)
  this.buildingManager.removeTile(msg.instanceId)
  break
}
case 'building:snapshot': {
  // Host never receives a snapshot — ignore defensively
  break
}
```

In the relay block at the bottom of `handleMessage` (the `for` loop over `this.peers`), ensure building messages are relayed:

The existing relay code already handles all `GameMessage` types without filtering by type (except the lossy check for `sprite:drag` and `cursor:move`). Building messages will be relayed as reliable — no change needed here.

- [ ] **Step 3: Update guest.ts — add BuildingManager, handle building:* messages**

In `apps/client/src/networking/guest.ts`, add the import:

```ts
import type { BuildingManager } from '../babylon/buildings'
```

Add `buildingManager: BuildingManager` as a constructor parameter alongside `spriteManager`:

```ts
constructor(
  roomId: string,
  private scene: Scene,
  private spriteManager: SpriteManager,
  private buildingManager: BuildingManager,
  private cursorManager: CursorManager,
  onConnected: () => void,
  onHostDisconnected: () => void,
)
```

In `handleMessage`, add cases inside the `switch`:

```ts
case 'building:place': {
  useRoomStore.getState().placeTile(msg.tile)
  this.buildingManager.placeTile(msg.tile, `/assets/tiles/${msg.tile.tileId}.svg`)
  break
}
case 'building:remove': {
  useRoomStore.getState().removeTile(msg.instanceId)
  this.buildingManager.removeTile(msg.instanceId)
  break
}
case 'building:snapshot': {
  useRoomStore.getState().loadBuildingSnapshot(msg.tiles)
  this.buildingManager.loadSnapshot(msg.tiles)
  break
}
```

- [ ] **Step 4: Update RoomPage.tsx session construction**

In `RoomPage.tsx`, find where `HostSession` and `GuestSession` are constructed and pass `buildingManagerRef.current`:

For `HostSession`:
```ts
new HostSession(scene, spriteManagerRef.current, buildingManagerRef.current!, cursorManagerRef.current, ...)
```

For `GuestSession`:
```ts
new GuestSession(roomId, scene, spriteManagerRef.current, buildingManagerRef.current!, cursorManagerRef.current, ...)
```

Also update `handlePlaceRoom` — replace the `sendMsg` call with a direct `localAction` for host:

```ts
const handlePlaceRoom = () => {
  const bm = buildingManagerRef.current
  const end = previewEndRef.current
  const session = sessionRef.current
  if (!bm || !end || !(session instanceof HostSession)) return
  const { buildingTiles } = useRoomStore.getState()
  const tiles = bm.commitPreview(end.col, end.row, wallTileId, floorTileId, buildingTiles, mergeMode)
  for (const tile of tiles) {
    useRoomStore.getState().placeTile(tile)
    session.localAction({ type: 'building:place', tile })
  }
  previewEndRef.current = null
  setScreenCorners(null)
}
```

And update the erase handler in the pointer observer to use `session.localAction` directly for host.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "apps/client" && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run all tests**

```bash
cd "apps/client" && pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 7: Multiplayer smoke test**

Start both server and client:

```bash
# Terminal 1
cd "apps/server" && pnpm dev

# Terminal 2
cd "apps/client" && pnpm dev
```

- Open `http://localhost:5173` in Browser A — create room as host (note the room URL).
- Open the room URL in Browser B — join as guest.
- On host (A): click 🏠, drag out a room, place it.
- Verify the tiles appear on guest (B) immediately.
- On host (A): switch to Erase, click a tile.
- Verify the tile disappears on guest (B).
- Open Browser C, join mid-session — verify building tiles appear from the snapshot.

- [ ] **Step 8: Commit**

```bash
git add apps/client/src/networking/host.ts apps/client/src/networking/guest.ts apps/client/src/networking/messages.ts apps/client/src/pages/RoomPage.tsx
git commit -m "feat(building): wire building:* messages through host and guest sessions"
```

---

## Acceptance Checklist

- [ ] `pnpm test --run` passes in `apps/client`
- [ ] 🏠 toolbar button visible only for host
- [ ] Drag on grid creates semi-transparent room preview with wall perimeter + floor interior
- [ ] Corner handles resize the preview; size chip updates live
- [ ] Place Room commits tiles (visible as flat planes on grid)
- [ ] Open/Walled toggle skips or keeps shared wall tiles at room boundaries
- [ ] Erase mode removes tiles by click/drag
- [ ] Placed tiles appear on guest client in real-time
- [ ] Guest joining mid-session receives full building snapshot
- [ ] Closing building mode cancels any in-progress preview
