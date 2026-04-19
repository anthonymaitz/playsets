# Building Tools — Design Spec

**Date:** 2026-04-18
**Status:** Approved

---

## Overview

A host-only building mode that lets users construct modular structures (rooms, corridors, enclosures) on the isometric grid using a kit-of-parts system. Wall and floor tiles are placed as individual cell-sized sprites whose artwork is designed to appear thin/edge-like within the cell. Multiple rectangular rooms can be combined to form non-rectangular layouts.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Placement unit | Cell-based (full tile) | Same coordinate system as sprites; artwork creates the edge illusion |
| Collision | None (visual only) | Players decide passability; data model supports adding collision later |
| Host access | Host only | Guests can place/remove tokens but not build |
| Wall auto-merge | User toggle (Open / Walled) | Supports both open-passage and walled-room workflows |

---

## Data Model

### New types in `types.ts`

```ts
export interface BuildingTile {
  instanceId: string       // nanoid
  tileId: string           // e.g. 'wall-wood', 'floor-stone'
  col: number
  row: number
}

export type TileCategory = 'wall' | 'floor'

export interface TileManifestEntry {
  id: string
  label: string
  path: string             // SVG/PNG under /assets/tiles/
  category: TileCategory
}
```

### New `GameMessage` variants

```ts
| { type: 'building:place';    tile: BuildingTile }
| { type: 'building:remove';   instanceId: string }
| { type: 'building:snapshot'; tiles: BuildingTile[] }
```

`building:snapshot` is sent to guests on join alongside the existing `state:snapshot`. No changes to the existing sprite message types.

---

## Store

New slice added to the existing `store/room.ts` (not a separate file):

```ts
buildingTiles: Record<string, BuildingTile>
placeTile:            (t: BuildingTile) => void
removeTile:           (instanceId: string) => void
loadBuildingSnapshot: (tiles: BuildingTile[]) => void
```

`reset()` and `loadSnapshot()` are updated to also clear `buildingTiles`.

---

## Rendering — `babylon/buildings.ts`

A new `BuildingManager` class, parallel in shape to `SpriteManager`.

- **Rendering group 0** — tiles render below tokens (group 1) and above the ground mesh
- Each tile is a flat plane mesh (same dimensions as a grid cell) positioned via `cellToWorld(col, row)` with a small y-offset (`+0.01`) to avoid z-fighting with the ground mesh, textured from the tile manifest
- Texture cache keyed by `tileId` — one `Texture` object per tile type
- No camera-facing variants — tile art is not directional
- No shadow casting — tiles are ground-level flat elements
- Public API mirrors the store slice: `placeTile(tile)`, `removeTile(instanceId)`, `loadSnapshot(tiles)`
- Wired into `RoomPage` the same way `SpriteManager` is — called from the existing store subscription

---

## UX — Building Mode

### Entering / Exiting

- A 🏠 toolbar button appears in the left toolbar **only when `isHost === true`**
- Tapping it enters building mode; tapping it again exits
- The existing token tap-and-hold interaction is suspended while in building mode

### Room Preview Workflow

1. **Drag on grid** → a rectangular room preview appears immediately. Ghost walls (semi-transparent) line the perimeter; ghost floor tiles fill the interior. A floating control strip appears anchored above the preview center (projected from 3D world space).

2. **Resize** → four corner handles (HTML `div` overlays positioned via `Vector3.Project()`) can be dragged to adjust the rectangle. The size chip in the control strip updates live (e.g. `5 × 3`).

3. **Place Room** → tapping the Place Room button in the floating strip commits all tiles:
   - Each wall/floor position gets a `BuildingTile` with a new `nanoid` instanceId
   - The "Open" merge check runs first: if a cell already contains a wall tile from a previous room, the new wall tile for that cell is skipped (no duplicate)
   - All committed tiles are sent as individual `building:place` messages to peers
   - The preview clears immediately so the host can drag the next room

4. **Erase mode** → toggled in the bottom palette (always accessible in building mode). Click or drag across placed tiles to remove them; no active preview is needed. Each removal sends `building:remove`.

### Floating Control Strip

Appears only while a room preview is active. Anchored above the preview center; re-projected from 3D world space each frame as the camera moves. Contains:

| Control | Values | Behaviour |
|---|---|---|
| Size chip | `W × H` | Read-only; updates live as corners are dragged |
| Where rooms meet | **Open** / Walled | Open: skip wall tiles that overlap existing walls. Walled: always place, creating double walls the host can erase. |
| Place Room | — | Commits and clears preview |

### Bottom Palette

Visible whenever building mode is active. Contains tile selection and the Build/Erase mode toggle.

- Two rows: **Wall** (top) and **Floor** (bottom), each showing available tile types as icon thumbnails
- Selected tile is highlighted; clicking a different tile changes the active selection immediately
- Wall and floor selections are independent — the room preview uses whichever tiles are currently selected
- **Build / Erase toggle** at the right end of the palette — always accessible, not tied to an active preview

### Tile Manifest

A new `public/assets/tiles/manifest.json` (analogous to the sprite manifest):

```json
{
  "tiles": [
    { "id": "wall-wood",   "label": "Wood Wall",   "path": "/assets/tiles/wall-wood.png",   "category": "wall"  },
    { "id": "floor-stone", "label": "Stone Floor", "path": "/assets/tiles/floor-stone.png", "category": "floor" }
  ]
}
```

`BuildingPalette` fetches this on mount. Placeholder tiles ship with the feature so the tool is usable before real art arrives.

---

## Networking

- `host.ts` broadcasts `building:place` / `building:remove` to all peers as the host acts
- On guest join, host sends `building:snapshot` (full `BuildingTile[]`) alongside `state:snapshot`
- `guest.ts` handles `building:place`, `building:remove`, `building:snapshot` — applies to the `buildingTiles` store slice, which `BuildingManager` reflects in the scene
- **Host-only gate is UI-only**: the 🏠 button never renders for guests. The host ignores any stray `building:*` messages from peers (defensive guard in host message handler)
- The "Open" merge deduplication runs on the host before emitting — only non-overlapping tiles are sent

---

## File Map

```
apps/client/src/
├── types.ts                          # + BuildingTile, TileCategory, TileManifestEntry, building:* messages
├── store/
│   └── room.ts                       # + buildingTiles slice
├── babylon/
│   └── buildings.ts                  # NEW — BuildingManager
├── components/
│   ├── BuildingPalette.tsx           # NEW — bottom tile picker
│   ├── BuildingControls.tsx          # NEW — floating control strip (anchored above preview)
│   └── RoomPage.tsx                  # + building mode state, BuildingManager wiring
├── networking/
│   ├── host.ts                       # + building:place / building:remove emit; building:snapshot on join
│   └── guest.ts                      # + building:place / building:remove / building:snapshot handlers
public/
└── assets/tiles/
    ├── manifest.json                 # NEW
    └── *.png                         # placeholder tiles
```

---

## Out of Scope (this iteration)

- Collision / passability flags
- Roof / ceiling layer
- Individual tile placement (freeform paint) — rooms-based only for now
- Rotation of individual wall tiles
- Undo/redo
- Guest building permissions
