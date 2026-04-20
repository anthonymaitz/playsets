# Builder Props Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a host-only builder props system (starting with a door) and redesign the left sidebar UI, distinct from the existing token/sprite system.

**Architecture:** First-class entity: own Zustand slice (`builderProps`), four new `GameMessage` variants (`prop:place/remove/interact/snapshot`), dedicated `PropManager` BabylonJS class, and `Sidebar.tsx` replacing the bottom `BuildingPalette` + inline `SpritePicker` layout.

**Tech Stack:** React, Zustand, BabylonJS (programmatic box meshes, no SVG assets for props), WebRTC via existing host/guest relay, nanoid for IDs.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `apps/client/src/types.ts` | Modify | Add `BuilderProp`, `PropManifestEntry`, `PropTheme`, `PropManifest`; 4 new `GameMessage` variants |
| `apps/client/src/store/room.ts` | Modify | Add `builderProps` slice with place/remove/setState/loadSnapshot |
| `public/assets/props/manifest.json` | Create | Prop manifest with "structures" theme + "door-wood" |
| `apps/client/src/babylon/buildings.ts` | Modify | Add `wallPosTileId` map, `hideWallAt`, `showWallAt`, `isWallAt` |
| `apps/client/src/babylon/props.ts` | Create | `PropManager` class: door frame/panel rendering + toggle |
| `apps/client/src/networking/messages.ts` | Modify | Add `sendPropSnapshot` helper |
| `apps/client/src/networking/host.ts` | Modify | Handle 4 prop message types; send prop snapshot on guest join |
| `apps/client/src/networking/guest.ts` | Modify | Handle 4 prop message types |
| `apps/client/src/components/PropPicker.tsx` | Create | Themed prop selection panel with ◀ ▶ navigation |
| `apps/client/src/components/Sidebar.tsx` | Create | Left vertical sidebar: Tokens / Build / Props tabs |
| `apps/client/src/pages/RoomPage.tsx` | Modify | Wire PropManager; handle prop tap/place; replace palette+picker with Sidebar |

---

### Task 1: Extend types.ts

**Files:**
- Modify: `apps/client/src/types.ts`

- [ ] **Step 1: Add the new types after `TileManifestEntry`**

In `apps/client/src/types.ts`, add after the `TileManifestEntry` block (after line 56):

```typescript
export interface BuilderProp {
  instanceId: string
  propId: string
  col: number
  row: number
  state: Record<string, string | number | boolean>
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

- [ ] **Step 2: Add 4 new GameMessage variants**

In `apps/client/src/types.ts`, append to the `GameMessage` union (after the `building:snapshot` line):

```typescript
  | { type: 'prop:place'; prop: BuilderProp }
  | { type: 'prop:remove'; instanceId: string }
  | { type: 'prop:interact'; instanceId: string; state: Record<string, string | number | boolean> }
  | { type: 'prop:snapshot'; props: BuilderProp[] }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments"
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors (or only pre-existing unrelated errors).

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/types.ts
git commit -m "feat: add BuilderProp types and prop GameMessage variants"
```

---

### Task 2: Extend room store

**Files:**
- Modify: `apps/client/src/store/room.ts`

- [ ] **Step 1: Update the import line**

In `apps/client/src/store/room.ts` line 2, change:
```typescript
import type { SpriteInstance, FacingDir, AnimationName, BuildingTile } from '../types'
```
to:
```typescript
import type { SpriteInstance, FacingDir, AnimationName, BuildingTile, BuilderProp } from '../types'
```

- [ ] **Step 2: Add builderProps to the interface**

In `apps/client/src/store/room.ts`, add to the `RoomStore` interface after `loadBuildingSnapshot`:

```typescript
  builderProps: Record<string, BuilderProp>
  placeProp: (p: BuilderProp) => void
  removeProp: (instanceId: string) => void
  setPropState: (instanceId: string, state: Record<string, string | number | boolean>) => void
  loadPropSnapshot: (props: BuilderProp[]) => void
```

- [ ] **Step 3: Add builderProps initial state and actions to the store**

In `apps/client/src/store/room.ts`, add `builderProps: {}` to the initial state object (after `buildingTiles: {}`), and add these action implementations after `loadBuildingSnapshot`:

```typescript
  placeProp: (p) => set((state) => ({ builderProps: { ...state.builderProps, [p.instanceId]: p } })),
  removeProp: (instanceId) =>
    set((state) => {
      const next = { ...state.builderProps }
      delete next[instanceId]
      return { builderProps: next }
    }),
  setPropState: (instanceId, state) =>
    set((store) => {
      if (!store.builderProps[instanceId]) return store
      return {
        builderProps: {
          ...store.builderProps,
          [instanceId]: { ...store.builderProps[instanceId], state },
        },
      }
    }),
  loadPropSnapshot: (props) =>
    set({ builderProps: Object.fromEntries(props.map((p) => [p.instanceId, p])) }),
```

- [ ] **Step 4: Update reset() to clear builderProps**

Change the `reset` action from:
```typescript
  reset: () => set({ roomId: null, sprites: {}, buildingTiles: {} }),
```
to:
```typescript
  reset: () => set({ roomId: null, sprites: {}, buildingTiles: {}, builderProps: {} }),
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments"
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/store/room.ts
git commit -m "feat: add builderProps slice to room store"
```

---

### Task 3: Create prop manifest

**Files:**
- Create: `public/assets/props/manifest.json`

- [ ] **Step 1: Create the directory and manifest**

```bash
mkdir -p "/Users/anthonymaitz/Repositories/playsets experiments/apps/client/public/assets/props"
```

Then create `apps/client/public/assets/props/manifest.json`:

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

- [ ] **Step 2: Verify the file is reachable**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments"
cat apps/client/public/assets/props/manifest.json
```

Expected: valid JSON printed.

- [ ] **Step 3: Commit**

```bash
git add apps/client/public/assets/props/manifest.json
git commit -m "feat: add prop manifest with door-wood entry"
```

---

### Task 4: BuildingManager wall visibility

**Files:**
- Modify: `apps/client/src/babylon/buildings.ts`

- [ ] **Step 1: Add the wallPosTileId field**

In `apps/client/src/babylon/buildings.ts`, add to the `BuildingManager` class fields (after `private previewMeshes: Mesh[] = []`):

```typescript
  private wallPosTileId = new Map<string, string>()
```

- [ ] **Step 2: Update placeTile to track wall positions**

Change `placeTile` from:
```typescript
  placeTile(tile: BuildingTile, path: string): void {
    if (this.meshes.has(tile.instanceId)) return
    this.meshes.set(tile.instanceId, this.createTilePlane(tile.instanceId, tile.col, tile.row, path))
  }
```
to:
```typescript
  placeTile(tile: BuildingTile, path: string): void {
    if (this.meshes.has(tile.instanceId)) return
    if (path.includes('wall')) {
      this.wallPosTileId.set(`${tile.col},${tile.row}`, tile.instanceId)
    }
    this.meshes.set(tile.instanceId, this.createTilePlane(tile.instanceId, tile.col, tile.row, path))
  }
```

- [ ] **Step 3: Update removeTile to untrack wall positions**

Change `removeTile` to also clean up `wallPosTileId`:
```typescript
  removeTile(instanceId: string): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    for (const [key, id] of this.wallPosTileId) {
      if (id === instanceId) { this.wallPosTileId.delete(key); break }
    }
    const mat = mesh.material
    mesh.dispose()
    mat?.dispose()
    this.meshes.delete(instanceId)
  }
```

- [ ] **Step 4: Update clearTiles to reset wallPosTileId**

In the `private clearTiles()` method, add `this.wallPosTileId.clear()` after `this.meshes.clear()`:
```typescript
  private clearTiles(): void {
    for (const mesh of this.meshes.values()) {
      const mat = mesh.material
      mesh.dispose()
      mat?.dispose()
    }
    this.meshes.clear()
    this.wallPosTileId.clear()
  }
```

- [ ] **Step 5: Add hideWallAt, showWallAt, isWallAt methods**

Add these three methods after `removeTile`:

```typescript
  hideWallAt(col: number, row: number): void {
    const id = this.wallPosTileId.get(`${col},${row}`)
    if (!id) return
    const mesh = this.meshes.get(id)
    if (mesh) mesh.isVisible = false
  }

  showWallAt(col: number, row: number): void {
    const id = this.wallPosTileId.get(`${col},${row}`)
    if (!id) return
    const mesh = this.meshes.get(id)
    if (mesh) mesh.isVisible = true
  }

  isWallAt(col: number, row: number): boolean {
    return this.wallPosTileId.has(`${col},${row}`)
  }
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments"
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/babylon/buildings.ts
git commit -m "feat: add wall visibility tracking to BuildingManager"
```

---

### Task 5: PropManager

**Files:**
- Create: `apps/client/src/babylon/props.ts`

- [ ] **Step 1: Create apps/client/src/babylon/props.ts**

```typescript
import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core'
import type { BuilderProp } from '../types'
import type { BuildingManager } from './buildings'
import { cellToWorld } from './grid'

const FRAME_COLOR = new Color3(0.42, 0.26, 0.13)
const PANEL_COLOR = new Color3(0.6, 0.38, 0.18)

interface PropRenderEntry {
  prop: BuilderProp
  frameMeshes: Mesh[]
  panel: Mesh | null
}

export class PropManager {
  private entries = new Map<string, PropRenderEntry>()

  constructor(private scene: Scene) {}

  place(prop: BuilderProp, buildingManager: BuildingManager): void {
    if (this.entries.has(prop.instanceId)) return
    const { x, z } = cellToWorld(prop.col, prop.row)

    buildingManager.hideWallAt(prop.col, prop.row)

    const frameMeshes: Mesh[] = []
    const header = this.makeBox(`prop-header-${prop.instanceId}`, 1, 0.2, 0.15, x, 1.5, z, FRAME_COLOR)
    const leftJamb = this.makeBox(`prop-ljamb-${prop.instanceId}`, 0.15, 1.4, 0.15, x - 0.425, 0.7, z, FRAME_COLOR)
    const rightJamb = this.makeBox(`prop-rjamb-${prop.instanceId}`, 0.15, 1.4, 0.15, x + 0.425, 0.7, z, FRAME_COLOR)
    frameMeshes.push(header, leftJamb, rightJamb)

    const panel = this.makeBox(`prop-panel-${prop.instanceId}`, 0.7, 1.35, 0.08, x, 0.675, z, PANEL_COLOR)
    panel.isVisible = !prop.state.open

    this.entries.set(prop.instanceId, { prop, frameMeshes, panel })
  }

  remove(instanceId: string, buildingManager: BuildingManager): void {
    const entry = this.entries.get(instanceId)
    if (!entry) return
    buildingManager.showWallAt(entry.prop.col, entry.prop.row)
    for (const m of entry.frameMeshes) { m.material?.dispose(); m.dispose() }
    if (entry.panel) { entry.panel.material?.dispose(); entry.panel.dispose() }
    this.entries.delete(instanceId)
  }

  setState(instanceId: string, state: Record<string, string | number | boolean>): void {
    const entry = this.entries.get(instanceId)
    if (!entry || !entry.panel) return
    entry.prop = { ...entry.prop, state }
    entry.panel.isVisible = !state.open
  }

  loadSnapshot(props: BuilderProp[], buildingManager: BuildingManager): void {
    this.clear(buildingManager)
    for (const p of props) this.place(p, buildingManager)
  }

  getInstanceIdAt(col: number, row: number): string | null {
    for (const [id, entry] of this.entries) {
      if (entry.prop.col === col && entry.prop.row === row) return id
    }
    return null
  }

  clear(buildingManager: BuildingManager): void {
    for (const instanceId of this.entries.keys()) {
      this.remove(instanceId, buildingManager)
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      for (const m of entry.frameMeshes) { m.material?.dispose(); m.dispose() }
      if (entry.panel) { entry.panel.material?.dispose(); entry.panel.dispose() }
    }
    this.entries.clear()
  }

  private makeBox(name: string, w: number, h: number, d: number, x: number, y: number, z: number, color: Color3): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene)
    mesh.position.set(x, y, z)
    mesh.renderingGroupId = 1
    const mat = new StandardMaterial(`${name}-mat`, this.scene)
    mat.diffuseColor = color
    mat.emissiveColor = color.scale(0.3)
    mesh.material = mat
    return mesh
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments"
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/babylon/props.ts
git commit -m "feat: add PropManager with door frame and panel rendering"
```

---

### Task 6: Network layer

**Files:**
- Modify: `apps/client/src/networking/messages.ts`
- Modify: `apps/client/src/networking/host.ts`
- Modify: `apps/client/src/networking/guest.ts`

- [ ] **Step 1: Add sendPropSnapshot to messages.ts**

In `apps/client/src/networking/messages.ts`, update the import to include `BuilderProp`:
```typescript
import type { GameMessage, SpriteInstance, Player, BuildingTile, BuilderProp } from '../types'
```

Add after `sendBuildingSnapshot`:
```typescript
export function sendPropSnapshot(peer: PeerConnection, props: BuilderProp[]): void {
  peer.sendReliable({ type: 'prop:snapshot', props })
}
```

- [ ] **Step 2: Update host.ts imports**

In `apps/client/src/networking/host.ts`, update the messages import:
```typescript
import { broadcastReliable, sendSnapshot, sendBuildingSnapshot, sendPropSnapshot } from './messages'
```

Add the PropManager import:
```typescript
import type { PropManager } from '../babylon/props'
```

- [ ] **Step 3: Add PropManager to HostSession constructor**

Change the `HostSession` constructor signature from:
```typescript
  constructor(
    private scene: Scene,
    private spriteManager: SpriteManager,
    private buildingManager: BuildingManager,
    _cursorManager: CursorManager,
    onRoomCreated: (roomId: string) => void,
  ) {
```
to:
```typescript
  constructor(
    private scene: Scene,
    private spriteManager: SpriteManager,
    private buildingManager: BuildingManager,
    private propManager: PropManager,
    _cursorManager: CursorManager,
    onRoomCreated: (roomId: string) => void,
  ) {
```

- [ ] **Step 4: Send prop snapshot in handleGuestJoined**

In `handleGuestJoined`, after `sendBuildingSnapshot(peer, Object.values(buildingTiles))`, add:
```typescript
        const { builderProps } = useRoomStore.getState()
        sendPropSnapshot(peer, Object.values(builderProps))
```

Also add prop snapshot in the `handleReconnect` method after the `sendBuildingSnapshot` call:
```typescript
      const { builderProps } = useRoomStore.getState()
      for (const peer of this.peers.values()) {
        sendPropSnapshot(peer, Object.values(builderProps))
      }
```

- [ ] **Step 5: Handle prop messages in host.ts handleMessage**

In the `switch (msg.type)` block of `handleMessage`, add after the `building:snapshot` case:

```typescript
      case 'prop:place': {
        useRoomStore.getState().placeProp(msg.prop)
        this.propManager.place(msg.prop, this.buildingManager)
        break
      }
      case 'prop:remove': {
        useRoomStore.getState().removeProp(msg.instanceId)
        this.propManager.remove(msg.instanceId, this.buildingManager)
        break
      }
      case 'prop:interact': {
        useRoomStore.getState().setPropState(msg.instanceId, msg.state)
        this.propManager.setState(msg.instanceId, msg.state)
        break
      }
      case 'prop:snapshot': {
        // Host never receives a snapshot — ignore defensively
        break
      }
```

- [ ] **Step 6: Update guest.ts imports and constructor**

In `apps/client/src/networking/guest.ts`, add PropManager import:
```typescript
import type { PropManager } from '../babylon/props'
```

Change the `GuestSession` constructor signature from:
```typescript
  constructor(
    roomId: string,
    private scene: Scene,
    private spriteManager: SpriteManager,
    private buildingManager: BuildingManager,
    private cursorManager: CursorManager,
    onConnected: () => void,
    onHostDisconnected: () => void,
  ) {
```
to:
```typescript
  constructor(
    roomId: string,
    private scene: Scene,
    private spriteManager: SpriteManager,
    private buildingManager: BuildingManager,
    private propManager: PropManager,
    private cursorManager: CursorManager,
    onConnected: () => void,
    onHostDisconnected: () => void,
  ) {
```

- [ ] **Step 7: Handle prop messages in guest.ts handleMessage**

In the `switch (msg.type)` block, add after `building:snapshot` case:

```typescript
      case 'prop:place': {
        useRoomStore.getState().placeProp(msg.prop)
        this.propManager.place(msg.prop, this.buildingManager)
        break
      }
      case 'prop:remove': {
        useRoomStore.getState().removeProp(msg.instanceId)
        this.propManager.remove(msg.instanceId, this.buildingManager)
        break
      }
      case 'prop:interact': {
        useRoomStore.getState().setPropState(msg.instanceId, msg.state)
        this.propManager.setState(msg.instanceId, msg.state)
        break
      }
      case 'prop:snapshot': {
        useRoomStore.getState().loadPropSnapshot(msg.props)
        this.propManager.loadSnapshot(msg.props, this.buildingManager)
        break
      }
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments"
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors (RoomPage will have errors until Task 9 since constructor signatures changed — that's OK for now).

- [ ] **Step 9: Commit**

```bash
git add apps/client/src/networking/messages.ts apps/client/src/networking/host.ts apps/client/src/networking/guest.ts
git commit -m "feat: add prop message handling to host/guest sessions"
```

---

### Task 7: PropPicker component

**Files:**
- Create: `apps/client/src/components/PropPicker.tsx`

- [ ] **Step 1: Create PropPicker.tsx**

```typescript
import { useEffect, useState } from 'react'
import type { PropManifest, PropManifestEntry, PropTheme } from '../types'

interface Props {
  selectedPropId: string | null
  onSelect: (entry: PropManifestEntry) => void
  onDeselect: () => void
}

export function PropPicker({ selectedPropId, onSelect, onDeselect }: Props) {
  const [manifest, setManifest] = useState<PropManifest | null>(null)
  const [themeIndex, setThemeIndex] = useState(0)

  useEffect(() => {
    fetch('/assets/props/manifest.json')
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => {})
  }, [])

  const themes: PropTheme[] = manifest?.themes ?? []
  const theme = themes[themeIndex]

  if (!theme) return (
    <div style={{ padding: 12, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No props loaded</div>
  )

  return (
    <div style={{ padding: '8px 12px', minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => setThemeIndex((i) => Math.max(0, i - 1))}
          disabled={themeIndex === 0}
          style={navBtnStyle}
        >◀</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase' }}>
          {theme.label}
        </span>
        <button
          onClick={() => setThemeIndex((i) => Math.min(themes.length - 1, i + 1))}
          disabled={themeIndex === themes.length - 1}
          style={navBtnStyle}
        >▶</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {theme.props.map((entry) => (
          <button
            key={entry.id}
            onClick={() => selectedPropId === entry.id ? onDeselect() : onSelect(entry)}
            title={entry.label}
            style={{
              width: '100%', aspectRatio: '1', border: '2px solid',
              borderColor: selectedPropId === entry.id ? '#f0a84a' : 'rgba(255,255,255,0.1)',
              borderRadius: 6, background: selectedPropId === entry.id ? 'rgba(240,168,74,0.15)' : 'rgba(255,255,255,0.06)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <div style={{ width: 28, height: 28, background: '#7a4a1e', borderRadius: 3, border: '2px solid #5a3210' }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.2 }}>
              {entry.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  width: 24, height: 24, border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
  cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments"
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/PropPicker.tsx
git commit -m "feat: add PropPicker component with theme navigation"
```

---

### Task 8: Sidebar component

**Files:**
- Create: `apps/client/src/components/Sidebar.tsx`

This component replaces `BuildingPalette` as the main left-side UI. It incorporates the sprite picker, building controls, and prop picker into a tabbed sidebar matching the reference screenshots.

- [ ] **Step 1: Read current SpritePicker to understand its interface**

Read `apps/client/src/components/SpritePicker.tsx` lines 1-15 to verify the props interface (already known from earlier reads — confirming: `selectedSpriteId`, `onSelect`, `onDeselect`, `activeWeather`, `onWeatherChange`, `activeBackground`, `onBackgroundChange`).

- [ ] **Step 2: Create Sidebar.tsx**

```typescript
import { useState } from 'react'
import type { SpriteManifestEntry, TileManifestEntry, TileCategory, WeatherType, BackgroundType, PropManifestEntry } from '../types'
import { SpritePicker } from './SpritePicker'
import { PropPicker } from './PropPicker'

type SidebarTab = 'tokens' | 'build' | 'props'

interface BuildPanelProps {
  wallTileId: string
  floorTileId: string
  buildMode: 'build' | 'erase'
  mergeMode: 'open' | 'walled'
  tiles: TileManifestEntry[]
  onWallSelect: (id: string) => void
  onFloorSelect: (id: string) => void
  onBuildModeChange: (m: 'build' | 'erase') => void
  onMergeModeChange: (m: 'open' | 'walled') => void
}

interface Props {
  isHost: boolean
  selectedSpriteId: string | null
  onSpriteSelect: (s: SpriteManifestEntry) => void
  onSpriteDeselect: () => void
  activeWeather: WeatherType
  onWeatherChange: (w: WeatherType) => void
  activeBackground: BackgroundType
  onBackgroundChange: (b: BackgroundType) => void
  buildingMode: boolean
  onBuildingModeChange: (active: boolean) => void
  buildPanel: BuildPanelProps
  selectedPropId: string | null
  onPropSelect: (entry: PropManifestEntry) => void
  onPropDeselect: () => void
}

export function Sidebar({
  isHost,
  selectedSpriteId,
  onSpriteSelect,
  onSpriteDeselect,
  activeWeather,
  onWeatherChange,
  activeBackground,
  onBackgroundChange,
  buildingMode,
  onBuildingModeChange,
  buildPanel,
  selectedPropId,
  onPropSelect,
  onPropDeselect,
}: Props) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('tokens')

  const handleTabClick = (tab: SidebarTab) => {
    if (tab === 'tokens') {
      setActiveTab('tokens')
      onBuildingModeChange(false)
    } else if (tab === 'build') {
      setActiveTab('build')
      onBuildingModeChange(true)
    } else {
      setActiveTab('props')
      onBuildingModeChange(false)
    }
  }

  const showPanel = activeTab === 'tokens' || activeTab === 'build' || activeTab === 'props'

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', zIndex: 10 }}>
      {/* Tab strip */}
      <div style={{
        width: 48, background: 'rgba(8,12,8,0.95)', borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 56, gap: 6,
      }}>
        <TabButton icon="🧙" label="Tokens" active={activeTab === 'tokens'} onClick={() => handleTabClick('tokens')} />
        {isHost && (
          <TabButton icon="🏗️" label="Build" active={activeTab === 'build'} onClick={() => handleTabClick('build')} />
        )}
        {isHost && (
          <TabButton icon="🚪" label="Props" active={activeTab === 'props'} onClick={() => handleTabClick('props')} />
        )}
      </div>

      {/* Panel */}
      {showPanel && (
        <div style={{
          width: 220, background: 'rgba(10,15,10,0.92)', borderRight: '1px solid rgba(255,255,255,0.08)',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}>
          {activeTab === 'tokens' && (
            <SpritePicker
              selectedSpriteId={selectedSpriteId}
              onSelect={onSpriteSelect}
              onDeselect={onSpriteDeselect}
              activeWeather={activeWeather}
              onWeatherChange={onWeatherChange}
              activeBackground={activeBackground}
              onBackgroundChange={onBackgroundChange}
            />
          )}
          {activeTab === 'build' && isHost && (
            <BuildPanel {...buildPanel} />
          )}
          {activeTab === 'props' && isHost && (
            <PropPicker
              selectedPropId={selectedPropId}
              onSelect={onPropSelect}
              onDeselect={onPropDeselect}
            />
          )}
        </div>
      )}
    </div>
  )
}

function TabButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 36, height: 36, borderRadius: '50%', border: '2px solid',
        borderColor: active ? '#f0a84a' : 'rgba(255,255,255,0.12)',
        background: active ? 'rgba(240,168,74,0.18)' : 'rgba(255,255,255,0.05)',
        cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0,
      }}
    >
      {icon}
    </button>
  )
}

function BuildPanel({ wallTileId, floorTileId, buildMode, mergeMode, tiles, onWallSelect, onFloorSelect, onBuildModeChange, onMergeModeChange }: BuildPanelProps) {
  const byCategory = (cat: TileCategory) => tiles.filter((t) => t.category === cat)

  return (
    <div style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TileRow label="Wall" tiles={byCategory('wall')} selectedId={wallTileId} onSelect={onWallSelect} />
      <TileRow label="Floor" tiles={byCategory('floor')} selectedId={floorTileId} onSelect={onFloorSelect} />
      <div style={{ display: 'flex', gap: 6 }}>
        {(['build', 'erase'] as const).map((m) => (
          <button key={m} onClick={() => onBuildModeChange(m)} style={{
            flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
            borderRadius: 4, background: buildMode === m ? '#c8893a' : 'rgba(255,255,255,0.06)',
            color: buildMode === m ? '#000' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize',
          }}>{m}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['open', 'walled'] as const).map((m) => (
          <button key={m} onClick={() => onMergeModeChange(m)} style={{
            flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
            borderRadius: 4, background: mergeMode === m ? '#5a9a6a' : 'rgba(255,255,255,0.06)',
            color: mergeMode === m ? '#000' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize',
          }}>{m}</button>
        ))}
      </div>
    </div>
  )
}

function TileRow({ label, tiles, selectedId, onSelect }: { label: string; tiles: TileManifestEntry[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {tiles.map((t) => (
          <button key={t.id} onClick={() => onSelect(t.id)} title={t.label} style={{
            width: 36, height: 36, border: '2px solid',
            borderColor: selectedId === t.id ? '#f0a84a' : 'rgba(255,255,255,0.1)',
            borderRadius: 4, background: 'rgba(255,255,255,0.06)', cursor: 'pointer', padding: 2, overflow: 'hidden',
          }}>
            <img src={t.path} alt={t.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments"
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/Sidebar.tsx
git commit -m "feat: add Sidebar component with Tokens/Build/Props tabs"
```

---

### Task 9: RoomPage wiring

**Files:**
- Modify: `apps/client/src/pages/RoomPage.tsx`

This is the largest task. Read the full file before editing.

- [ ] **Step 1: Read RoomPage.tsx fully**

Read all of `apps/client/src/pages/RoomPage.tsx` before making any changes.

- [ ] **Step 2: Update imports**

Add these imports (add alongside existing imports):
```typescript
import { PropManager } from '../babylon/props'
import { Sidebar } from '../components/Sidebar'
import type { PropManifestEntry, TileManifestEntry } from '../types'
```

Remove the `BuildingPalette` import (it's replaced by Sidebar).

- [ ] **Step 3: Add prop-related state and refs**

After the existing `buildingMode`/`buildMode`/etc. state declarations, add:

```typescript
  const [selectedProp, setSelectedProp] = useState<PropManifestEntry | null>(null)
  const [tiles, setTiles] = useState<TileManifestEntry[]>([])
  const selectedPropRef = useRef<PropManifestEntry | null>(null)
  const propManagerRef = useRef<PropManager | null>(null)
  const propModeRef = useRef(false)
```

After `mergeModeRef.current = mergeMode` sync effect, add:
```typescript
  useEffect(() => { propModeRef.current = selectedProp !== null }, [selectedProp])
```

- [ ] **Step 4: Fetch tiles manifest for Sidebar BuildPanel**

Add a `useEffect` to fetch tile manifest (Sidebar's BuildPanel needs it):

```typescript
  useEffect(() => {
    fetch('/assets/tiles/manifest.json')
      .then((r) => r.json())
      .then((data: { tiles: TileManifestEntry[] }) => setTiles(data.tiles))
      .catch(() => {})
  }, [])
```

- [ ] **Step 5: Instantiate PropManager in the scene useEffect**

In the main scene `useEffect` (the large one that creates `BuildingManager`, `SpriteManager`, etc.), after `buildingManagerRef.current = new BuildingManager(scene)`:

```typescript
    propManagerRef.current = new PropManager(scene)
```

- [ ] **Step 6: Update createSession calls to pass PropManager**

Find the `createSession(...)` call in the main useEffect and the `createSession` helper function. The helper currently constructs `HostSession` and `GuestSession`. Update it to pass `propManagerRef.current`.

Find the `createSession` function definition (it's a helper defined outside the component or inside the useEffect). Add `propManager: PropManager` as a parameter and pass it to both constructors:

```typescript
function createSession(
  isHost: boolean,
  roomId: string | undefined,
  scene: Scene,
  spriteManager: SpriteManager,
  buildingManager: BuildingManager,
  propManager: PropManager,
  cursorManager: CursorManager,
  setConnected: (c: boolean) => void,
): HostSession | GuestSession {
  if (isHost) {
    return new HostSession(scene, spriteManager, buildingManager, propManager, cursorManager, (id) => {
      useRoomStore.getState().setRoomId(id)
      setConnected(true)
    })
  }
  return new GuestSession(roomId!, scene, spriteManager, buildingManager, propManager, cursorManager,
    () => setConnected(true),
    () => setConnected(false),
  )
}
```

Update the call site in the useEffect:
```typescript
    sessionRef.current = createSession(isHost, roomId, scene, spriteManager, buildingManagerRef.current!, propManagerRef.current!, cursorManager, setConnected)
```

- [ ] **Step 7: Add prop placement interaction in the pointerup handler**

In the canvas `pointerup` handler (`handlePointerUp`), add prop interaction logic. Currently the handler checks `dragController.consumeJustDropped()`, then sprite placement. Add prop logic between these:

After `if (dragController.consumeJustDropped()) return`, but only when NOT in building mode, add:

```typescript
      // Prop placement (host selecting a prop from palette)
      if (isHost && propModeRef.current && !buildingModeRef.current) {
        const selectedP = selectedPropRef.current
        if (selectedP) {
          const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.name === 'ground')
          if (pick?.hit && pick.pickedPoint) {
            const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
            if (buildingManagerRef.current?.isWallAt(col, row)) {
              const newId = nanoid()
              const prop = { instanceId: newId, propId: selectedP.id, col, row, state: { open: false } }
              useRoomStore.getState().placeProp(prop)
              propManagerRef.current?.place(prop, buildingManagerRef.current!)
              sendMsg(sessionRef.current, { type: 'prop:place', prop })
              setSelectedProp(null)
              selectedPropRef.current = null
            }
          }
          return
        }
      }

      // Prop interaction (any player taps on a prop cell)
      if (!buildingModeRef.current) {
        const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.name === 'ground')
        if (pick?.hit && pick.pickedPoint) {
          const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
          const propId = propManagerRef.current?.getInstanceIdAt(col, row)
          if (propId) {
            const existing = useRoomStore.getState().builderProps[propId]
            if (existing) {
              const newState = { ...existing.state, open: !existing.state.open }
              useRoomStore.getState().setPropState(propId, newState)
              propManagerRef.current?.setState(propId, newState)
              sendMsg(sessionRef.current, { type: 'prop:interact', instanceId: propId, state: newState })
              return
            }
          }
        }
      }
```

- [ ] **Step 8: Add PropManager to cleanup in the useEffect return**

In the cleanup return function of the main `useEffect`, after `buildingManagerRef.current?.dispose()`:
```typescript
      propManagerRef.current?.dispose()
      propManagerRef.current = null
```

- [ ] **Step 9: Replace BuildingPalette and SpritePicker with Sidebar in JSX**

Find the JSX return statement. Remove the `<BuildingPalette .../>` component and the direct `<SpritePicker .../>` component. Replace with a single `<Sidebar>` component:

```typescript
        <Sidebar
          isHost={isHost}
          selectedSpriteId={selectedSprite?.id ?? null}
          onSpriteSelect={handleSelectSprite}
          onSpriteDeselect={handleDeselectSprite}
          activeWeather={currentWeather}
          onWeatherChange={handleWeatherChange}
          activeBackground={currentBackground}
          onBackgroundChange={handleBackgroundChange}
          buildingMode={buildingMode}
          onBuildingModeChange={setBuildingMode}
          buildPanel={{
            wallTileId,
            floorTileId,
            buildMode,
            mergeMode,
            tiles,
            onWallSelect: (id) => { setWallTileId(id); wallTileIdRef.current = id },
            onFloorSelect: (id) => { setFloorTileId(id); floorTileIdRef.current = id },
            onBuildModeChange: (m) => { setBuildMode(m); buildModeRef.current = m },
            onMergeModeChange: (m) => { setMergeMode(m); mergeModeRef.current = m },
          }}
          selectedPropId={selectedProp?.id ?? null}
          onPropSelect={(entry) => { setSelectedProp(entry); selectedPropRef.current = entry }}
          onPropDeselect={() => { setSelectedProp(null); selectedPropRef.current = null }}
        />
```

Also adjust the `canvasRect` left offset: previously the canvas left was 200px (to account for SpritePicker). Now it should be 268px (48px tab strip + 220px panel). Update the `canvasRect` initial state and the `updateCanvasRect` call if it uses a hardcoded offset, OR ensure the canvas element is laid out with `left: 268px` using CSS. The canvas `style` in JSX likely has `left: 200` — change that to `left: 268`.

- [ ] **Step 10: Verify TypeScript compiles with 0 errors**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments"
npx tsc --noEmit 2>&1 | head -50
```

Fix any remaining errors before committing.

- [ ] **Step 11: Commit**

```bash
git add apps/client/src/pages/RoomPage.tsx
git commit -m "feat: wire PropManager and Sidebar into RoomPage"
```

---

## Manual Test Checklist

After all tasks are complete, test the following in the running app:

- [ ] Host: Props tab appears in sidebar, Tokens tab and Build tab also present
- [ ] Guest: Props tab does NOT appear (guest sees only Tokens tab)
- [ ] Host: Select "Wooden Door" from Props tab, click on a wall tile → door frame appears, wall hidden
- [ ] Host: Cannot place a door on a floor tile or empty cell (nothing happens)
- [ ] Host: Click the door → panel hides (door opens)
- [ ] Host: Click again → panel shows (door closes)
- [ ] Guest: Join room → sees door rendered correctly via prop:snapshot
- [ ] Guest: Click door → sends prop:interact → both host and guest see state change
- [ ] Host: Remove wall tile that has a door placed → door stays (door is independent of wall tile)
- [ ] Host: Build tab tile selector still works correctly
- [ ] Tokens tab: sprite picker still works correctly

