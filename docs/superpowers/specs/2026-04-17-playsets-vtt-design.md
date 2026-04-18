# Playsets VTT — Web App Design Spec
*Date: 2026-04-17*

## Context

Playsets is an existing virtual tabletop (VTT) app originally built in Unity and deployed as a WebGL app on itch.io. The goal is to rebuild it as a native web app that:

- Reuses all existing sprite assets from the Unity project
- Renders sprites on a rotatable 3D isometric grid using BabylonJS
- Supports real-time multiplayer (2–4 players) via WebRTC peer-to-peer
- Is shareable via URL with zero friction to join
- Costs $0/mo to run for all users
- Allows sprites to emote via a tap menu

The original app was 2D isometric and fixed-camera. The new version adds a 3D grid that supports horizontal camera rotation while keeping the isometric look.

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| 3D Rendering | BabylonJS | Requested; excellent sprite/billboard support, TypeScript-native |
| UI Shell | React + Vite | Declarative UI for sprite picker, emote menu, player list around the canvas |
| Networking | WebRTC DataChannels | Peer-to-peer; server only handles handshake, not game data |
| Signaling | Node.js + Socket.io | Minimal relay for WebRTC offer/answer/ICE exchange |
| Auth (optional) | Supabase free tier | Anonymous + optional Google sign-in; 50k MAU free |
| Frontend hosting | Cloudflare Pages | Free, global CDN, zero config deploys |
| Signaling hosting | Fly.io free tier | Always-on Node.js; 3 free VMs included |

---

## System Architecture

```
[Browser: Host]                   [Browser: Guest]
  BabylonJS scene                   BabylonJS scene
  React UI                          React UI
  RTCPeerConnection ◄──────────────► RTCPeerConnection
       │                                   │
       └──────────────┬────────────────────┘
                      │ (WebRTC handshake only — no game state)
              [Fly.io: Signaling Server]
               Node.js + Socket.io
               in-memory room registry (TTL: 24h)
```

### Connection Flow

1. Host opens app → clicks "Create Room" → signaling server registers a `nanoid` room ID → host receives URL `playsets.app/room/<roomId>`
2. Host copies and shares the URL
3. Guest opens URL → signaling server looks up room → WebRTC offer/answer + ICE candidate exchange completes
4. RTCDataChannel opens between host and guest
5. Host sends `state:snapshot` to the new guest
6. All subsequent game messages flow **directly peer-to-peer** — signaling server is no longer involved

STUN: Google's free STUN servers (`stun.l.google.com:19302`) handle NAT traversal for ~95% of users. A TURN relay is deferred to v2 (optional, ~$4/mo if needed).

---

## Grid & Rendering (BabylonJS)

### Scene Setup
- `ArcRotateCamera` fixed at 45° elevation (isometric tilt), free horizontal rotation via mouse/touch drag, zoom via scroll/pinch
- Ground plane: `MeshBuilder.CreateGround` subdivided into configurable cells (default 20×20, each 1 BJS unit)
- Grid lines: line meshes overlaid on the ground surface, subtle color

### Sprites
- Each placed sprite is a `MeshBuilder.CreatePlane` (a quad) textured with the sprite PNG
- `BillboardMode.Y` — sprites always face the camera on the Y axis, preserving the isometric look from any horizontal angle
- Sprites snap to grid cell centers on drop
- Hover/select highlight: emissive color overlay on the mesh

### Drag Interaction
- Pointer down on a placed sprite → enter drag mode
- During drag: ghost mesh follows cursor, snapped to nearest grid cell
- `sprite:drag` broadcast sent on each pointer move (unreliable DataChannel — lossy is acceptable for smooth preview)
- Pointer up → sprite snaps to final cell → `sprite:move` broadcast (reliable DataChannel)

### Camera Controls
- Mouse: left-drag to rotate horizontally, scroll to zoom
- Touch: one-finger drag to rotate, pinch to zoom
- Rotation is horizontal only; elevation is locked at isometric angle

---

## Asset Pipeline

### Export Step (prerequisite — done before any coding)
1. Open Unity project
2. Export all sprite assets as individual PNGs (File → Export Package is not sufficient; use the Texture importer to export each sprite, or use a Unity editor script to batch-export)
3. Organize into category folders: `tokens/`, `props/`, `terrain/`, `effects/`
4. Name files consistently: `token-warrior.png`, `prop-barrel.png`, etc.

### Manifest
`public/assets/sprites/manifest.json` — generated from the folder structure:
```json
{
  "categories": [
    {
      "id": "tokens",
      "label": "Tokens",
      "sprites": [
        { "id": "token-warrior", "label": "Warrior", "path": "assets/sprites/tokens/token-warrior.png" }
      ]
    }
  ]
}
```

BabylonJS loads textures on-demand via `new Texture(sprite.path, scene)`. No spritesheets required.

---

## Networking — Message Protocol

Two RTCDataChannels per peer connection:

| Channel | Mode | Used for |
|---|---|---|
| `game-reliable` | ordered + reliable | All state-mutating events |
| `game-lossy` | unordered + unreliable (maxRetransmits: 0) | Live drag position updates |

### Message Types (JSON)

```
// Reliable channel
{ type: "state:snapshot",  sprites: SpriteInstance[] }
{ type: "sprite:place",    spriteId, col, row, instanceId, placedBy }
{ type: "sprite:move",     instanceId, col, row }
{ type: "sprite:remove",   instanceId }
{ type: "sprite:emote",    instanceId, emote }   // e.g. "❤️", "⚔️", "💀", "😴", "🎲", "💬", "🛡️", "✨"
{ type: "player:join",     playerId, displayName, color }
{ type: "player:leave",    playerId }

// Lossy channel
{ type: "sprite:drag",     instanceId, col, row }
{ type: "cursor:move",     playerId, worldX, worldZ }
```

### State Shape (host-authoritative)
```ts
interface RoomState {
  roomId: string
  sprites: Record<string, SpriteInstance>
}

interface SpriteInstance {
  instanceId: string   // nanoid
  spriteId: string     // matches manifest
  col: number
  row: number
  placedBy: string     // playerId
}
```

---

## Room & Session Model

- **Host creates room**: registers `roomId` in signaling server (in-memory, 24h TTL); shareable URL is `playsets.app/room/<roomId>`
- **Guest joins**: opens URL → signaling handshake → DataChannel opens → host sends `state:snapshot`
- **Source of truth**: host's browser holds `RoomState`; guests maintain a local replica updated by messages
- **Host disconnect**: guests see a "Host disconnected — waiting for reconnect..." banner; state is lost if host closes the tab (by design in v1)
- **Guest disconnect**: host removes player from list; `player:leave` broadcast to remaining guests
- **Max players**: 4 (3 guests + 1 host); enforced in signaling server

### Signaling Server Endpoints (Socket.io events)
```
create-room  →  { roomId }
join-room    →  { roomId, offer }  →  { answer } + ice candidates
ice-candidate (forwarded between peers)
room-full    (error if > 3 guests)
room-not-found (error if roomId unknown)
```

---

## Auth (Optional)

- Default: anonymous join — user picks a display name on first visit, stored in `localStorage`
- Optional: "Sign in with Google" via Supabase Auth → persistent display name + avatar URL across sessions
- Auth state is cosmetic only in v1 — no permissions, no ownership beyond "who placed this sprite"
- Supabase free tier: 50,000 MAU, more than sufficient

---

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│  Playsets   [Room: abc123]  [Copy Link]  [Players ▾]│  ← Top bar
├──────────┬──────────────────────────────────────────┤
│ [Search] │                                          │
│ ─────── │                                          │
│ Tokens  │        BabylonJS Canvas                  │
│ > Warrior│        (3D grid + placed sprites)        │
│ > Mage  │                                          │
│ Props   │                                          │
│ > Barrel│                                          │
│ Terrain │                                          │
│ > Grass │                                          │
└──────────┴──────────────────────────────────────────┘
```

### Interactions
- **Place sprite**: drag from sidebar onto canvas; snaps to grid on drop
- **Move sprite**: drag an already-placed sprite to a new cell
- **Emote menu**: click/tap a placed sprite → radial menu of 8 emoticons appears → select one → sprite broadcasts emote; a floating emote animates above the sprite and fades after 3s
- **Remove sprite**: right-click or long-press → context menu with "Remove"
- **Other players' cursors**: colored dot + display name label follows their pointer in the scene
- **Mobile**: sidebar collapses to a bottom sheet; tap canvas cell to place selected sprite

### Emote Set (v1)
❤️ 💀 ⚔️ 🛡️ 🎲 😴 ✨ 💬

---

## Hosting & Cost Summary

| Service | Free Tier | Usage |
|---|---|---|
| Cloudflare Pages | Unlimited bandwidth | Frontend static hosting |
| Fly.io | 3 always-on VMs (256MB RAM each) | Signaling server |
| Supabase | 50k MAU | Optional auth |
| Google STUN | Free | WebRTC ICE |
| TURN relay | Deferred to v2 | ~$4/mo if strict-NAT issues arise |

**Total recurring cost: $0/mo for v1.**

---

## Project Structure

```
playsets-experiments/
├── apps/
│   ├── client/               # React + Vite frontend
│   │   ├── src/
│   │   │   ├── babylon/      # BabylonJS scene, grid, sprite rendering
│   │   │   ├── components/   # React UI (SpritePicker, EmoteMenu, PlayerList, TopBar)
│   │   │   ├── networking/   # WebRTC peer connection, DataChannel, message handlers
│   │   │   ├── store/        # Room state (Zustand or similar)
│   │   │   └── main.tsx
│   │   └── public/
│   │       └── assets/sprites/   # Exported PNGs + manifest.json
│   └── server/               # Node.js signaling server
│       └── src/
│           ├── rooms.ts      # In-memory room registry
│           └── index.ts      # Socket.io event handlers
├── docs/
│   └── superpowers/specs/
└── package.json              # pnpm workspace root
```

---

## Verification Plan

1. **Asset pipeline**: export a handful of sprites from Unity, confirm they load in a standalone BabylonJS test page with billboard mode
2. **Grid rendering**: open client locally, confirm 20×20 grid renders, camera rotates horizontally, sprites snap correctly
3. **Signaling**: run signaling server locally, confirm two browser tabs can exchange WebRTC offers and open a DataChannel
4. **Multiplayer sync**: open host tab + guest tab, place/move a sprite in host — confirm guest sees it update in real-time
5. **Emote flow**: click sprite in host tab, select emote — confirm floating emote appears in both tabs
6. **URL sharing**: copy room URL, open in new browser profile (simulate guest) — confirm full join flow
7. **Disconnect handling**: close host tab — confirm guest sees disconnect banner
