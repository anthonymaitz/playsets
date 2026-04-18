# Playsets VTT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time multiplayer 3D virtual tabletop web app where players drag isometric sprites onto a rotating 3D grid and see each other's moves live.

**Architecture:** Host-owned rooms using WebRTC DataChannels for peer-to-peer game state; a lightweight Node.js signaling server on Fly.io handles only WebRTC handshakes. The host's browser is authoritative; guests receive a state snapshot on join. Frontend is BabylonJS + React in a pnpm monorepo.

**Tech Stack:** TypeScript, React 18, BabylonJS 7, Vite, Vitest, Zustand, Socket.io (client + server), nanoid, pnpm workspaces, Cloudflare Pages (frontend), Fly.io (signaling server)

---

## File Map

```
playsets-experiments/
├── package.json                          # pnpm workspace root
├── pnpm-workspace.yaml
├── apps/
│   ├── client/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx                  # React entry + BabylonJS canvas mount
│   │       ├── App.tsx                   # Router: home (create) vs /room/:id (play)
│   │       ├── types.ts                  # All shared TS interfaces + GameMessage union
│   │       ├── babylon/
│   │       │   ├── scene.ts              # Engine, scene, camera setup
│   │       │   ├── grid.ts               # Ground mesh, grid lines, coordinate math
│   │       │   ├── sprites.ts            # SpriteManager: place/move/remove/highlight
│   │       │   ├── drag.ts               # DragController: ghost mesh, snapping, events
│   │       │   ├── emotes.ts             # showEmote(): floating emoji above sprite
│   │       │   └── cursors.ts            # CursorManager: other players' cursor dots
│   │       ├── networking/
│   │       │   ├── signaling.ts          # SignalingClient: Socket.io room create/join
│   │       │   ├── peer.ts               # PeerConnection: RTCPeerConnection + DataChannels
│   │       │   ├── messages.ts           # send() helpers typed to GameMessage
│   │       │   ├── host.ts               # HostSession: state authority, snapshot on join
│   │       │   └── guest.ts              # GuestSession: apply incoming messages to scene
│   │       ├── store/
│   │       │   ├── room.ts               # Zustand: RoomState (sprites map)
│   │       │   └── players.ts            # Zustand: Player[] + local player identity
│   │       └── components/
│   │           ├── SpritePicker.tsx      # Sidebar: categories, search, click-to-select
│   │           ├── EmoteMenu.tsx         # Popup: 8 emote buttons on sprite click
│   │           ├── TopBar.tsx            # Room ID chip, Copy Link, Players button
│   │           ├── PlayerList.tsx        # Dropdown list of connected players
│   │           └── JoinDialog.tsx        # Display-name prompt on first visit
│   └── server/
│       ├── package.json
│       ├── tsconfig.json
│       ├── fly.toml
│       ├── Dockerfile
│       └── src/
│           ├── rooms.ts                  # RoomRegistry: in-memory room map + TTL
│           ├── rooms.test.ts
│           └── index.ts                  # Socket.io server: create-room, join-room, relay
└── scripts/
    └── generate-manifest.mjs             # Scan public/assets/sprites → manifest.json
```

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `apps/client/package.json`
- Create: `apps/client/vite.config.ts`
- Create: `apps/client/tsconfig.json`
- Create: `apps/client/index.html`
- Create: `apps/client/src/main.tsx`
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts` (stub)

- [ ] **Step 1: Create workspace root**

```bash
cd "playsets experiments"
```

Create `package.json`:
```json
{
  "name": "playsets",
  "private": true,
  "scripts": {
    "dev:client": "pnpm --filter client dev",
    "dev:server": "pnpm --filter server dev",
    "test": "pnpm -r test"
  }
}
```

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
```

- [ ] **Step 2: Create client package**

Create `apps/client/package.json`:
```json
{
  "name": "client",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@babylonjs/core": "^7.0.0",
    "nanoid": "^5.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "socket.io-client": "^4.7.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

Create `apps/client/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
```

Create `apps/client/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"]
}
```

Create `apps/client/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Playsets</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #1e1e24; color: #eee; font-family: system-ui, sans-serif; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/client/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```

- [ ] **Step 3: Create server package**

Create `apps/server/package.json`:
```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "nanoid": "^5.0.0",
    "socket.io": "^4.7.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

Create `apps/server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "strict": true,
    "noUnusedLocals": true
  },
  "include": ["src"]
}
```

Create `apps/server/src/index.ts` (stub):
```ts
console.log('server starting...')
```

- [ ] **Step 4: Install dependencies**

```bash
pnpm install
```

Expected: packages install without errors; `node_modules` appears in each app.

- [ ] **Step 5: Verify client dev server starts**

```bash
pnpm dev:client
```

Expected: Vite prints `Local: http://localhost:5173` and browser shows blank page with dark background.

Kill with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git init
git add package.json pnpm-workspace.yaml apps/
git commit -m "feat: monorepo scaffold — client (React+Vite+BabylonJS) and server (Node+Socket.io)"
```

---

## Task 2: Shared Types

**Files:**
- Create: `apps/client/src/types.ts`
- Create: `apps/client/src/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/client/src/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { GameMessage, SpriteInstance, Player } from './types'

describe('GameMessage type guards', () => {
  it('sprite:place message has required fields', () => {
    const msg: GameMessage = {
      type: 'sprite:place',
      spriteId: 'token-warrior',
      col: 3,
      row: 5,
      instanceId: 'abc123',
      placedBy: 'player-1',
    }
    expect(msg.type).toBe('sprite:place')
    if (msg.type === 'sprite:place') {
      expect(msg.col).toBe(3)
      expect(msg.spriteId).toBe('token-warrior')
    }
  })

  it('state:snapshot contains sprites array', () => {
    const sprite: SpriteInstance = { instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1' }
    const player: Player = { playerId: 'p1', displayName: 'Alice', color: '#f00' }
    const msg: GameMessage = { type: 'state:snapshot', sprites: [sprite], players: [player] }
    expect(msg.type).toBe('state:snapshot')
    if (msg.type === 'state:snapshot') {
      expect(msg.sprites).toHaveLength(1)
    }
  })
})
```

- [ ] **Step 2: Run test to see it fail**

```bash
cd apps/client && pnpm test
```

Expected: FAIL — `Cannot find module './types'`

- [ ] **Step 3: Create types.ts**

Create `apps/client/src/types.ts`:
```ts
export interface SpriteInstance {
  instanceId: string
  spriteId: string
  col: number
  row: number
  placedBy: string
}

export interface Player {
  playerId: string
  displayName: string
  color: string
}

export interface SpriteManifestEntry {
  id: string
  label: string
  path: string
}

export interface SpriteCategory {
  id: string
  label: string
  sprites: SpriteManifestEntry[]
}

export interface SpriteManifest {
  categories: SpriteCategory[]
}

export type GameMessage =
  | { type: 'state:snapshot'; sprites: SpriteInstance[]; players: Player[] }
  | { type: 'sprite:place'; spriteId: string; col: number; row: number; instanceId: string; placedBy: string }
  | { type: 'sprite:move'; instanceId: string; col: number; row: number }
  | { type: 'sprite:remove'; instanceId: string }
  | { type: 'sprite:emote'; instanceId: string; emote: string }
  | { type: 'sprite:drag'; instanceId: string; col: number; row: number }
  | { type: 'cursor:move'; playerId: string; worldX: number; worldZ: number }
  | { type: 'player:join'; playerId: string; displayName: string; color: string }
  | { type: 'player:leave'; playerId: string }
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/types.ts apps/client/src/types.test.ts
git commit -m "feat: shared TypeScript types and GameMessage union"
```

---

## Task 3: Signaling Server — Room Registry

**Files:**
- Create: `apps/server/src/rooms.ts`
- Create: `apps/server/src/rooms.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/server/src/rooms.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { RoomRegistry } from './rooms'

describe('RoomRegistry', () => {
  let registry: RoomRegistry

  beforeEach(() => { registry = new RoomRegistry() })

  it('creates a room with an 8-char roomId', () => {
    const entry = registry.create('socket-host')
    expect(entry.roomId).toHaveLength(8)
    expect(entry.hostSocketId).toBe('socket-host')
    expect(entry.guestSocketIds).toHaveLength(0)
  })

  it('retrieves a created room by id', () => {
    const { roomId } = registry.create('socket-host')
    expect(registry.get(roomId)).toBeDefined()
  })

  it('returns undefined for unknown roomId', () => {
    expect(registry.get('no-such-room')).toBeUndefined()
  })

  it('adds guests up to the limit of 3', () => {
    const { roomId } = registry.create('host')
    expect(registry.addGuest(roomId, 'g1')).toBe('ok')
    expect(registry.addGuest(roomId, 'g2')).toBe('ok')
    expect(registry.addGuest(roomId, 'g3')).toBe('ok')
    expect(registry.addGuest(roomId, 'g4')).toBe('full')
  })

  it('returns not-found when adding guest to missing room', () => {
    expect(registry.addGuest('nope', 'g1')).toBe('not-found')
  })

  it('removes host and deletes the room', () => {
    const { roomId } = registry.create('host')
    registry.removeSocket('host')
    expect(registry.get(roomId)).toBeUndefined()
  })

  it('removes a guest but keeps the room', () => {
    const { roomId } = registry.create('host')
    registry.addGuest(roomId, 'guest')
    registry.removeSocket('guest')
    const entry = registry.get(roomId)
    expect(entry).toBeDefined()
    expect(entry?.guestSocketIds).toHaveLength(0)
  })

  it('findRoomBySocket finds a host', () => {
    const { roomId } = registry.create('host')
    expect(registry.findRoomBySocket('host')?.roomId).toBe(roomId)
  })

  it('findRoomBySocket finds a guest', () => {
    const { roomId } = registry.create('host')
    registry.addGuest(roomId, 'guest')
    expect(registry.findRoomBySocket('guest')?.roomId).toBe(roomId)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/server && pnpm test
```

Expected: FAIL — `Cannot find module './rooms'`

- [ ] **Step 3: Implement rooms.ts**

Create `apps/server/src/rooms.ts`:
```ts
import { nanoid } from 'nanoid'

export interface RoomEntry {
  roomId: string
  hostSocketId: string
  guestSocketIds: string[]
  createdAt: number
}

export class RoomRegistry {
  private rooms = new Map<string, RoomEntry>()
  private readonly TTL_MS = 24 * 60 * 60 * 1000

  create(hostSocketId: string): RoomEntry {
    const entry: RoomEntry = {
      roomId: nanoid(8),
      hostSocketId,
      guestSocketIds: [],
      createdAt: Date.now(),
    }
    this.rooms.set(entry.roomId, entry)
    return entry
  }

  get(roomId: string): RoomEntry | undefined {
    const entry = this.rooms.get(roomId)
    if (!entry) return undefined
    if (Date.now() - entry.createdAt > this.TTL_MS) {
      this.rooms.delete(roomId)
      return undefined
    }
    return entry
  }

  addGuest(roomId: string, guestSocketId: string): 'ok' | 'full' | 'not-found' {
    const entry = this.get(roomId)
    if (!entry) return 'not-found'
    if (entry.guestSocketIds.length >= 3) return 'full'
    entry.guestSocketIds.push(guestSocketId)
    return 'ok'
  }

  removeSocket(socketId: string): void {
    for (const [roomId, entry] of this.rooms) {
      if (entry.hostSocketId === socketId) {
        this.rooms.delete(roomId)
        return
      }
      const idx = entry.guestSocketIds.indexOf(socketId)
      if (idx !== -1) {
        entry.guestSocketIds.splice(idx, 1)
        return
      }
    }
  }

  findRoomBySocket(socketId: string): RoomEntry | undefined {
    for (const entry of this.rooms.values()) {
      if (entry.hostSocketId === socketId || entry.guestSocketIds.includes(socketId)) {
        return entry
      }
    }
    return undefined
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test
```

Expected: PASS — 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/rooms.ts apps/server/src/rooms.test.ts
git commit -m "feat: signaling server room registry with TTL and guest limits"
```

---

## Task 4: Signaling Server — Socket.io Event Handlers

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Implement index.ts**

Replace `apps/server/src/index.ts` with:
```ts
import { createServer } from 'http'
import { Server } from 'socket.io'
import { RoomRegistry } from './rooms.js'

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001
const registry = new RoomRegistry()
const http = createServer()
const io = new Server(http, {
  cors: { origin: '*' },
})

io.on('connection', (socket) => {
  socket.on('create-room', (cb: (res: { roomId: string }) => void) => {
    const entry = registry.create(socket.id)
    socket.join(entry.roomId)
    cb({ roomId: entry.roomId })
  })

  socket.on('join-room', (roomId: string, cb: (res: { error?: string }) => void) => {
    const result = registry.addGuest(roomId, socket.id)
    if (result === 'not-found') { cb({ error: 'room-not-found' }); return }
    if (result === 'full') { cb({ error: 'room-full' }); return }
    socket.join(roomId)
    const entry = registry.get(roomId)!
    // Notify host that a guest wants to connect
    socket.to(entry.hostSocketId).emit('guest-joined', socket.id)
    cb({})
  })

  // Host sends offer to a specific guest
  socket.on('offer', (payload: { to: string; offer: RTCSessionDescriptionInit }) => {
    io.to(payload.to).emit('offer', { from: socket.id, offer: payload.offer })
  })

  // Guest sends answer back to host
  socket.on('answer', (payload: { to: string; answer: RTCSessionDescriptionInit }) => {
    io.to(payload.to).emit('answer', { from: socket.id, answer: payload.answer })
  })

  // ICE candidates relayed between any two peers
  socket.on('ice-candidate', (payload: { to: string; candidate: RTCIceCandidateInit }) => {
    io.to(payload.to).emit('ice-candidate', { from: socket.id, candidate: payload.candidate })
  })

  socket.on('disconnect', () => {
    const entry = registry.findRoomBySocket(socket.id)
    if (entry) {
      const isHost = entry.hostSocketId === socket.id
      if (isHost) {
        // Notify all guests that host left
        socket.to(entry.roomId).emit('host-disconnected')
      } else {
        socket.to(entry.hostSocketId).emit('guest-left', socket.id)
      }
    }
    registry.removeSocket(socket.id)
  })
})

http.listen(PORT, () => console.log(`Signaling server listening on :${PORT}`))
```

- [ ] **Step 2: Start server and verify it starts**

```bash
cd apps/server && pnpm dev
```

Expected output:
```
Signaling server listening on :3001
```

Kill with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat: signaling server Socket.io handlers (create-room, join-room, WebRTC relay)"
```

---

## Task 5: BabylonJS Scene + Camera

**Files:**
- Create: `apps/client/src/babylon/scene.ts`

- [ ] **Step 1: Create scene.ts**

Create `apps/client/src/babylon/scene.ts`:
```ts
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color4,
  Color3,
} from '@babylonjs/core'

export interface SceneContext {
  engine: Engine
  scene: Scene
  camera: ArcRotateCamera
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.12, 0.12, 0.16, 1)

  // Isometric-style camera: locked elevation, free horizontal rotation
  const camera = new ArcRotateCamera('camera', -Math.PI / 4, Math.PI / 3.5, 24, Vector3.Zero(), scene)
  camera.lowerBetaLimit = Math.PI / 3.5   // lock tilt at isometric angle
  camera.upperBetaLimit = Math.PI / 3.5
  camera.lowerRadiusLimit = 8
  camera.upperRadiusLimit = 40
  camera.attachControl(canvas, true)
  // Disable default panning (right-click) — only rotate + zoom
  camera.panningSensibility = 0

  const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
  light.intensity = 0.9
  light.diffuse = new Color3(1, 1, 1)
  light.groundColor = new Color3(0.3, 0.3, 0.4)

  engine.runRenderLoop(() => scene.render())
  window.addEventListener('resize', () => engine.resize())

  return { engine, scene, camera }
}
```

- [ ] **Step 2: Wire into App.tsx temporarily for visual check**

Create `apps/client/src/App.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { createScene } from './babylon/scene'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const { engine } = createScene(canvasRef.current)
    return () => engine.dispose()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    />
  )
}
```

- [ ] **Step 3: Run dev server and verify visually**

```bash
pnpm dev:client
```

Open `http://localhost:5173`. Expected: dark grey canvas, no errors in console, camera can be rotated with mouse drag (horizontal only).

Kill with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/babylon/scene.ts apps/client/src/App.tsx
git commit -m "feat: BabylonJS scene with locked-elevation ArcRotateCamera"
```

---

## Task 6: Grid + Coordinate Math

**Files:**
- Create: `apps/client/src/babylon/grid.ts`
- Create: `apps/client/src/babylon/grid.test.ts`

- [ ] **Step 1: Write failing tests for coordinate math**

Create `apps/client/src/babylon/grid.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/client && pnpm test
```

Expected: FAIL — `Cannot find module './grid'`

- [ ] **Step 3: Implement grid.ts**

Create `apps/client/src/babylon/grid.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test
```

Expected: PASS — all coordinate tests pass.

- [ ] **Step 5: Add grid to App.tsx for visual check**

Edit `apps/client/src/App.tsx`, update the useEffect:
```tsx
import { useEffect, useRef } from 'react'
import { createScene } from './babylon/scene'
import { createGrid } from './babylon/grid'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const { engine, scene } = createScene(canvasRef.current)
    createGrid(scene)
    return () => engine.dispose()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    />
  )
}
```

Run `pnpm dev:client`. Expected: 20×20 grid visible, dark ground with subtle grid lines, horizontal camera rotation works.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/babylon/grid.ts apps/client/src/babylon/grid.test.ts apps/client/src/App.tsx
git commit -m "feat: 3D grid with isometric coordinate math (cellToWorld / worldToCell)"
```

---

## Task 7: Sprite Manager

**Files:**
- Create: `apps/client/src/babylon/sprites.ts`

- [ ] **Step 1: Create sprites.ts**

Create `apps/client/src/babylon/sprites.ts`:
```ts
import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Texture,
  Mesh,
  Vector3,
  Color3,
  AbstractMesh,
} from '@babylonjs/core'
import { cellToWorld, CELL_SIZE } from './grid'
import type { SpriteInstance } from '../types'

const SPRITE_HEIGHT = CELL_SIZE * 1.6
const textureCache = new Map<string, Texture>()

function getTexture(path: string, scene: Scene): Texture {
  if (!textureCache.has(path)) {
    textureCache.set(path, new Texture(path, scene, false, false))
  }
  return textureCache.get(path)!
}

export class SpriteManager {
  private meshes = new Map<string, Mesh>()

  constructor(private scene: Scene) {}

  place(instance: SpriteInstance, spritePath: string): void {
    if (this.meshes.has(instance.instanceId)) return
    const { x, z } = cellToWorld(instance.col, instance.row)

    const plane = MeshBuilder.CreatePlane(
      `sprite-${instance.instanceId}`,
      { width: CELL_SIZE * 0.9, height: SPRITE_HEIGHT },
      this.scene,
    )
    plane.position = new Vector3(x, SPRITE_HEIGHT / 2, z)
    plane.billboardMode = Mesh.BILLBOARDMODE_Y

    const mat = new StandardMaterial(`mat-${instance.instanceId}`, this.scene)
    const tex = getTexture(spritePath, this.scene)
    tex.hasAlpha = true
    mat.diffuseTexture = tex
    mat.useAlphaFromDiffuseTexture = true
    mat.backFaceCulling = false
    plane.material = mat

    plane.metadata = { instanceId: instance.instanceId }
    this.meshes.set(instance.instanceId, plane)
  }

  move(instanceId: string, col: number, row: number): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    const { x, z } = cellToWorld(col, row)
    mesh.position.x = x
    mesh.position.z = z
  }

  remove(instanceId: string): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    mesh.dispose()
    this.meshes.delete(instanceId)
  }

  setHighlight(instanceId: string, on: boolean): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh || !(mesh.material instanceof StandardMaterial)) return
    ;(mesh.material as StandardMaterial).emissiveColor = on
      ? new Color3(0.4, 0.4, 0.4)
      : Color3.Black()
  }

  getInstanceId(picked: AbstractMesh): string | undefined {
    return picked.metadata?.instanceId as string | undefined
  }

  getMesh(instanceId: string): Mesh | undefined {
    return this.meshes.get(instanceId)
  }

  clear(): void {
    for (const mesh of this.meshes.values()) mesh.dispose()
    this.meshes.clear()
  }
}
```

- [ ] **Step 2: Add a test sprite to App.tsx for visual check**

The visual check requires a real PNG. Create a placeholder:
```bash
mkdir -p apps/client/public/assets/sprites/tokens
# Copy any small PNG into this folder as test-sprite.png
# (use any PNG from your system for now)
```

Edit `apps/client/src/App.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { createScene } from './babylon/scene'
import { createGrid } from './babylon/grid'
import { SpriteManager } from './babylon/sprites'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const { engine, scene } = createScene(canvasRef.current)
    createGrid(scene)

    const spriteManager = new SpriteManager(scene)
    spriteManager.place(
      { instanceId: 'test-1', spriteId: 'test', col: 10, row: 10, placedBy: 'me' },
      '/assets/sprites/tokens/test-sprite.png',
    )

    return () => engine.dispose()
  }, [])

  return (
    <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', display: 'block' }} />
  )
}
```

Run `pnpm dev:client`. Expected: sprite appears on the grid at cell (10,10), rotates with camera (billboard mode).

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/babylon/sprites.ts apps/client/src/App.tsx
git commit -m "feat: SpriteManager — billboard sprite placement on 3D grid"
```

---

## Task 8: Drag Interaction

**Files:**
- Create: `apps/client/src/babylon/drag.ts`

- [ ] **Step 1: Create drag.ts**

Create `apps/client/src/babylon/drag.ts`:
```ts
import { Scene, PointerEventTypes, MeshBuilder, StandardMaterial, Color3, Mesh, Vector3, Ray } from '@babylonjs/core'
import { SpriteManager } from './sprites'
import { worldToCell, cellToWorld, CELL_SIZE, GRID_COLS, GRID_ROWS } from './grid'

export interface DragCallbacks {
  onDragMove: (instanceId: string, col: number, row: number) => void
  onDragDrop: (instanceId: string, col: number, row: number) => void
  onSpriteClick: (instanceId: string) => void
}

export class DragController {
  private dragging: { instanceId: string; originalCol: number; originalRow: number } | null = null
  private ghost: Mesh | null = null

  constructor(
    private scene: Scene,
    private spriteManager: SpriteManager,
    private callbacks: DragCallbacks,
  ) {
    this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERDOWN) this.onDown(info)
      if (info.type === PointerEventTypes.POINTERMOVE) this.onMove()
      if (info.type === PointerEventTypes.POINTERUP) this.onUp()
    })
  }

  private onDown(info: { pickInfo?: { pickedMesh?: { metadata?: unknown } | null } | null }): void {
    const picked = info.pickInfo?.pickedMesh
    if (!picked) return
    const instanceId = this.spriteManager.getInstanceId(picked as import('@babylonjs/core').AbstractMesh)
    if (!instanceId) return

    const mesh = this.spriteManager.getMesh(instanceId)
    if (!mesh) return
    const col = worldToCell(mesh.position.x, mesh.position.z).col
    const row = worldToCell(mesh.position.x, mesh.position.z).row

    this.dragging = { instanceId, originalCol: col, originalRow: row }
    this.spriteManager.setHighlight(instanceId, true)

    // Create ghost
    this.ghost = MeshBuilder.CreateBox('ghost', { size: CELL_SIZE * 0.9 }, this.scene)
    const ghostMat = new StandardMaterial('ghost-mat', this.scene)
    ghostMat.diffuseColor = new Color3(0.5, 0.8, 1)
    ghostMat.alpha = 0.4
    this.ghost.material = ghostMat
    const { x, z } = cellToWorld(col, row)
    this.ghost.position = new Vector3(x, 0.3, z)
  }

  private onMove(): void {
    if (!this.dragging || !this.ghost) return
    const cell = this.pickGroundCell()
    if (!cell) return
    const { x, z } = cellToWorld(cell.col, cell.row)
    this.ghost.position.x = x
    this.ghost.position.z = z
    this.callbacks.onDragMove(this.dragging.instanceId, cell.col, cell.row)
  }

  private onUp(): void {
    if (!this.dragging) return
    const cell = this.pickGroundCell()
    const { instanceId } = this.dragging

    if (cell) {
      this.spriteManager.move(instanceId, cell.col, cell.row)
      this.callbacks.onDragDrop(instanceId, cell.col, cell.row)
    } else {
      // Return to original position
      this.spriteManager.move(instanceId, this.dragging.originalCol, this.dragging.originalRow)
    }

    this.spriteManager.setHighlight(instanceId, false)
    this.ghost?.dispose()
    this.ghost = null
    this.dragging = null
  }

  private pickGroundCell(): { col: number; row: number } | null {
    const pick = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      (mesh) => mesh.name === 'ground',
    )
    if (!pick?.hit || !pick.pickedPoint) return null
    const cell = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
    if (cell.col < 0 || cell.col >= GRID_COLS || cell.row < 0 || cell.row >= GRID_ROWS) return null
    return cell
  }

  dispose(): void {
    this.ghost?.dispose()
  }
}
```

- [ ] **Step 2: Wire drag into App.tsx for visual check**

Edit `apps/client/src/App.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { createScene } from './babylon/scene'
import { createGrid } from './babylon/grid'
import { SpriteManager } from './babylon/sprites'
import { DragController } from './babylon/drag'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const { engine, scene } = createScene(canvasRef.current)
    createGrid(scene)
    const spriteManager = new SpriteManager(scene)
    spriteManager.place(
      { instanceId: 'test-1', spriteId: 'test', col: 10, row: 10, placedBy: 'me' },
      '/assets/sprites/tokens/test-sprite.png',
    )
    new DragController(scene, spriteManager, {
      onDragMove: (id, col, row) => console.log('drag', id, col, row),
      onDragDrop: (id, col, row) => console.log('drop', id, col, row),
      onSpriteClick: (id) => console.log('click', id),
    })
    return () => engine.dispose()
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', display: 'block' }} />
}
```

Run `pnpm dev:client`. Expected: clicking and dragging the test sprite moves it; ghost box follows cursor; sprite snaps to grid cell on release. Console shows drag/drop events.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/babylon/drag.ts apps/client/src/App.tsx
git commit -m "feat: DragController — sprite dragging with ghost preview and grid snapping"
```

---

## Task 9: Emote Animation + Cursor Visualization

**Files:**
- Create: `apps/client/src/babylon/emotes.ts`
- Create: `apps/client/src/babylon/cursors.ts`

- [ ] **Step 1: Create emotes.ts**

Create `apps/client/src/babylon/emotes.ts`:
```ts
import { Scene, MeshBuilder, DynamicTexture, StandardMaterial, Vector3, Mesh } from '@babylonjs/core'
import { cellToWorld, CELL_SIZE } from './grid'

const EMOTE_DURATION_MS = 3000

export function showEmote(scene: Scene, col: number, row: number, emote: string): void {
  const { x, z } = cellToWorld(col, row)

  const texture = new DynamicTexture('emote-tex', { width: 128, height: 128 }, scene, false)
  texture.hasAlpha = true
  const ctx = texture.getContext()
  ctx.clearRect(0, 0, 128, 128)
  ctx.font = '80px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emote, 64, 64)
  texture.update()

  const plane = MeshBuilder.CreatePlane('emote', { width: CELL_SIZE, height: CELL_SIZE }, scene)
  plane.position = new Vector3(x, CELL_SIZE * 2.5, z)
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL

  const mat = new StandardMaterial('emote-mat', scene)
  mat.diffuseTexture = texture
  mat.useAlphaFromDiffuseTexture = true
  mat.backFaceCulling = false
  plane.material = mat

  let elapsed = 0
  const obs = scene.onBeforeRenderObservable.add(() => {
    elapsed += scene.getEngine().getDeltaTime()
    const t = elapsed / EMOTE_DURATION_MS
    plane.position.y = CELL_SIZE * 2.5 + t * CELL_SIZE
    plane.visibility = Math.max(0, 1 - t)
    if (elapsed >= EMOTE_DURATION_MS) {
      plane.dispose()
      texture.dispose()
      scene.onBeforeRenderObservable.remove(obs)
    }
  })
}
```

- [ ] **Step 2: Create cursors.ts**

Create `apps/client/src/babylon/cursors.ts`:
```ts
import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, DynamicTexture, Mesh } from '@babylonjs/core'

interface CursorEntry {
  dot: Mesh
  label: Mesh
}

export class CursorManager {
  private cursors = new Map<string, CursorEntry>()

  constructor(private scene: Scene) {}

  upsert(playerId: string, displayName: string, color: string, worldX: number, worldZ: number): void {
    let entry = this.cursors.get(playerId)

    if (!entry) {
      const dot = MeshBuilder.CreateSphere(`cursor-${playerId}`, { diameter: 0.3 }, this.scene)
      const dotMat = new StandardMaterial(`cursor-mat-${playerId}`, this.scene)
      dotMat.diffuseColor = Color3.FromHexString(color)
      dotMat.emissiveColor = Color3.FromHexString(color)
      dot.material = dotMat

      const texture = new DynamicTexture(`label-tex-${playerId}`, { width: 256, height: 64 }, this.scene, false)
      texture.hasAlpha = true
      const ctx = texture.getContext()
      ctx.font = 'bold 28px sans-serif'
      ctx.fillStyle = color
      ctx.fillText(displayName, 4, 48)
      texture.update()

      const label = MeshBuilder.CreatePlane(`label-${playerId}`, { width: 2, height: 0.5 }, this.scene)
      const labelMat = new StandardMaterial(`label-mat-${playerId}`, this.scene)
      labelMat.diffuseTexture = texture
      labelMat.useAlphaFromDiffuseTexture = true
      labelMat.backFaceCulling = false
      label.material = labelMat
      label.billboardMode = Mesh.BILLBOARDMODE_ALL

      entry = { dot, label }
      this.cursors.set(playerId, entry)
    }

    entry.dot.position = new Vector3(worldX, 0.2, worldZ)
    entry.label.position = new Vector3(worldX, 0.8, worldZ)
  }

  remove(playerId: string): void {
    const entry = this.cursors.get(playerId)
    if (!entry) return
    entry.dot.dispose()
    entry.label.dispose()
    this.cursors.delete(playerId)
  }

  clear(): void {
    for (const id of this.cursors.keys()) this.remove(id)
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/babylon/emotes.ts apps/client/src/babylon/cursors.ts
git commit -m "feat: floating emote animation and real-time cursor visualization"
```

---

## Task 10: Room State Store (Zustand)

**Files:**
- Create: `apps/client/src/store/room.ts`
- Create: `apps/client/src/store/players.ts`
- Create: `apps/client/src/store/room.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/client/src/store/room.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useRoomStore } from './room'

describe('useRoomStore', () => {
  beforeEach(() => {
    useRoomStore.getState().reset()
  })

  it('starts with empty sprites map', () => {
    expect(Object.keys(useRoomStore.getState().sprites)).toHaveLength(0)
  })

  it('placeSprite adds a sprite', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 3, row: 4, placedBy: 'p1' })
    expect(useRoomStore.getState().sprites['i1']).toMatchObject({ col: 3, row: 4 })
  })

  it('moveSprite updates col and row', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1' })
    useRoomStore.getState().moveSprite('i1', 5, 6)
    expect(useRoomStore.getState().sprites['i1']).toMatchObject({ col: 5, row: 6 })
  })

  it('removeSprite deletes the sprite', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1' })
    useRoomStore.getState().removeSprite('i1')
    expect(useRoomStore.getState().sprites['i1']).toBeUndefined()
  })

  it('loadSnapshot replaces all sprites', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'old', spriteId: 's1', col: 0, row: 0, placedBy: 'p1' })
    useRoomStore.getState().loadSnapshot([
      { instanceId: 'new1', spriteId: 's2', col: 1, row: 1, placedBy: 'p2' },
    ])
    expect(useRoomStore.getState().sprites['old']).toBeUndefined()
    expect(useRoomStore.getState().sprites['new1']).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/client && pnpm test
```

Expected: FAIL — `Cannot find module './room'`

- [ ] **Step 3: Implement room.ts**

Create `apps/client/src/store/room.ts`:
```ts
import { create } from 'zustand'
import type { SpriteInstance } from '../types'

interface RoomStore {
  roomId: string | null
  sprites: Record<string, SpriteInstance>
  setRoomId: (id: string) => void
  placeSprite: (s: SpriteInstance) => void
  moveSprite: (instanceId: string, col: number, row: number) => void
  removeSprite: (instanceId: string) => void
  loadSnapshot: (sprites: SpriteInstance[]) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  roomId: null,
  sprites: {},
  setRoomId: (id) => set({ roomId: id }),
  placeSprite: (s) => set((state) => ({ sprites: { ...state.sprites, [s.instanceId]: s } })),
  moveSprite: (instanceId, col, row) =>
    set((state) => ({
      sprites: {
        ...state.sprites,
        [instanceId]: { ...state.sprites[instanceId], col, row },
      },
    })),
  removeSprite: (instanceId) =>
    set((state) => {
      const { [instanceId]: _, ...rest } = state.sprites
      return { sprites: rest }
    }),
  loadSnapshot: (sprites) =>
    set({ sprites: Object.fromEntries(sprites.map((s) => [s.instanceId, s])) }),
  reset: () => set({ roomId: null, sprites: {} }),
}))
```

Create `apps/client/src/store/players.ts`:
```ts
import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Player } from '../types'

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']

interface PlayersStore {
  localPlayer: Player
  players: Player[]
  setDisplayName: (name: string) => void
  addPlayer: (p: Player) => void
  removePlayer: (playerId: string) => void
  loadPlayers: (players: Player[]) => void
  reset: () => void
}

function makeLocalPlayer(): Player {
  const stored = localStorage.getItem('playsets-player')
  if (stored) return JSON.parse(stored) as Player
  const player: Player = {
    playerId: nanoid(),
    displayName: '',
    color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
  }
  localStorage.setItem('playsets-player', JSON.stringify(player))
  return player
}

export const usePlayersStore = create<PlayersStore>((set, get) => ({
  localPlayer: makeLocalPlayer(),
  players: [],
  setDisplayName: (name) => {
    const updated = { ...get().localPlayer, displayName: name }
    localStorage.setItem('playsets-player', JSON.stringify(updated))
    set({ localPlayer: updated })
  },
  addPlayer: (p) => set((s) => ({ players: [...s.players.filter((x) => x.playerId !== p.playerId), p] })),
  removePlayer: (id) => set((s) => ({ players: s.players.filter((p) => p.playerId !== id) })),
  loadPlayers: (players) => set({ players }),
  reset: () => set({ players: [] }),
}))
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test
```

Expected: PASS — all room store tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/store/ 
git commit -m "feat: Zustand room state store and player identity with localStorage persistence"
```

---

## Task 11: WebRTC Signaling Client + Peer Connection

**Files:**
- Create: `apps/client/src/networking/signaling.ts`
- Create: `apps/client/src/networking/peer.ts`
- Create: `apps/client/src/networking/messages.ts`

- [ ] **Step 1: Create signaling.ts**

Create `apps/client/src/networking/signaling.ts`:
```ts
import { io, Socket } from 'socket.io-client'

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'http://localhost:3001'

export interface SignalingEvents {
  onGuestJoined: (guestSocketId: string) => void
  onOffer: (from: string, offer: RTCSessionDescriptionInit) => void
  onAnswer: (from: string, answer: RTCSessionDescriptionInit) => void
  onIceCandidate: (from: string, candidate: RTCIceCandidateInit) => void
  onHostDisconnected: () => void
  onGuestLeft: (guestSocketId: string) => void
}

export class SignalingClient {
  private socket: Socket

  constructor(events: SignalingEvents) {
    this.socket = io(SIGNALING_URL, { transports: ['websocket'] })
    this.socket.on('guest-joined', events.onGuestJoined)
    this.socket.on('offer', ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) =>
      events.onOffer(from, offer))
    this.socket.on('answer', ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) =>
      events.onAnswer(from, answer))
    this.socket.on('ice-candidate', ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) =>
      events.onIceCandidate(from, candidate))
    this.socket.on('host-disconnected', events.onHostDisconnected)
    this.socket.on('guest-left', events.onGuestLeft)
  }

  createRoom(): Promise<string> {
    return new Promise((resolve) => {
      this.socket.emit('create-room', ({ roomId }: { roomId: string }) => resolve(roomId))
    })
  }

  joinRoom(roomId: string): Promise<{ error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('join-room', roomId, resolve)
    })
  }

  sendOffer(to: string, offer: RTCSessionDescriptionInit): void {
    this.socket.emit('offer', { to, offer })
  }

  sendAnswer(to: string, answer: RTCSessionDescriptionInit): void {
    this.socket.emit('answer', { to, answer })
  }

  sendIceCandidate(to: string, candidate: RTCIceCandidateInit): void {
    this.socket.emit('ice-candidate', { to, candidate })
  }

  get socketId(): string {
    return this.socket.id ?? ''
  }

  disconnect(): void {
    this.socket.disconnect()
  }
}
```

- [ ] **Step 2: Create peer.ts**

Create `apps/client/src/networking/peer.ts`:
```ts
import type { GameMessage } from '../types'

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export interface PeerCallbacks {
  onMessage: (msg: GameMessage) => void
  onIceCandidate: (candidate: RTCIceCandidateInit) => void
  onConnected: () => void
  onDisconnected: () => void
}

export class PeerConnection {
  private pc: RTCPeerConnection
  private reliableChannel: RTCDataChannel | null = null
  private lossyChannel: RTCDataChannel | null = null

  constructor(private callbacks: PeerCallbacks) {
    this.pc = new RTCPeerConnection({ iceServers: STUN_SERVERS })
    this.pc.onicecandidate = (e) => {
      if (e.candidate) callbacks.onIceCandidate(e.candidate.toJSON())
    }
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'connected') callbacks.onConnected()
      if (['disconnected', 'failed', 'closed'].includes(this.pc.connectionState))
        callbacks.onDisconnected()
    }
  }

  // Host: create channels and offer
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.reliableChannel = this.pc.createDataChannel('game-reliable', { ordered: true })
    this.lossyChannel = this.pc.createDataChannel('game-lossy', {
      ordered: false,
      maxRetransmits: 0,
    })
    this.bindChannelHandlers()
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    return offer
  }

  // Guest: receive channels via ondatachannel
  listenForChannels(): void {
    this.pc.ondatachannel = (e) => {
      if (e.channel.label === 'game-reliable') {
        this.reliableChannel = e.channel
        this.reliableChannel.onmessage = (ev) => this.handleMessage(ev.data as string)
      }
      if (e.channel.label === 'game-lossy') {
        this.lossyChannel = e.channel
        this.lossyChannel.onmessage = (ev) => this.handleMessage(ev.data as string)
      }
      if (this.reliableChannel && this.lossyChannel) {
        this.callbacks.onConnected()
      }
    }
  }

  async setRemoteOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(offer)
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return answer
  }

  async setRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer)
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.pc.addIceCandidate(candidate)
  }

  sendReliable(msg: GameMessage): void {
    if (this.reliableChannel?.readyState === 'open') {
      this.reliableChannel.send(JSON.stringify(msg))
    }
  }

  sendLossy(msg: GameMessage): void {
    if (this.lossyChannel?.readyState === 'open') {
      this.lossyChannel.send(JSON.stringify(msg))
    }
  }

  private bindChannelHandlers(): void {
    if (this.reliableChannel) {
      this.reliableChannel.onmessage = (e) => this.handleMessage(e.data as string)
      this.reliableChannel.onopen = () => {
        if (this.lossyChannel?.readyState === 'open') this.callbacks.onConnected()
      }
    }
    if (this.lossyChannel) {
      this.lossyChannel.onmessage = (e) => this.handleMessage(e.data as string)
      this.lossyChannel.onopen = () => {
        if (this.reliableChannel?.readyState === 'open') this.callbacks.onConnected()
      }
    }
  }

  private handleMessage(data: string): void {
    try {
      this.callbacks.onMessage(JSON.parse(data) as GameMessage)
    } catch {
      console.warn('Invalid message received', data)
    }
  }

  close(): void {
    this.reliableChannel?.close()
    this.lossyChannel?.close()
    this.pc.close()
  }
}
```

- [ ] **Step 3: Create messages.ts**

Create `apps/client/src/networking/messages.ts`:
```ts
import type { GameMessage, SpriteInstance, Player } from '../types'
import type { PeerConnection } from './peer'

type PeerMap = Map<string, PeerConnection>

export function broadcastReliable(peers: PeerMap, msg: GameMessage): void {
  for (const peer of peers.values()) peer.sendReliable(msg)
}

export function broadcastLossy(peers: PeerMap, msg: GameMessage): void {
  for (const peer of peers.values()) peer.sendLossy(msg)
}

export function sendSnapshot(peer: PeerConnection, sprites: SpriteInstance[], players: Player[]): void {
  peer.sendReliable({ type: 'state:snapshot', sprites, players })
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/networking/
git commit -m "feat: WebRTC peer connection with dual DataChannels and Socket.io signaling client"
```

---

## Task 12: Host Session + Guest Session Logic

**Files:**
- Create: `apps/client/src/networking/host.ts`
- Create: `apps/client/src/networking/guest.ts`

- [ ] **Step 1: Create host.ts**

Create `apps/client/src/networking/host.ts`:
```ts
import { SignalingClient } from './signaling'
import { PeerConnection } from './peer'
import { broadcastReliable, broadcastLossy, sendSnapshot } from './messages'
import { useRoomStore } from '../store/room'
import { usePlayersStore } from '../store/players'
import type { GameMessage, SpriteInstance } from '../types'
import type { SpriteManager } from '../babylon/sprites'
import type { CursorManager } from '../babylon/cursors'
import { showEmote } from '../babylon/emotes'
import type { Scene } from '@babylonjs/core'

export class HostSession {
  private peers = new Map<string, PeerConnection>()
  private signaling: SignalingClient

  constructor(
    private scene: Scene,
    private spriteManager: SpriteManager,
    private cursorManager: CursorManager,
    onRoomCreated: (roomId: string) => void,
  ) {
    this.signaling = new SignalingClient({
      onGuestJoined: (guestSocketId) => this.handleGuestJoined(guestSocketId),
      onAnswer: (from, answer) => this.peers.get(from)?.setRemoteAnswer(answer),
      onIceCandidate: (from, candidate) => this.peers.get(from)?.addIceCandidate(candidate),
      onOffer: () => {},
      onHostDisconnected: () => {},
      onGuestLeft: (guestSocketId) => this.handleGuestLeft(guestSocketId),
    })

    this.signaling.createRoom().then((roomId) => {
      useRoomStore.getState().setRoomId(roomId)
      onRoomCreated(roomId)
    })
  }

  private async handleGuestJoined(guestSocketId: string): Promise<void> {
    const peer = new PeerConnection({
      onMessage: (msg) => this.handleMessage(msg, guestSocketId),
      onIceCandidate: (c) => this.signaling.sendIceCandidate(guestSocketId, c),
      onConnected: () => {
        const { sprites } = useRoomStore.getState()
        const { players, localPlayer } = usePlayersStore.getState()
        sendSnapshot(peer, Object.values(sprites), [localPlayer, ...players])
      },
      onDisconnected: () => this.handleGuestLeft(guestSocketId),
    })

    this.peers.set(guestSocketId, peer)
    const offer = await peer.createOffer()
    this.signaling.sendOffer(guestSocketId, offer)
  }

  private handleGuestLeft(guestSocketId: string): void {
    this.peers.get(guestSocketId)?.close()
    this.peers.delete(guestSocketId)
    const players = usePlayersStore.getState()
    // find player by socketId is not tracked directly; guest:leave msg handles UI
    broadcastReliable(this.peers, { type: 'player:leave', playerId: guestSocketId })
  }

  private handleMessage(msg: GameMessage, fromSocketId: string): void {
    // Host applies message to local state, then rebroadcasts to all other guests
    const roomStore = useRoomStore.getState()
    const playersStore = usePlayersStore.getState()

    switch (msg.type) {
      case 'sprite:place':
        roomStore.placeSprite({ instanceId: msg.instanceId, spriteId: msg.spriteId, col: msg.col, row: msg.row, placedBy: msg.placedBy })
        this.spriteManager.place({ instanceId: msg.instanceId, spriteId: msg.spriteId, col: msg.col, row: msg.row, placedBy: msg.placedBy }, `/assets/sprites/${msg.spriteId}.png`)
        break
      case 'sprite:move':
        roomStore.moveSprite(msg.instanceId, msg.col, msg.row)
        this.spriteManager.move(msg.instanceId, msg.col, msg.row)
        break
      case 'sprite:remove':
        roomStore.removeSprite(msg.instanceId)
        this.spriteManager.remove(msg.instanceId)
        break
      case 'sprite:emote':
        const instance = roomStore.sprites[msg.instanceId]
        if (instance) showEmote(this.scene, instance.col, instance.row, msg.emote)
        break
      case 'sprite:drag':
        this.spriteManager.move(msg.instanceId, msg.col, msg.row)
        break
      case 'cursor:move':
        break
      case 'player:join':
        playersStore.addPlayer({ playerId: msg.playerId, displayName: msg.displayName, color: msg.color })
        break
    }
    // Relay to all other guests
    for (const [socketId, peer] of this.peers) {
      if (socketId !== fromSocketId) {
        if (msg.type === 'sprite:drag' || msg.type === 'cursor:move') peer.sendLossy(msg)
        else peer.sendReliable(msg)
      }
    }
  }

  // Called when local player places/moves/removes/emotes
  localAction(msg: GameMessage): void {
    this.handleMessage(msg, '__local__')
  }

  dispose(): void {
    for (const peer of this.peers.values()) peer.close()
    this.signaling.disconnect()
  }
}
```

- [ ] **Step 2: Create guest.ts**

Create `apps/client/src/networking/guest.ts`:
```ts
import { SignalingClient } from './signaling'
import { PeerConnection } from './peer'
import { useRoomStore } from '../store/room'
import { usePlayersStore } from '../store/players'
import type { GameMessage } from '../types'
import type { SpriteManager } from '../babylon/sprites'
import type { CursorManager } from '../babylon/cursors'
import { showEmote } from '../babylon/emotes'
import type { Scene } from '@babylonjs/core'

export class GuestSession {
  private peer: PeerConnection | null = null
  private signaling: SignalingClient
  private hostSocketId = ''

  constructor(
    private roomId: string,
    private scene: Scene,
    private spriteManager: SpriteManager,
    private cursorManager: CursorManager,
    onConnected: () => void,
    onHostDisconnected: () => void,
  ) {
    this.signaling = new SignalingClient({
      onGuestJoined: () => {},
      onGuestLeft: () => {},
      onOffer: (from, offer) => this.handleOffer(from, offer, onConnected),
      onAnswer: () => {},
      onIceCandidate: (from, candidate) => this.peer?.addIceCandidate(candidate),
      onHostDisconnected,
    })

    this.signaling.joinRoom(roomId).then((res) => {
      if (res.error) {
        console.error('Join failed:', res.error)
      }
    })
  }

  private async handleOffer(hostSocketId: string, offer: RTCSessionDescriptionInit, onConnected: () => void): Promise<void> {
    this.hostSocketId = hostSocketId
    this.peer = new PeerConnection({
      onMessage: (msg) => this.handleMessage(msg),
      onIceCandidate: (c) => this.signaling.sendIceCandidate(hostSocketId, c),
      onConnected: () => {
        const { localPlayer } = usePlayersStore.getState()
        this.send({ type: 'player:join', playerId: localPlayer.playerId, displayName: localPlayer.displayName, color: localPlayer.color })
        onConnected()
      },
      onDisconnected: () => {},
    })
    this.peer.listenForChannels()
    const answer = await this.peer.setRemoteOffer(offer)
    this.signaling.sendAnswer(hostSocketId, answer)
  }

  private handleMessage(msg: GameMessage): void {
    const roomStore = useRoomStore.getState()
    const playersStore = usePlayersStore.getState()

    switch (msg.type) {
      case 'state:snapshot':
        roomStore.loadSnapshot(msg.sprites)
        playersStore.loadPlayers(msg.players)
        this.spriteManager.clear()
        for (const s of msg.sprites) {
          this.spriteManager.place(s, `/assets/sprites/${s.spriteId}.png`)
        }
        break
      case 'sprite:place':
        roomStore.placeSprite({ instanceId: msg.instanceId, spriteId: msg.spriteId, col: msg.col, row: msg.row, placedBy: msg.placedBy })
        this.spriteManager.place({ instanceId: msg.instanceId, spriteId: msg.spriteId, col: msg.col, row: msg.row, placedBy: msg.placedBy }, `/assets/sprites/${msg.spriteId}.png`)
        break
      case 'sprite:move':
        roomStore.moveSprite(msg.instanceId, msg.col, msg.row)
        this.spriteManager.move(msg.instanceId, msg.col, msg.row)
        break
      case 'sprite:remove':
        roomStore.removeSprite(msg.instanceId)
        this.spriteManager.remove(msg.instanceId)
        break
      case 'sprite:emote':
        const instance = roomStore.sprites[msg.instanceId]
        if (instance) showEmote(this.scene, instance.col, instance.row, msg.emote)
        break
      case 'sprite:drag':
        this.spriteManager.move(msg.instanceId, msg.col, msg.row)
        break
      case 'cursor:move':
        const player = playersStore.players.find((p) => p.playerId === msg.playerId)
        if (player) this.cursorManager.upsert(msg.playerId, player.displayName, player.color, msg.worldX, msg.worldZ)
        break
      case 'player:join':
        playersStore.addPlayer({ playerId: msg.playerId, displayName: msg.displayName, color: msg.color })
        break
      case 'player:leave':
        playersStore.removePlayer(msg.playerId)
        this.cursorManager.remove(msg.playerId)
        break
    }
  }

  send(msg: GameMessage): void {
    if (msg.type === 'sprite:drag' || msg.type === 'cursor:move') this.peer?.sendLossy(msg)
    else this.peer?.sendReliable(msg)
  }

  dispose(): void {
    this.peer?.close()
    this.signaling.disconnect()
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/networking/host.ts apps/client/src/networking/guest.ts
git commit -m "feat: HostSession and GuestSession — WebRTC state authority and message handling"
```

---

## Task 13: React UI Components

**Files:**
- Create: `apps/client/src/components/JoinDialog.tsx`
- Create: `apps/client/src/components/TopBar.tsx`
- Create: `apps/client/src/components/PlayerList.tsx`
- Create: `apps/client/src/components/SpritePicker.tsx`
- Create: `apps/client/src/components/EmoteMenu.tsx`

- [ ] **Step 1: Create JoinDialog.tsx**

Create `apps/client/src/components/JoinDialog.tsx`:
```tsx
import { useState } from 'react'
import { usePlayersStore } from '../store/players'

interface Props { onDone: () => void }

export function JoinDialog({ onDone }: Props) {
  const setDisplayName = usePlayersStore((s) => s.setDisplayName)
  const [name, setName] = useState('')

  const submit = () => {
    if (!name.trim()) return
    setDisplayName(name.trim())
    onDone()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{ background: '#2a2a32', borderRadius: 12, padding: 32, minWidth: 320 }}>
        <h2 style={{ marginBottom: 16 }}>Enter your name</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Display name"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            border: '1px solid #555', background: '#1e1e24', color: '#eee',
            fontSize: 16, marginBottom: 16,
          }}
        />
        <button
          onClick={submit}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8,
            background: '#3b82f6', color: '#fff', border: 'none',
            fontSize: 16, cursor: 'pointer',
          }}
        >
          Join
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create TopBar.tsx**

Create `apps/client/src/components/TopBar.tsx`:
```tsx
import { useState } from 'react'
import { useRoomStore } from '../store/room'
import { PlayerList } from './PlayerList'

export function TopBar() {
  const roomId = useRoomStore((s) => s.roomId)
  const [showPlayers, setShowPlayers] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyLink = () => {
    if (!roomId) return
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 48,
      background: '#1a1a22', borderBottom: '1px solid #333',
      display: 'flex', alignItems: 'center', padding: '0 16px',
      gap: 12, zIndex: 50,
    }}>
      <span style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>Playsets</span>
      {roomId && (
        <>
          <span style={{ background: '#2a2a3a', borderRadius: 6, padding: '2px 10px', fontSize: 13, color: '#aaa' }}>
            {roomId}
          </span>
          <button onClick={copyLink} style={btnStyle}>
            {copied ? '✓ Copied' : 'Copy Link'}
          </button>
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <button onClick={() => setShowPlayers((v) => !v)} style={btnStyle}>
              Players ▾
            </button>
            {showPlayers && <PlayerList />}
          </div>
        </>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '4px 12px', borderRadius: 6,
  background: '#2a2a3a', color: '#ddd', border: '1px solid #444',
  cursor: 'pointer', fontSize: 13,
}
```

- [ ] **Step 3: Create PlayerList.tsx**

Create `apps/client/src/components/PlayerList.tsx`:
```tsx
import { usePlayersStore } from '../store/players'

export function PlayerList() {
  const { players, localPlayer } = usePlayersStore()
  const all = [localPlayer, ...players]

  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 4,
      background: '#2a2a3a', border: '1px solid #444', borderRadius: 8,
      minWidth: 180, padding: 8,
    }}>
      {all.map((p) => (
        <div key={p.playerId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
          <span style={{ fontSize: 13 }}>{p.displayName || 'Anonymous'}</span>
          {p.playerId === localPlayer.playerId && (
            <span style={{ fontSize: 11, color: '#666', marginLeft: 'auto' }}>you</span>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create SpritePicker.tsx**

Create `apps/client/src/components/SpritePicker.tsx`:
```tsx
import { useEffect, useState } from 'react'
import type { SpriteCategory, SpriteManifest, SpriteManifestEntry } from '../types'

interface Props {
  selectedSpriteId: string | null
  onSelect: (sprite: SpriteManifestEntry) => void
}

export function SpritePicker({ selectedSpriteId, onSelect }: Props) {
  const [manifest, setManifest] = useState<SpriteManifest | null>(null)
  const [search, setSearch] = useState('')
  const [openCategory, setOpenCategory] = useState<string | null>(null)

  useEffect(() => {
    fetch('/assets/sprites/manifest.json')
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setManifest({ categories: [] }))
  }, [])

  const categories: SpriteCategory[] = manifest?.categories ?? []
  const filtered = categories.map((cat) => ({
    ...cat,
    sprites: cat.sprites.filter((s) =>
      !search || s.label.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((cat) => cat.sprites.length > 0)

  return (
    <div style={{
      position: 'fixed', top: 48, left: 0, bottom: 0, width: 200,
      background: '#1a1a22', borderRight: '1px solid #333',
      overflowY: 'auto', padding: 8, zIndex: 40,
    }}>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search sprites..."
        style={{
          width: '100%', padding: '6px 10px', borderRadius: 6,
          border: '1px solid #444', background: '#2a2a3a', color: '#eee',
          fontSize: 13, marginBottom: 8,
        }}
      />
      {filtered.map((cat) => (
        <div key={cat.id}>
          <button
            onClick={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}
            style={{
              width: '100%', textAlign: 'left', padding: '6px 8px',
              background: 'none', border: 'none', color: '#aaa',
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              cursor: 'pointer', letterSpacing: 0.5,
            }}
          >
            {openCategory === cat.id ? '▾' : '▸'} {cat.label}
          </button>
          {openCategory === cat.id && cat.sprites.map((sprite) => (
            <button
              key={sprite.id}
              onClick={() => onSelect(sprite)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '6px 8px 6px 20px',
                background: selectedSpriteId === sprite.id ? '#2d3f5a' : 'none',
                border: 'none', color: '#ddd', fontSize: 13,
                cursor: 'pointer', borderRadius: 4, textAlign: 'left',
              }}
            >
              <img src={sprite.path} alt={sprite.label} style={{ width: 28, height: 28, objectFit: 'contain' }} />
              {sprite.label}
            </button>
          ))}
        </div>
      ))}
      {manifest && filtered.length === 0 && (
        <p style={{ color: '#666', fontSize: 13, padding: 8 }}>No sprites found</p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create EmoteMenu.tsx**

Create `apps/client/src/components/EmoteMenu.tsx`:
```tsx
const EMOTES = ['❤️', '💀', '⚔️', '🛡️', '🎲', '😴', '✨', '💬']

interface Props {
  instanceId: string
  position: { x: number; y: number }
  onEmote: (instanceId: string, emote: string) => void
  onClose: () => void
}

export function EmoteMenu({ instanceId, position, onEmote, onClose }: Props) {
  return (
    <>
      {/* Invisible backdrop to close on outside click */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 59 }}
      />
      <div style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        background: '#2a2a3a',
        border: '1px solid #444',
        borderRadius: 12,
        padding: 8,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 4,
        zIndex: 60,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        {EMOTES.map((emote) => (
          <button
            key={emote}
            onClick={() => { onEmote(instanceId, emote); onClose() }}
            style={{
              fontSize: 24, padding: '6px 8px', border: 'none',
              background: 'none', cursor: 'pointer', borderRadius: 6,
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a4a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            {emote}
          </button>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/components/
git commit -m "feat: React UI components — SpritePicker, EmoteMenu, TopBar, PlayerList, JoinDialog"
```

---

## Task 14: App Wiring — Full Integration

**Files:**
- Modify: `apps/client/src/App.tsx`
- Create: `apps/client/src/pages/HomePage.tsx`
- Create: `apps/client/src/pages/RoomPage.tsx`

- [ ] **Step 1: Create HomePage.tsx**

**Architecture note:** The room is created by `HostSession` (not the home page) so the socket stays alive through the session. Home page just navigates to a sentinel route `/room/new?host=1`. `RoomPage` detects this, creates the `HostSession`, and the `onRoomCreated` callback updates the URL to the real room ID via `window.history.replaceState`.

Create `apps/client/src/pages/HomePage.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function HomePage() {
  const navigate = useNavigate()
  const [roomInput, setRoomInput] = useState('')

  const joinRoom = () => {
    const id = roomInput.trim()
    if (id) navigate(`/room/${id}`)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 24,
    }}>
      <h1 style={{ fontSize: 48, fontWeight: 800 }}>Playsets</h1>
      <p style={{ color: '#888' }}>Virtual tabletop for everyone</p>
      <button onClick={() => navigate('/room/new?host=1')} style={primaryBtn}>
        Create Room
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          placeholder="Room code"
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #444', background: '#2a2a32', color: '#eee', fontSize: 15 }}
        />
        <button onClick={joinRoom} style={secondaryBtn}>Join</button>
      </div>
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  padding: '12px 32px', borderRadius: 10, background: '#3b82f6',
  color: '#fff', border: 'none', fontSize: 17, cursor: 'pointer', fontWeight: 600,
}
const secondaryBtn: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: '#2a2a3a',
  color: '#ddd', border: '1px solid #444', fontSize: 15, cursor: 'pointer',
}
```

- [ ] **Step 2: Create RoomPage.tsx**

Create `apps/client/src/pages/RoomPage.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Scene } from '@babylonjs/core'
import { createScene } from '../babylon/scene'
import { createGrid, worldToCell } from '../babylon/grid'
import { SpriteManager } from '../babylon/sprites'
import { DragController } from '../babylon/drag'
import { CursorManager } from '../babylon/cursors'
import { showEmote } from '../babylon/emotes'
import { HostSession } from '../networking/host'
import { GuestSession } from '../networking/guest'
import { TopBar } from '../components/TopBar'
import { SpritePicker } from '../components/SpritePicker'
import { EmoteMenu } from '../components/EmoteMenu'
import { JoinDialog } from '../components/JoinDialog'
import { usePlayersStore } from '../store/players'
import { useRoomStore } from '../store/room'
import type { SpriteManifestEntry } from '../types'
import { nanoid } from 'nanoid'

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams] = useSearchParams()
  const isHost = searchParams.get('host') === '1'

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const sessionRef = useRef<HostSession | GuestSession | null>(null)
  // selectedSprite must be a ref so the pointerup closure captures current value
  const selectedSpriteRef = useRef<SpriteManifestEntry | null>(null)

  const { localPlayer } = usePlayersStore()
  const [needsName, setNeedsName] = useState(!localPlayer.displayName)
  const [selectedSprite, setSelectedSprite] = useState<SpriteManifestEntry | null>(null)
  const [emoteMenu, setEmoteMenu] = useState<{ instanceId: string; x: number; y: number } | null>(null)
  const [connected, setConnected] = useState(isHost)

  // Keep ref in sync with state so the canvas event listener sees current value
  const handleSelectSprite = (s: SpriteManifestEntry) => {
    setSelectedSprite(s)
    selectedSpriteRef.current = s
  }

  useEffect(() => {
    if (needsName || !canvasRef.current) return

    const { engine, scene } = createScene(canvasRef.current)
    sceneRef.current = scene
    createGrid(scene)
    const spriteManager = new SpriteManager(scene)
    const cursorManager = new CursorManager(scene)

    new DragController(scene, spriteManager, {
      onDragMove: (instanceId, col, row) => {
        const msg = { type: 'sprite:drag' as const, instanceId, col, row }
        if (sessionRef.current instanceof HostSession) sessionRef.current.localAction(msg)
        else (sessionRef.current as GuestSession | null)?.send(msg)
      },
      onDragDrop: (instanceId, col, row) => {
        const msg = { type: 'sprite:move' as const, instanceId, col, row }
        useRoomStore.getState().moveSprite(instanceId, col, row)
        if (sessionRef.current instanceof HostSession) sessionRef.current.localAction(msg)
        else (sessionRef.current as GuestSession | null)?.send(msg)
      },
      onSpriteClick: () => {},
    })

    const handlePointerUp = (e: PointerEvent) => {
      const pick = scene.pick(scene.pointerX, scene.pointerY)
      // Click on a placed sprite → open emote menu
      const instanceId = pick?.pickedMesh?.metadata?.instanceId as string | undefined
      if (instanceId) {
        setEmoteMenu({ instanceId, x: e.clientX, y: e.clientY })
        return
      }
      // Click on ground with sprite selected → place sprite
      const sprite = selectedSpriteRef.current
      if (sprite && pick?.hit && pick.pickedMesh?.name === 'ground' && pick.pickedPoint) {
        const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
        const newInstanceId = nanoid()
        const { localPlayer } = usePlayersStore.getState()
        const instance = { instanceId: newInstanceId, spriteId: sprite.id, col, row, placedBy: localPlayer.playerId }
        const msg = { type: 'sprite:place' as const, ...instance }
        useRoomStore.getState().placeSprite(instance)
        spriteManager.place(instance, sprite.path)
        if (sessionRef.current instanceof HostSession) sessionRef.current.localAction(msg)
        else (sessionRef.current as GuestSession | null)?.send(msg)
      }
    }

    canvasRef.current.addEventListener('pointerup', handlePointerUp)

    if (isHost) {
      sessionRef.current = new HostSession(scene, spriteManager, cursorManager, (newRoomId) => {
        window.history.replaceState(null, '', `/room/${newRoomId}`)
        useRoomStore.getState().setRoomId(newRoomId)
      })
    } else {
      sessionRef.current = new GuestSession(
        roomId!,
        scene,
        spriteManager,
        cursorManager,
        () => setConnected(true),
        () => alert('Host disconnected'),
      )
    }

    return () => {
      canvasRef.current?.removeEventListener('pointerup', handlePointerUp)
      sessionRef.current?.dispose()
      engine.dispose()
    }
  }, [needsName, roomId, isHost])

  if (needsName) return <JoinDialog onDone={() => setNeedsName(false)} />

  return (
    <>
      <TopBar />
      <SpritePicker selectedSpriteId={selectedSprite?.id ?? null} onSelect={handleSelectSprite} />
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', top: 48, left: 200, right: 0, bottom: 0, width: 'calc(100vw - 200px)', height: 'calc(100vh - 48px)' }}
      />
      {emoteMenu && (
        <EmoteMenu
          instanceId={emoteMenu.instanceId}
          position={{ x: emoteMenu.x, y: emoteMenu.y }}
          onEmote={(instanceId, emote) => {
            const { sprites } = useRoomStore.getState()
            const instance = sprites[instanceId]
            if (instance && sceneRef.current) showEmote(sceneRef.current, instance.col, instance.row, emote)
            const msg = { type: 'sprite:emote' as const, instanceId, emote }
            if (sessionRef.current instanceof HostSession) sessionRef.current.localAction(msg)
            else (sessionRef.current as GuestSession | null)?.send(msg)
          }}
          onClose={() => setEmoteMenu(null)}
        />
      )}
      {!connected && !isHost && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
          <p style={{ color: '#fff', fontSize: 20 }}>Connecting to host...</p>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Update App.tsx router — handle `/room/new` route**

- [ ] **Step 4: Update App.tsx to use router**

Replace `apps/client/src/App.tsx`:
```tsx
import { Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { RoomPage } from './pages/RoomPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
    </Routes>
  )
}
```

- [ ] **Step 5: Run full integration test**

Start both servers:
```bash
# Terminal 1
pnpm dev:server
# Terminal 2
pnpm dev:client
```

1. Open `http://localhost:5173` — home page appears
2. Click "Create Room" — redirected to `/room/<id>?host=1`
3. Enter a display name — grid appears
4. Copy the room URL (without `?host=1`), open in a new browser profile
5. Enter a display name — guest connects, sees the same empty grid
6. Host places a sprite from the picker — guest sees it appear
7. Host drags a sprite — guest sees it move in real-time
8. Host clicks a sprite, selects an emote — both host and guest see the floating emote

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/pages/ apps/client/src/App.tsx
git commit -m "feat: full app integration — home page, room page, host/guest sessions wired to BabylonJS"
```

---

## Task 15: Asset Manifest Generator Script

**Files:**
- Create: `scripts/generate-manifest.mjs`
- Create: `apps/client/public/assets/sprites/manifest.json` (example)

- [ ] **Step 1: Create generate-manifest.mjs**

Create `scripts/generate-manifest.mjs`:
```js
#!/usr/bin/env node
import { readdirSync, writeFileSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

const SPRITES_DIR = 'apps/client/public/assets/sprites'
const OUT = `${SPRITES_DIR}/manifest.json`

function labelFromFilename(filename) {
  return basename(filename, extname(filename))
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const categories = []
for (const entry of readdirSync(SPRITES_DIR)) {
  const full = join(SPRITES_DIR, entry)
  if (!statSync(full).isDirectory() || entry === '.' || entry === '..') continue
  const sprites = readdirSync(full)
    .filter((f) => ['.png', '.webp', '.svg'].includes(extname(f).toLowerCase()))
    .map((f) => ({
      id: `${entry}/${basename(f, extname(f))}`,
      label: labelFromFilename(f),
      path: `/assets/sprites/${entry}/${f}`,
    }))
  if (sprites.length > 0) {
    categories.push({ id: entry, label: labelFromFilename(entry), sprites })
  }
}

writeFileSync(OUT, JSON.stringify({ categories }, null, 2))
console.log(`Wrote ${categories.length} categories to ${OUT}`)
```

Add to root `package.json` scripts:
```json
"generate-manifest": "node scripts/generate-manifest.mjs"
```

- [ ] **Step 2: Create placeholder manifest for development**

Create `apps/client/public/assets/sprites/manifest.json`:
```json
{
  "categories": [
    {
      "id": "tokens",
      "label": "Tokens",
      "sprites": [
        {
          "id": "tokens/warrior",
          "label": "Warrior",
          "path": "/assets/sprites/tokens/warrior.png"
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: Document Unity export process**

Add `docs/unity-asset-export.md`:
```markdown
# Exporting Sprites from Unity

1. Open the Unity project in Unity Editor
2. In the Project window, select all sprite assets you want to export
3. For each sprite: right-click → Show in Explorer/Finder, then copy the PNG from the texture folder
   - Alternatively: install "Unity Package Exporter" or write a simple Editor script (see below)
4. Organize PNGs into folders: tokens/, props/, terrain/, effects/
5. Copy all folders into: apps/client/public/assets/sprites/
6. Run: `pnpm generate-manifest`

## Batch Export Editor Script (Assets/Editor/SpriteExporter.cs)
Create this file in your Unity project to batch-export:

using UnityEditor;
using UnityEngine;
using System.IO;

public class SpriteExporter
{
    [MenuItem("Tools/Export All Sprites")]
    static void ExportAll()
    {
        var sprites = AssetDatabase.FindAssets("t:Sprite");
        foreach (var guid in sprites)
        {
            var path = AssetDatabase.GUIDToAssetPath(guid);
            var tex = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if (tex == null) continue;
            var bytes = tex.EncodeToPNG();
            var outPath = "ExportedSprites/" + Path.GetFileNameWithoutExtension(path) + ".png";
            Directory.CreateDirectory(Path.GetDirectoryName(outPath));
            File.WriteAllBytes(outPath, bytes);
        }
        Debug.Log("Export complete: ExportedSprites/");
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/ apps/client/public/assets/sprites/manifest.json docs/unity-asset-export.md
git commit -m "feat: manifest generator script and Unity sprite export guide"
```

---

## Task 16: Deployment

**Files:**
- Create: `apps/server/fly.toml`
- Create: `apps/server/Dockerfile`
- Create: `apps/client/public/_redirects`
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

Create `.gitignore`:
```
node_modules/
dist/
.env
.env.local
apps/client/public/assets/sprites/tokens/
apps/client/public/assets/sprites/props/
apps/client/public/assets/sprites/terrain/
apps/client/public/assets/sprites/effects/
.superpowers/
```

Note: sprite subfolders are gitignored because they'll be large binary assets managed separately.

- [ ] **Step 2: Create server Dockerfile**

Create `apps/server/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY dist/ ./dist/
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

- [ ] **Step 3: Create fly.toml**

Create `apps/server/fly.toml`:
```toml
app = "playsets-signaling"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
```

- [ ] **Step 4: Create Cloudflare Pages SPA redirect**

Create `apps/client/public/_redirects`:
```
/*    /index.html   200
```

- [ ] **Step 5: Create environment variable template**

Create `apps/client/.env.example`:
```
VITE_SIGNALING_URL=http://localhost:3001
```

Create `apps/client/.env.local` (not committed):
```
VITE_SIGNALING_URL=http://localhost:3001
```

- [ ] **Step 6: Deploy signaling server**

```bash
# Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/
cd apps/server
pnpm build
fly launch --no-deploy
fly deploy
```

Expected: server is live at `https://playsets-signaling.fly.dev`.

Update `apps/client/.env.local`:
```
VITE_SIGNALING_URL=https://playsets-signaling.fly.dev
```

- [ ] **Step 7: Deploy frontend**

```bash
cd apps/client
pnpm build
# Connect to Cloudflare Pages via dashboard or:
# npx wrangler pages deploy dist --project-name=playsets
```

Set environment variable in Cloudflare Pages dashboard:
```
VITE_SIGNALING_URL = https://playsets-signaling.fly.dev
```

- [ ] **Step 8: End-to-end production verify**

1. Open `https://playsets.pages.dev` (or your custom domain)
2. Create a room — verify signaling server responds
3. Share URL with another device on a different network
4. Verify sprites sync in real-time across devices
5. Verify emotes animate on both sides

- [ ] **Step 9: Final commit**

```bash
git add apps/server/fly.toml apps/server/Dockerfile apps/client/public/_redirects .gitignore apps/client/.env.example
git commit -m "feat: deployment config — Fly.io signaling server, Cloudflare Pages frontend"
```

---

## Verification Checklist

- [ ] `pnpm test` in both `apps/client` and `apps/server` passes
- [ ] Grid renders at `http://localhost:5173` with horizontal camera rotation
- [ ] A sprite placed by the host appears instantly on the guest's screen
- [ ] A sprite dragged by the host shows real-time ghost movement on guest
- [ ] Emote selected on a sprite floats and fades on both host and guest
- [ ] Closing host tab shows "Host disconnected" on guest
- [ ] Shareable URL works across different browser profiles/devices
- [ ] Manifest generator produces valid JSON when sprites are added to folders
