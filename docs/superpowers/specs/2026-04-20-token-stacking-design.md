# Token Stacking (Layer Control — Part 1) Design

## Goal

When multiple tokens share a grid cell, let any player cycle their z-order via a "x / y" badge that appears below the token on canvas after tapping it.

## Architecture

Stack position is a field on `SpriteInstance`. Rendering uses a tiny Y-offset so the top-of-stack token is always closest to the camera (picked first by raycasts, renders in front in the isometric view). A floating `StackBadge` component handles the UI.

**Tech stack:** React + BabylonJS + Zustand + WebRTC (same as rest of app)

---

## Data Model

`SpriteInstance` gets one new optional field:

```typescript
zOrder?: number   // 0 = bottom of stack; higher = closer to top; defaults to 0
```

Assignment on placement: `zOrder = count of sprites already at (col, row)`. A lone token gets 0; the second token placed on the same cell gets 1; third gets 2.

Stack position is always computed live — sort all sprites at a cell by `zOrder` ascending, then take the selected sprite's index in that list. Gaps in zOrder values (from removes/moves) are handled naturally by the sort; no renormalization needed.

---

## Store

One new action added to `useRoomStore`:

```typescript
setZOrder(instanceId: string, zOrder: number): void
```

Updates `sprites[instanceId].zOrder`. No other store changes needed — `zOrder` is included in snapshots automatically since it lives on `SpriteInstance`.

---

## Rendering

In `SpriteManager.place()`, compute the mesh Y position as:

```
y = existingBaseY - zOrder * 0.03
```

Where `existingBaseY` is whatever Y value `SpriteManager` already uses for sprite mesh placement (the constant already in `sprites.ts`). Highest zOrder → lowest Y → closest to camera → picked first by `scene.pick()` ray, renders in front of lower-zOrder sprites in the isometric depth buffer.

In `SpriteManager`, add a `setZOrder(instanceId, zOrder)` method that updates the mesh's Y position directly on the existing mesh (no dispose/re-create needed).

When `zOrder` is absent or 0, Y = `BASE_Y` — no change for existing sprites.

---

## StackBadge Component

A new `StackBadge` component at `src/components/StackBadge.tsx`.

**Props:**
```typescript
interface Props {
  instanceId: string
  scene: Scene
  canvasLeft: number
  canvasTop: number
  onAdvance: () => void
}
```

**Positioning:** Runs a `requestAnimationFrame` loop (same pattern as `TokenHUD`) to re-project the token's world position each frame. Anchor = `cellToWorld(col, row)` projected to screen, then offset `+60px` downward. Centered horizontally. This keeps the badge pinned to the token as the camera pans or zooms.

**Display:** A single button reading `"{pos} / {total}"` (1-indexed from bottom). `pos` = sorted index of `instanceId` in sprites-at-cell + 1. `total` = count of sprites at that cell.

**Visibility:** Only renders when `total > 1`.

---

## Cycling Behavior

When the badge button is clicked:

1. Find all sprites at the same `(col, row)`, sorted by `zOrder` ascending → `stack[]`
2. Find index `i` of the selected token in `stack`
3. Determine swap target:
   - If `i < stack.length - 1`: swap with `stack[i + 1]` (advance up)
   - If `i == stack.length - 1`: swap with `stack[0]` (wrap to bottom)
4. Exchange `zOrder` values between the two tokens
5. Send two `sprite:zorder` messages (one per swapped token)
6. Update `SpriteManager` Y positions for both tokens

---

## Networking

New message type:

```typescript
{ type: 'sprite:zorder'; instanceId: string; zOrder: number }
```

Host applies + relays (same pattern as all other sprite messages). Guest applies on receive.

Host/guest message handler:
```typescript
case 'sprite:zorder': {
  useRoomStore.getState().setZOrder(msg.instanceId, msg.zOrder)
  this.spriteManager.setZOrder(msg.instanceId, msg.zOrder)
  break
}
```

`zOrder` is included in `state:snapshot` automatically (it's a field on `SpriteInstance`). No separate snapshot handling needed.

---

## RoomPage Integration

**State:** `stackBadge: { instanceId: string } | null`

**Show:** In `onSpriteClick` (inside `setupDragController`), after setting `tokenMenu`, check if more than one sprite shares that cell. If yes, set `stackBadge = { instanceId }`.

**Hide:** Add `setStackBadge(null)` to the POINTERDOWN handler in `setupScenePointerObservable`, alongside the existing `setTokenMenu(null)` and `setDirectionPicker(null)` calls.

**Placement zOrder:** In `handlePointerUp` where a new sprite is placed, count existing sprites at `(col, row)` and assign `zOrder` to the new `SpriteInstance` before sending.

**Render:** `<StackBadge>` rendered alongside `<TokenMenu>` and `<DirectionPicker>` in the JSX.

---

## Files

| Action | File |
|--------|------|
| Modify | `src/types.ts` — add `zOrder?` to `SpriteInstance`, add `sprite:zorder` message |
| Modify | `src/store/room.ts` — add `setZOrder` action |
| Modify | `src/babylon/sprites.ts` — apply Y-offset in `place()`, add `setZOrder()` method |
| Modify | `src/networking/host.ts` — handle `sprite:zorder` |
| Modify | `src/networking/guest.ts` — handle `sprite:zorder` |
| Modify | `src/pages/RoomPage.tsx` — stackBadge state, assign zOrder on place, wire StackBadge |
| Create | `src/components/StackBadge.tsx` |
