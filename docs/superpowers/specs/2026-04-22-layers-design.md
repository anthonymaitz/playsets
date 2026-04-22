# Layers System Design

## Goal

Add a 9-layer system to Playsets that lets hosts build multi-story structures and underground dungeons. All layers render simultaneously in the isometric 3D view, stacked at the correct height. Builders control which layer they're working on; players navigate between floors via a panel or staircase props.

## Architecture

**Approach:** Add `layerIndex` to all existing entity types and offset their Y position by `(layerIndex - 5) * LAYER_HEIGHT`. Layer 5 is the ground floor (default). Layers 6–9 are upper floors (positive Y). Layers 1–4 are underground (negative Y). No new scene or coordinate system needed — the existing managers already receive entities and position them.

**Key constant:** `LAYER_HEIGHT = 1.6` units, matching wall height. This means a layer 6 floor tile sits exactly on top of a layer 5 wall with zero gap.

## Data Model

### Entity changes

`layerIndex: number` added to `SpriteInstance`, `BuildingTile`, and `BuilderProp`. Default value: `5`. Existing persisted data loads as layer 5 — fully backward-compatible.

### Layer config

```ts
type LayerBackground = 'transparent' | 'grass' | 'dirt'

interface LayerConfig {
  background: LayerBackground
  visible: boolean
}
```

Stored in room store as `layers: Record<number, LayerConfig>`.

**Defaults:**
- Layer 1: `{ background: 'dirt', visible: true }`
- Layer 5: `{ background: 'grass', visible: true }`
- Layers 2–4, 6–9: `{ background: 'transparent', visible: true }`

**Fallback:** If all 9 layers have `background: 'transparent'`, a starfield plane renders below layer 1.

### Active layer

`activeLayerIndex: number` — local React state in RoomPage, not synced. Default `5`. Controls which layer all build actions target.

## Rendering

### LayerBackgroundManager (`babylon/layers.ts`)

Owns 9 background planes, one per layer, at `Y = (layerIndex - 5) * LAYER_HEIGHT - 0.01` (just below floor tiles). Each plane uses the layer's configured background texture. Transparent layers render no plane. Responds to `setBackground(layerIndex, bg)` and `setVisible(layerIndex, visible)`.

### Existing managers

`SpriteManager`, `BuildingManager`, `PropManager` each apply the Y offset when placing meshes. No structural changes — just `worldY = (instance.layerIndex - 5) * LAYER_HEIGHT` added to their placement logic.

### Visibility

When `visible = false` for a layer, all meshes belonging to that layer are hidden: sprites, building tiles, props, and the background plane. Hidden layers show as dashed-outline cubes in the panel.

## UI

### LayerPanel (`components/LayerPanel.tsx`)

Fixed to the right edge of the screen, always visible. Shows 9 isometric cube icons stacked vertically — layer 9 at top, layer 1 at bottom.

**Cube states:**
- Unselected + visible: semi-transparent cube with faint border
- Active (selected): cube shows background texture on top face, highlighted orange border
- Hidden: dashed outline only, no fill

**Interactions:**
- Click unselected cube → sets it as active layer (local state)
- Click already-active cube → toggles `visible` for that layer (host-only; sends `layer:config` message)
- Players clicking a cube also moves their own token to that layer (same col/row, new layerIndex), sending `sprite:move` with the new `layerIndex`

**Background picker:** A small settings icon appears next to the active layer cube (host-only). Clicking it opens a small popover with background options (transparent, grass, dirt). Sends `layer:config` on selection.

**Access:** LayerPanel is visible to all players. All 9 layers are always shown.

### TokenLayerMover (`components/TokenLayerMover.tsx`)

Appears near a token when that token is selected (positioned like DirectionPicker, near the token's screen position). Shows:
- Up arrow button
- Token avatar (small circle + rectangle)
- Down arrow button
- Current layer label ("Layer 5")

Tapping up/down moves the token to `layerIndex ± 1`, clamped to 1–9. Sends `sprite:move` with the new `layerIndex`. Disappears when token is deselected. Only the token's owner (or the host) can interact with it.

## Staircase Props

Two new prop manifest entries: `stair-up` and `stair-down`. These are placed by the host like any other prop.

When a token is dropped onto a cell containing a staircase prop, RoomPage's drop handler detects the staircase and automatically moves the token to `layerIndex + 1` (stair-up) or `layerIndex - 1` (stair-down), clamped to 1–9. The move sends `sprite:move` with the new `layerIndex`.

## Networking

### New message

```ts
{ type: 'layer:config', layerIndex: number, background?: LayerBackground, visible?: boolean }
```

Host-only. Guests ignore this message if received from a non-host peer.

### Modified messages

- `sprite:place` — gains `layerIndex: number`
- `building:place` — gains `layerIndex: number` on the tile object
- `prop:place` — gains `layerIndex: number`
- `sprite:move` — gains optional `layerIndex?: number` (only included when layer changes)
- `state:snapshot` — gains `layerConfigs: Record<number, LayerConfig>`

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `apps/client/src/babylon/layers.ts` | `LayerBackgroundManager` — 9 background planes, background textures, visibility |
| `apps/client/src/components/LayerPanel.tsx` | Right-side layer panel — cube icons, active layer selection, visibility toggle, background picker |
| `apps/client/src/components/TokenLayerMover.tsx` | Up/down layer mover card that appears when a token is selected |

### Modified files

| File | Changes |
|------|---------|
| `apps/client/src/types.ts` | Add `layerIndex` to entity types; add `LayerConfig`, `LayerBackground` types; update message types |
| `apps/client/src/store/room.ts` | Add `layers` state with defaults; `updateLayerConfig`; `loadLayerSnapshot` |
| `apps/client/src/babylon/sprites.ts` | Apply Y offset from `layerIndex`; `setLayer(instanceId, layerIndex)` method |
| `apps/client/src/babylon/buildings.ts` | Apply Y offset from `layerIndex` |
| `apps/client/src/babylon/props.ts` | Apply Y offset from `layerIndex` |
| `apps/client/src/pages/RoomPage.tsx` | `activeLayerIndex` state; wire `LayerPanel` and `TokenLayerMover`; staircase drop detection; pass `layerIndex` to all place/move actions |
| `apps/client/src/networking/messages.ts` | Add `layer:config`; update existing message types with `layerIndex` |
| `apps/client/src/networking/host.ts` | Handle `layer:config`; include `layerConfigs` in snapshot; broadcast `layerIndex` on place |
| `apps/client/src/networking/guest.ts` | Handle `layer:config`; apply `layerIndex` on place/move |
