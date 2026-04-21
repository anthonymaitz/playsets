# Token Stacking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When multiple tokens share a grid cell, show a "x / y" badge below the tapped token that lets any player cycle the stack order.

**Architecture:** Add `zOrder` to `SpriteInstance`; SpriteManager offsets mesh Y by `zOrder * 0.03` so the top-of-stack token is closest to the isometric camera (picked first, renders in front). A `StackBadge` component projects the token's world position to screen via RAF and renders a clickable button. Clicking swaps zOrders with the next token in the stack.

**Tech Stack:** React, BabylonJS, Zustand, Vitest, TypeScript

---

## File Structure

| Action  | File |
|---------|------|
| Modify  | `apps/client/src/types.ts` |
| Modify  | `apps/client/src/store/room.ts` |
| Modify  | `apps/client/src/store/room.test.ts` |
| Modify  | `apps/client/src/babylon/sprites.ts` |
| Modify  | `apps/client/src/networking/host.ts` |
| Modify  | `apps/client/src/networking/guest.ts` |
| Create  | `apps/client/src/components/StackBadge.tsx` |
| Modify  | `apps/client/src/pages/RoomPage.tsx` |

---

### Task 1: Add `zOrder` to types and store

**Files:**
- Modify: `apps/client/src/types.ts`
- Modify: `apps/client/src/store/room.ts`
- Modify: `apps/client/src/store/room.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `apps/client/src/store/room.test.ts` and add this block at the end of the file:

```typescript
describe('useRoomStore — zOrder', () => {
  beforeEach(() => { useRoomStore.getState().reset() })

  it('setZOrder updates zOrder for an existing sprite', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1' })
    useRoomStore.getState().setZOrder('i1', 2)
    expect(useRoomStore.getState().sprites['i1'].zOrder).toBe(2)
  })

  it('setZOrder does nothing for unknown instanceId', () => {
    expect(() => useRoomStore.getState().setZOrder('unknown', 2)).not.toThrow()
  })

  it('placeSprite preserves zOrder when provided', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1', zOrder: 3 })
    expect(useRoomStore.getState().sprites['i1'].zOrder).toBe(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/client && pnpm test
```

Expected: 3 new failures — `setZOrder is not a function` and `zOrder` undefined.

- [ ] **Step 3: Add `zOrder` to `SpriteInstance` in types.ts**

In `apps/client/src/types.ts`, the `SpriteInstance` interface currently ends at line 17. Add `zOrder` as an optional field:

```typescript
export interface SpriteInstance {
  instanceId: string
  spriteId: string
  col: number
  row: number
  placedBy: string
  facing?: FacingDir
  statuses?: string[]
  speech?: string
  animation?: AnimationName
  hidden?: boolean
  zOrder?: number
}
```

Also add the new message type to the `GameMessage` union at the end of the union (after the last `prop:move` line):

```typescript
  | { type: 'sprite:zorder'; instanceId: string; zOrder: number }
```

- [ ] **Step 4: Add `setZOrder` to store**

In `apps/client/src/store/room.ts`, add `setZOrder` to the `RoomStore` interface (after `removeSprite`):

```typescript
  setZOrder: (instanceId: string, zOrder: number) => void
```

Then add the implementation in the `create` call (after the `removeSprite` implementation):

```typescript
  setZOrder: (instanceId, zOrder) =>
    set((state) => {
      if (!state.sprites[instanceId]) return state
      return { sprites: { ...state.sprites, [instanceId]: { ...state.sprites[instanceId], zOrder } } }
    }),
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/client && pnpm test
```

Expected: all 3 new tests pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/types.ts apps/client/src/store/room.ts apps/client/src/store/room.test.ts
git commit -m "feat: add zOrder field to SpriteInstance and store"
```

---

### Task 2: Apply Y-offset in SpriteManager

**Files:**
- Modify: `apps/client/src/babylon/sprites.ts`

Context: `sprites.ts` is a BabylonJS manager class. It is NOT tested with vitest (it depends on BabylonJS engine). Verify the change manually by running the dev server.

`SPRITE_HEIGHT = CELL_SIZE * 1.6` is defined at line 18. The sprite mesh Y position is set at line 111: `plane.position = new Vector3(x, h / 2, z)`.

- [ ] **Step 1: Apply zOrder Y-offset in `place()`**

In `apps/client/src/babylon/sprites.ts`, change line 111 from:

```typescript
    plane.position = new Vector3(x, h / 2, z)
```

to:

```typescript
    plane.position = new Vector3(x, h / 2 - (instance.zOrder ?? 0) * 0.03, z)
```

- [ ] **Step 2: Add `setZOrder` method to `SpriteManager`**

Add this method after the `setHighlight` method (around line 329):

```typescript
  setZOrder(instanceId: string, zOrder: number): void {
    const mesh = this.meshes.get(instanceId)
    if (!mesh) return
    const newY = SPRITE_HEIGHT / 2 - zOrder * 0.03
    mesh.position.y = newY
    // Keep animation baseY in sync if animation is active
    if (mesh.metadata?.baseY !== undefined) {
      mesh.metadata.baseY = newY
    }
  }
```

- [ ] **Step 3: Verify manually**

```bash
cd apps/client && pnpm dev
```

Open the app, place two tokens on the same cell. They should visually overlap (the Y difference of 0.03 is invisible to the eye). No errors in console.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/babylon/sprites.ts
git commit -m "feat: apply zOrder Y-offset in SpriteManager"
```

---

### Task 3: Wire networking

**Files:**
- Modify: `apps/client/src/networking/host.ts`
- Modify: `apps/client/src/networking/guest.ts`

- [ ] **Step 1: Handle `sprite:zorder` in host.ts**

In `apps/client/src/networking/host.ts`, find the `sprite:hide` case in `handleMessage` and add the new case directly after it:

```typescript
      case 'sprite:zorder': {
        useRoomStore.getState().setZOrder(msg.instanceId, msg.zOrder)
        this.spriteManager.setZOrder(msg.instanceId, msg.zOrder)
        break
      }
```

- [ ] **Step 2: Handle `sprite:zorder` in guest.ts**

In `apps/client/src/networking/guest.ts`, find the `sprite:hide` case in `handleMessage` and add the new case directly after it:

```typescript
      case 'sprite:zorder': {
        useRoomStore.getState().setZOrder(msg.instanceId, msg.zOrder)
        this.spriteManager.setZOrder(msg.instanceId, msg.zOrder)
        break
      }
```

- [ ] **Step 3: Run type check**

```bash
cd apps/client && npx tsc --noEmit 2>&1 | grep -v "buildings.ts\|signaling.ts"
```

Expected: no output (no new errors).

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/networking/host.ts apps/client/src/networking/guest.ts
git commit -m "feat: handle sprite:zorder message in host and guest"
```

---

### Task 4: Create StackBadge component

**Files:**
- Create: `apps/client/src/components/StackBadge.tsx`

The badge appears below the tapped token and shows "x / y" (1-indexed from bottom). It uses a `requestAnimationFrame` loop to stay anchored to the token as the camera moves — same pattern as `TokenHUD`. It reads from `useRoomStore.getState()` inside the loop (not the React hook) to avoid per-frame re-subscription overhead.

- [ ] **Step 1: Create `StackBadge.tsx`**

```typescript
import { useEffect, useRef, useState } from 'react'
import { Vector3, Matrix } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'
import { useRoomStore } from '../store/room'
import { cellToWorld, CELL_SIZE } from '../babylon/grid'

const SPRITE_HEIGHT = CELL_SIZE * 1.6

interface Props {
  instanceId: string
  scene: Scene
  canvasLeft: number
  canvasTop: number
  onAdvance: () => void
}

export function StackBadge({ instanceId, scene, canvasLeft, canvasTop, onAdvance }: Props) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null)
  const [stackInfo, setStackInfo] = useState<{ current: number; total: number } | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const update = () => {
      const { sprites } = useRoomStore.getState()
      const sprite = sprites[instanceId]
      if (!sprite) { rafRef.current = requestAnimationFrame(update); return }

      const stack = Object.values(sprites)
        .filter((s) => s.col === sprite.col && s.row === sprite.row)
        .sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0))

      const idx = stack.findIndex((s) => s.instanceId === instanceId)
      setStackInfo({ current: idx + 1, total: stack.length })

      const { x, z } = cellToWorld(sprite.col, sprite.row)
      const camera = scene.activeCamera
      if (!camera) { rafRef.current = requestAnimationFrame(update); return }
      const viewport = camera.viewport.toGlobal(
        scene.getEngine().getRenderWidth(),
        scene.getEngine().getRenderHeight(),
      )
      const transform = scene.getTransformMatrix()
      const world = new Vector3(x, SPRITE_HEIGHT / 2, z)
      const projected = Vector3.Project(world, Matrix.Identity(), transform, viewport)
      setScreenPos({ x: canvasLeft + projected.x, y: canvasTop + projected.y + 60 })

      rafRef.current = requestAnimationFrame(update)
    }

    rafRef.current = requestAnimationFrame(update)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [instanceId, scene, canvasLeft, canvasTop])

  if (!screenPos || !stackInfo || stackInfo.total <= 1) return null

  return (
    <button
      onPointerDown={(e) => { e.stopPropagation(); onAdvance() }}
      style={{
        position: 'fixed',
        left: screenPos.x - 24,
        top: screenPos.y - 14,
        width: 48,
        height: 28,
        zIndex: 70,
        background: 'rgba(15,15,20,0.88)',
        border: '1px solid rgba(255,210,50,0.7)',
        borderRadius: 6,
        color: '#ffe033',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        letterSpacing: '0.03em',
        boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
      }}
    >
      {stackInfo.current} / {stackInfo.total}
    </button>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
cd apps/client && npx tsc --noEmit 2>&1 | grep -v "buildings.ts\|signaling.ts"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/StackBadge.tsx
git commit -m "feat: add StackBadge component for token stack cycling"
```

---

### Task 5: Wire RoomPage

**Files:**
- Modify: `apps/client/src/pages/RoomPage.tsx`

Context: `RoomPage.tsx` is the main page. Key functions to understand before editing:
- `setupDragController` (bottom of file) — handles sprite drag + click. Its `onSpriteClick` callback is where `setTokenMenu` is called. This is where `setStackBadge` must also be called.
- `setupScenePointerObservable` (bottom of file) — clears menus on POINTERDOWN. Add `setStackBadge(null)` here.
- `handlePointerUp` (inside the main `useEffect`) — handles sprite placement. This is where `zOrder` must be assigned to new sprites.
- The JSX at the bottom renders `<TokenMenu>`, `<DirectionPicker>`, `<RoofMenu>`. Add `<StackBadge>` here.

- [ ] **Step 1: Add `StackBadge` import and `stackBadge` state**

At the top of `RoomPage.tsx`, add the import alongside the other component imports:

```typescript
import { StackBadge } from '../components/StackBadge'
```

Inside `RoomPage()`, add state alongside the existing `roofMenu` state:

```typescript
  const [stackBadge, setStackBadge] = useState<{ instanceId: string } | null>(null)
```

- [ ] **Step 2: Assign `zOrder` when placing a new sprite**

In `handlePointerUp`, find the block that creates `instance` and places the sprite (currently uses `const instance = { instanceId: newInstanceId, spriteId: sprite.id, col, row, placedBy: lp.playerId }`). Replace the instance construction:

```typescript
      const existingCount = Object.values(useRoomStore.getState().sprites)
        .filter((s) => s.col === col && s.row === row).length
      const instance = { instanceId: newInstanceId, spriteId: sprite.id, col, row, placedBy: lp.playerId, zOrder: existingCount }
```

- [ ] **Step 3: Add `handleAdvanceStack` function**

Inside `RoomPage()`, add this function after the `dispatchMsg` definition:

```typescript
  const handleAdvanceStack = () => {
    if (!stackBadge) return
    const { sprites } = useRoomStore.getState()
    const sprite = sprites[stackBadge.instanceId]
    if (!sprite) return

    const stack = Object.values(sprites)
      .filter((s) => s.col === sprite.col && s.row === sprite.row)
      .sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0))

    if (stack.length <= 1) return

    const idx = stack.findIndex((s) => s.instanceId === stackBadge.instanceId)
    const nextIdx = (idx + 1) % stack.length
    const currentZ = stack[idx].zOrder ?? 0
    const nextZ = stack[nextIdx].zOrder ?? 0

    useRoomStore.getState().setZOrder(stack[idx].instanceId, nextZ)
    useRoomStore.getState().setZOrder(stack[nextIdx].instanceId, currentZ)
    spriteManagerRef.current?.setZOrder(stack[idx].instanceId, nextZ)
    spriteManagerRef.current?.setZOrder(stack[nextIdx].instanceId, currentZ)
    dispatchMsg({ type: 'sprite:zorder', instanceId: stack[idx].instanceId, zOrder: nextZ })
    dispatchMsg({ type: 'sprite:zorder', instanceId: stack[nextIdx].instanceId, zOrder: currentZ })
  }
```

- [ ] **Step 4: Pass `setStackBadge` to `setupDragController`**

Update the `setupDragController` call in the main `useEffect`:

```typescript
    const dragController = setupDragController(scene, spriteManager, camera, sessionRef, canvasRef, showDirPickerAtPointer, setTokenMenu, setStackBadge, buildingModeRef)
```

Update the `setupDragController` function signature at the bottom of the file:

```typescript
function setupDragController(
  scene: Scene,
  spriteManager: SpriteManager,
  camera: ArcRotateCamera,
  sessionRef: React.MutableRefObject<HostSession | GuestSession | null>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  showDirPickerAtPointer: (instanceId: string) => void,
  setTokenMenu: (m: TokenMenuState | null) => void,
  setStackBadge: (b: { instanceId: string } | null) => void,
  buildingModeRef: React.MutableRefObject<boolean>,
): DragController {
```

Inside `setupDragController`, update the `onSpriteClick` callback to set the stack badge:

```typescript
    onSpriteClick: (instanceId) => {
      if (buildingModeRef.current) return
      const rect = canvasRef.current?.getBoundingClientRect()
      const sx = (rect?.left ?? 0) + scene.pointerX
      const sy = (rect?.top ?? 0) + scene.pointerY
      setTokenMenu({ instanceId, x: sx, y: sy })
      if (spriteManager.getMesh(instanceId)?.metadata?.hasDirections) showDirPickerAtPointer(instanceId)
      const { sprites } = useRoomStore.getState()
      const tapped = sprites[instanceId]
      if (tapped) {
        const count = Object.values(sprites).filter((s) => s.col === tapped.col && s.row === tapped.row).length
        setStackBadge(count > 1 ? { instanceId } : null)
      }
    },
```

- [ ] **Step 5: Clear `stackBadge` on POINTERDOWN**

Update the `setupScenePointerObservable` call in the main `useEffect`:

```typescript
    setupScenePointerObservable(scene, spriteManager, dragController, selectedSpriteRef, sessionRef, setTokenMenu, setDirectionPicker, setRoofMenu, setStackBadge, buildingModeRef)
```

Update the `setupScenePointerObservable` function signature at the bottom of the file:

```typescript
function setupScenePointerObservable(
  scene: Scene,
  spriteManager: SpriteManager,
  dragController: DragController,
  selectedSpriteRef: React.MutableRefObject<SpriteManifestEntry | null>,
  sessionRef: React.MutableRefObject<HostSession | GuestSession | null>,
  setTokenMenu: (m: TokenMenuState | null) => void,
  setDirectionPicker: (d: { instanceId: string; x: number; y: number } | null) => void,
  setRoofMenu: (m: { instanceId: string; x: number; y: number } | null) => void,
  setStackBadge: (b: { instanceId: string } | null) => void,
  buildingModeRef: React.MutableRefObject<boolean>,
): void {
```

Inside `setupScenePointerObservable`, update the POINTERDOWN handler:

```typescript
    if (info.type === PointerEventTypes.POINTERDOWN) {
      setDirectionPicker(null)
      setTokenMenu(null)
      setRoofMenu(null)
      setStackBadge(null)
    }
```

- [ ] **Step 6: Clear `stackBadge` when a token is removed**

In the JSX section of `RoomPage`, find the `onRemove` callback inside `<TokenMenu>`:

```typescript
          onRemove={(instanceId) => {
            dispatchMsg({ type: 'sprite:remove', instanceId })
            setTokenMenu(null)
            setStackBadge(null)
          }}
```

- [ ] **Step 7: Render `<StackBadge>` in JSX**

In the JSX return, add `<StackBadge>` after the `<RoofMenu>` block and before the `{buildingMode && ...}` block:

```tsx
      {stackBadge && sceneRef.current && (
        <StackBadge
          instanceId={stackBadge.instanceId}
          scene={sceneRef.current}
          canvasLeft={canvasRect.left}
          canvasTop={canvasRect.top}
          onAdvance={handleAdvanceStack}
        />
      )}
```

- [ ] **Step 8: Run type check**

```bash
cd apps/client && npx tsc --noEmit 2>&1 | grep -v "buildings.ts\|signaling.ts"
```

Expected: no output.

- [ ] **Step 9: Run tests**

```bash
cd apps/client && pnpm test
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add apps/client/src/pages/RoomPage.tsx
git commit -m "feat: wire StackBadge and token stack cycling into RoomPage"
```
