# Builder Props Design

**Goal:** Add a builder props system — host-only, environment-building elements starting with a door — and redesign the UI sidebar to match the reference screenshots.

**Architecture:** Option B — `BuilderProp` is a first-class entity with its own Zustand slice, four new `GameMessage` variants, and a dedicated `PropManager` BabylonJS class. This is cleanly separate from sprite/token data and building tile data.

**Tech Stack:** React, Zustand, BabylonJS (programmatic box meshes, no SVG assets yet), WebRTC via existing host/guest relay pattern.

---

## Taxonomy

Two distinct prop categories (see memory for full taxonomy):

- **Builder props** — host-only, placed on walls/floors, define environment (doors, windows, beds, etc.). Stored in `builderProps` in the room store. Not moveable by players.
- **Token props** — player-moveable, stored as `SpriteInstance` in the sprite system (e.g., barrel). This spec covers builder props only.

---

## Data Model

### New Types (types.ts)

```typescript
export interface BuilderProp {
  instanceId: string
  propId: string           // e.g. "door-wood"
  col: number
  row: number
  state: Record<string, string | number | boolean>  // e.g. { open: false }
}

export interface PropManifestEntry {
  id: string
  label: string
  theme: string
}

export interface PropTheme {
  id: string
  label: string
  props: PropManifestEntry[]
}

export interface PropManifest {
  themes: PropTheme[]
}
```

### New GameMessages

```typescript
| { type: 'prop:place'; prop: BuilderProp }
| { type: 'prop:remove'; instanceId: string }
| { type: 'prop:interact'; instanceId: string; state: Record<string, string | number | boolean> }
| { type: 'prop:snapshot'; props: BuilderProp[] }
```

### Room Store (room.ts)

New slice added to `RoomStore`:
```typescript
builderProps: Record<string, BuilderProp>
placeProp: (p: BuilderProp) => void
removeProp: (instanceId: string) => void
setPropState: (instanceId: string, state: Record<string, string | number | boolean>) => void
loadPropSnapshot: (props: BuilderProp[]) => void
```

`reset()` also clears `builderProps`.

---

## Prop Manifest

`public/assets/props/manifest.json`:

```json
{
  "themes": [
    {
      "id": "structures",
      "label": "Structures",
      "props": [
        { "id": "door-wood", "label": "Wooden Door", "theme": "structures" }
      ]
    }
  ]
}
```

---

## Door Mechanics

When a door is placed at `(col, row)`:

1. The `BuildingManager` hides the wall mesh at that cell (mesh.isVisible = false). The mesh stays in its map and is restored on removal.
2. `PropManager` renders four programmatic BabylonJS meshes at that cell:
   - **Top header**: `CreateBox({ width: 1, height: 0.2, depth: 0.15 })` at y=1.5 — brown
   - **Left jamb**: `CreateBox({ width: 0.15, height: 1.4, depth: 0.15 })` at y=0.7, x=pos.x−0.425 — brown
   - **Right jamb**: `CreateBox({ width: 0.15, height: 1.4, depth: 0.15 })` at y=0.7, x=pos.x+0.425 — brown
   - **Door panel**: `CreateBox({ width: 0.7, height: 1.35, depth: 0.08 })` at y=0.675 — wood-colored

3. Tapping the door (any player) toggles `state.open`. When `open: true`, the door panel mesh's `isVisible = false`. When `open: false`, `isVisible = true`.

All prop meshes use `renderingGroupId = 1` (same as walls and sprites).

### BuildingManager changes

New fields and methods:
```typescript
private wallPosTileId = new Map<string, string>()  // `${col},${row}` → instanceId

hideWallAt(col: number, row: number): void
showWallAt(col: number, row: number): void
isWallAt(col: number, row: number): boolean
```

`placeTile` populates `wallPosTileId` for wall tiles. `removeTile` cleans it up. `clearTiles` / `reset` clear it.

---

## PropManager

`apps/client/src/babylon/props.ts` — new class.

```typescript
interface PropRenderEntry {
  prop: BuilderProp
  frameMeshes: Mesh[]  // header, leftJamb, rightJamb
  panel: Mesh | null   // door panel (null for non-door props)
}

class PropManager {
  private entries = new Map<string, PropRenderEntry>()

  constructor(private scene: Scene) {}

  place(prop: BuilderProp, buildingManager: BuildingManager): void
  remove(instanceId: string, buildingManager: BuildingManager): void
  setState(instanceId: string, state: Record<string, string|number|boolean>): void
  loadSnapshot(props: BuilderProp[], buildingManager: BuildingManager): void
  getInstanceIdAt(col: number, row: number): string | null
  clear(buildingManager: BuildingManager): void
  dispose(): void
}
```

`getInstanceIdAt` lets RoomPage detect prop taps for interaction.

---

## Permissions

- **Prop placement/removal**: host only. Host UI shows "Props" tab in build sidebar. Guests see no Props tab.
- **Prop interaction** (open/close tap): any player. RoomPage detects tap on prop cell, sends `prop:interact`.

---

## Network

Pattern mirrors building messages:

- **Host receives** `prop:place`, `prop:remove`, `prop:interact` from guests → applies locally → relays to other guests
- **Host sends** `prop:snapshot` to each new guest on connect (alongside `state:snapshot` and `building:snapshot`)
- **Guest sends** `prop:interact` when they tap a door (all players can interact)
- **Guest receives** all four prop message types

New helper in `messages.ts`:
```typescript
export function sendPropSnapshot(peer: PeerConnection, props: BuilderProp[]): void
```

---

## UI Redesign — Sidebar

The current layout (SpritePicker on left + BuildingPalette at bottom) is replaced by a unified left sidebar matching reference screenshots.

### Sidebar.tsx

Left vertical strip with three circular icon tab buttons stacked top-to-bottom:
- **Tokens** (people icon) — shows sprite picker panel
- **Build** (hammer icon) — shows tile selector + build/erase toggle (host only)
- **Props** (door icon) — shows PropPicker panel (host only)

Only the host sees Build and Props tabs.

When a tab is active, its panel slides out to the right of the sidebar strip.

### PropPicker.tsx

Themed prop selection panel:
- Theme label at top with ◀ ▶ navigation buttons to switch between themes
- Grid of prop buttons (programmatic color square thumbnails with label)
- Selecting a prop activates placement mode (similar to sprite selection)

The prop manifest is fetched from `/assets/props/manifest.json`.

---

## RoomPage Changes

1. Instantiate `PropManager` alongside `BuildingManager` in the main `useEffect`
2. Pass `PropManager` into `HostSession` and `GuestSession` constructors
3. On canvas `pointerup`: if a prop exists at the tapped cell → send `prop:interact`; if host has a prop selected and taps a wall cell → send `prop:place`
4. Replace `<BuildingPalette>` and direct `<SpritePicker>` usage with `<Sidebar>` prop
5. Host sends `prop:snapshot` to new guests on connect (via `HostSession.handleGuestJoined`)

---

## Testing

No automated tests are planned for this feature (BabylonJS rendering is not unit-testable). Manual test checklist:

- Host places a door on a wall tile → wall hidden, door frame appears
- Host cannot place door on floor tile or empty cell
- Tapping door toggles open/close (panel hides/shows)
- Guest sees prop:snapshot on join — door renders correctly
- Guest can tap door to open/close — host and other guests see state change
- Removing door restores wall visibility
- Building rooms in erase mode does not disturb placed props (different message type)
