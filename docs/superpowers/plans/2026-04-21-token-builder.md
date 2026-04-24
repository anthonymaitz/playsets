# Token Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A layer-based character builder that lets every player compose a custom token from stacked placeholder-art layers (face, ears, hair, hats, armor, main hand, off hand), with per-slot color tinting, live 3D preview via camera zoom, and full WebRTC sync.

**Architecture:** Token definitions (layer references + per-slot colors) are stored in a new Zustand token store and broadcast as `token:define` messages. Each client composes layers onto an HTML canvas and feeds the result as a data URL into the existing BabylonJS billboard sprite system. The builder is a fixed bottom-panel React component that overlays the 3D canvas; opening it zooms the ArcRotateCamera to the token's world position.

**Tech Stack:** React, BabylonJS ArcRotateCamera + Texture, HTML Canvas 2D API, Zustand, nanoid, existing WebRTC host/guest message relay.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/client/src/types.ts` | Modify | Add `SlotKey`, `SlotColors`, `TokenLayerRef`, `TokenDefinition`; `definitionId?` on `SpriteInstance` + `sprite:place`; `token:define` + `token:snapshot` messages |
| `apps/client/src/store/tokens.ts` | Create | Zustand store: `definitions`, `addOrUpdate`, `remove`, `loadSnapshot`, `reset` |
| `apps/client/src/store/tokens.test.ts` | Create | Unit tests for token store |
| `apps/client/src/babylon/tokenManifest.ts` | Create | `SLOT_DEFS` array, `COLOR_PRESETS`, placeholder draw functions per slot/variant |
| `apps/client/src/babylon/tokenCompositor.ts` | Create | `compositeToken(def)→canvas`, `compositeToDataUrl(def)→string` |
| `apps/client/src/babylon/sprites.ts` | Modify | `updateTexture(instanceId, url)` method; skip cache for data URLs in `getTexture` |
| `apps/client/src/components/TokenBuilder.tsx` | Create | Full builder panel: tabs, variant row, color swatches, save/cancel |
| `apps/client/src/networking/messages.ts` | Modify | `sendTokenSnapshot` helper |
| `apps/client/src/networking/host.ts` | Modify | `token:define` relay handler; send token snapshot on guest join |
| `apps/client/src/networking/guest.ts` | Modify | `token:define` handler; composite on `sprite:place` when `definitionId` present |
| `apps/client/src/components/Sidebar.tsx` | Modify | "New Token" button in tokens tab |
| `apps/client/src/components/token-menu/TokenMenu.tsx` | Modify | "Edit Token" prop + button |
| `apps/client/src/pages/RoomPage.tsx` | Modify | `cameraRef`, builder state, new-token flow, save/cancel, camera zoom, wire `TokenBuilder` |

---

## Task 1: Types + Token Store + Message Types

**Files:**
- Modify: `apps/client/src/types.ts`
- Create: `apps/client/src/store/tokens.ts`
- Create: `apps/client/src/store/tokens.test.ts`

- [ ] **Step 1: Add new types to `types.ts`**

Add after the `Roof` interface and before `GameMessage`:

```typescript
export type SlotKey = 'face' | 'ears' | 'hair' | 'hats' | 'armor' | 'mainHand' | 'offHand'

export interface SlotColors {
  primary?: string
  secondary?: string
  tertiary?: string
}

export interface TokenLayerRef {
  assetId: string
  colors: SlotColors
}

export interface TokenDefinition {
  definitionId: string
  ownedBy: string
  layers: Partial<Record<SlotKey, TokenLayerRef>>
}
```

Add `definitionId?: string` to `SpriteInstance`:
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
  definitionId?: string   // present when sprite is a custom token
}
```

Add `definitionId?: string` to the `sprite:place` message union member:
```typescript
| { type: 'sprite:place'; spriteId: string; col: number; row: number; instanceId: string; placedBy: string; zOrder?: number; definitionId?: string }
```

Add to the `GameMessage` union:
```typescript
| { type: 'token:define'; definition: TokenDefinition }
| { type: 'token:snapshot'; definitions: TokenDefinition[] }
```

- [ ] **Step 2: Write failing tests in `apps/client/src/store/tokens.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useTokenStore } from './tokens'

describe('useTokenStore', () => {
  beforeEach(() => {
    useTokenStore.getState().reset()
  })

  it('starts with empty definitions', () => {
    expect(Object.keys(useTokenStore.getState().definitions)).toHaveLength(0)
  })

  it('addOrUpdate adds a definition', () => {
    useTokenStore.getState().addOrUpdate({ definitionId: 'd1', ownedBy: 'p1', layers: {} })
    expect(useTokenStore.getState().definitions['d1']).toMatchObject({ ownedBy: 'p1' })
  })

  it('addOrUpdate replaces existing definition', () => {
    useTokenStore.getState().addOrUpdate({ definitionId: 'd1', ownedBy: 'p1', layers: {} })
    useTokenStore.getState().addOrUpdate({
      definitionId: 'd1', ownedBy: 'p1',
      layers: { face: { assetId: 'face-1', colors: { primary: '#ff0000' } } },
    })
    expect(useTokenStore.getState().definitions['d1'].layers.face?.assetId).toBe('face-1')
  })

  it('remove deletes a definition', () => {
    useTokenStore.getState().addOrUpdate({ definitionId: 'd1', ownedBy: 'p1', layers: {} })
    useTokenStore.getState().remove('d1')
    expect(useTokenStore.getState().definitions['d1']).toBeUndefined()
  })

  it('remove is a no-op for unknown id', () => {
    expect(() => useTokenStore.getState().remove('unknown')).not.toThrow()
  })

  it('loadSnapshot replaces all definitions', () => {
    useTokenStore.getState().addOrUpdate({ definitionId: 'old', ownedBy: 'p1', layers: {} })
    useTokenStore.getState().loadSnapshot([
      { definitionId: 'new1', ownedBy: 'p2', layers: {} },
    ])
    expect(useTokenStore.getState().definitions['old']).toBeUndefined()
    expect(useTokenStore.getState().definitions['new1']).toBeDefined()
  })

  it('reset clears all definitions', () => {
    useTokenStore.getState().addOrUpdate({ definitionId: 'd1', ownedBy: 'p1', layers: {} })
    useTokenStore.getState().reset()
    expect(Object.keys(useTokenStore.getState().definitions)).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/client && pnpm test --run tokens.test
```
Expected: FAIL — "Cannot find module './tokens'"

- [ ] **Step 4: Create `apps/client/src/store/tokens.ts`**

```typescript
import { create } from 'zustand'
import type { TokenDefinition } from '../types'

interface TokenStore {
  definitions: Record<string, TokenDefinition>
  addOrUpdate: (def: TokenDefinition) => void
  remove: (definitionId: string) => void
  loadSnapshot: (defs: TokenDefinition[]) => void
  reset: () => void
}

export const useTokenStore = create<TokenStore>((set) => ({
  definitions: {},
  addOrUpdate: (def) =>
    set((s) => ({ definitions: { ...s.definitions, [def.definitionId]: def } })),
  remove: (definitionId) =>
    set((s) => {
      const next = { ...s.definitions }
      delete next[definitionId]
      return { definitions: next }
    }),
  loadSnapshot: (defs) =>
    set({ definitions: Object.fromEntries(defs.map((d) => [d.definitionId, d])) }),
  reset: () => set({ definitions: {} }),
}))
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/client && pnpm test --run tokens.test
```
Expected: 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/types.ts apps/client/src/store/tokens.ts apps/client/src/store/tokens.test.ts
git commit -m "feat: token builder types, store, and message types"
```

---

## Task 2: Placeholder Token Manifest + Compositor

**Files:**
- Create: `apps/client/src/babylon/tokenManifest.ts`
- Create: `apps/client/src/babylon/tokenCompositor.ts`

No unit tests — these are pure canvas drawing operations. Visual correctness is verified by opening the builder in the browser (Task 5).

- [ ] **Step 1: Create `apps/client/src/babylon/tokenManifest.ts`**

Canvas dimensions used by the compositor: **128 × 192** pixels (matches the 0.9:1.6 sprite plane aspect ratio).

```typescript
import type { SlotKey, SlotColors } from '../types'

export const CANVAS_W = 128
export const CANVAS_H = 192

export const DEFAULT_SKIN    = '#c8956a'
export const DEFAULT_EYE     = '#3d2b1f'
export const DEFAULT_HAIR    = '#3d1c02'
export const DEFAULT_ARMOR_P = '#4a6fa5'
export const DEFAULT_ARMOR_S = '#2a3f5f'

// Preset swatches shown in the color picker UI
export const COLOR_PRESETS: string[] = [
  // Skin tones
  '#f5d5b0', '#e8b88a', '#c8956a', '#a0724a', '#7a4a2a', '#4a2a12',
  // Eye / hair
  '#3d2b1f', '#4a90d9', '#2e7d32', '#808080', '#c8a415', '#7a3a7a',
  '#1a0a00', '#8b4513', '#c8a96e', '#f5d890', '#cc4444', '#ffffff',
  // Armor / hat
  '#cc3333', '#3355cc', '#33aa44', '#888888', '#c8a415', '#442299',
  '#884400', '#111111', '#ffeecc', '#556b2f', '#8b0000', '#4682b4',
]

export interface TokenAsset {
  id: string
  label: string
  /** Draw this layer onto ctx. colors are the per-slot color selections. */
  draw: (ctx: CanvasRenderingContext2D, colors: SlotColors) => void
}

export interface SlotDef {
  key: SlotKey
  label: string
  /** Number of user-controlled color channels (0 = not tintable / inherited). */
  colorCount: 0 | 1 | 2 | 3
  colorLabels: string[]
  assets: TokenAsset[]   // first entry is always "none"
}

// ── Draw helpers ─────────────────────────────────────────────────────────────

function fill(ctx: CanvasRenderingContext2D, color: string, fn: () => void) {
  ctx.fillStyle = color
  ctx.beginPath()
  fn()
  ctx.fill()
}

function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
}

// ── Body blank ────────────────────────────────────────────────────────────────
// Always drawn first by the compositor. Not a selectable slot.

export function drawBodyBlank(ctx: CanvasRenderingContext2D, skinTone: string): void {
  const s = skinTone
  // Head
  fill(ctx, s, () => ellipse(ctx, 64, 48, 24, 28))
  // Neck
  fill(ctx, s, () => ctx.rect(56, 72, 16, 10))
  // Torso
  fill(ctx, s, () => { ctx.roundRect(38, 80, 52, 56, 4) })
  // Upper arms
  fill(ctx, s, () => { ctx.roundRect(20, 82, 18, 46, 6) })
  fill(ctx, s, () => { ctx.roundRect(90, 82, 18, 46, 6) })
  // Forearms
  fill(ctx, s, () => { ctx.roundRect(22, 124, 14, 30, 5) })
  fill(ctx, s, () => { ctx.roundRect(92, 124, 14, 30, 5) })
  // Hands
  fill(ctx, s, () => ellipse(ctx, 29, 157, 9, 7))
  fill(ctx, s, () => ellipse(ctx, 99, 157, 9, 7))
  // Legs
  fill(ctx, s, () => { ctx.roundRect(42, 134, 20, 48, 5) })
  fill(ctx, s, () => { ctx.roundRect(66, 134, 20, 48, 5) })
  // Feet
  fill(ctx, s, () => ellipse(ctx, 52, 182, 14, 7))
  fill(ctx, s, () => ellipse(ctx, 76, 182, 14, 7))
}

// ── Slot definitions ─────────────────────────────────────────────────────────

export const SLOT_DEFS: SlotDef[] = [
  // ── Face ──────────────────────────────────────────────────────────────────
  {
    key: 'face',
    label: 'Face',
    colorCount: 2,
    colorLabels: ['Skin', 'Eyes'],
    assets: [
      {
        id: 'face-none',
        label: 'Plain',
        draw: (_ctx, _colors) => { /* no face overlay — body blank provides skin */ },
      },
      {
        id: 'face-round',
        label: 'Round',
        draw: (ctx, colors) => {
          const eye = colors.secondary ?? DEFAULT_EYE
          // Eyes
          fill(ctx, eye, () => ellipse(ctx, 55, 45, 5, 5))
          fill(ctx, eye, () => ellipse(ctx, 73, 45, 5, 5))
          // Eye shine
          fill(ctx, 'rgba(255,255,255,0.5)', () => ellipse(ctx, 57, 43, 2, 2))
          fill(ctx, 'rgba(255,255,255,0.5)', () => ellipse(ctx, 75, 43, 2, 2))
          // Nose
          fill(ctx, colors.primary ?? DEFAULT_SKIN, () => ellipse(ctx, 64, 54, 3, 2))
        },
      },
      {
        id: 'face-stern',
        label: 'Stern',
        draw: (ctx, colors) => {
          const eye = colors.secondary ?? DEFAULT_EYE
          // Angled brows
          ctx.strokeStyle = eye
          ctx.lineWidth = 2
          ctx.beginPath(); ctx.moveTo(49, 38); ctx.lineTo(61, 41); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(79, 38); ctx.lineTo(67, 41); ctx.stroke()
          // Narrow eyes
          fill(ctx, eye, () => { ctx.roundRect(50, 44, 12, 4, 2) })
          fill(ctx, eye, () => { ctx.roundRect(66, 44, 12, 4, 2) })
        },
      },
    ],
  },

  // ── Ears ──────────────────────────────────────────────────────────────────
  // colorCount:0 — skin is inherited from face.colors.primary by compositor
  {
    key: 'ears',
    label: 'Ears',
    colorCount: 0,
    colorLabels: [],
    assets: [
      {
        id: 'ears-none',
        label: 'None',
        draw: (_ctx, _colors) => {},
      },
      {
        id: 'ears-round',
        label: 'Round',
        draw: (ctx, colors) => {
          const s = colors.primary ?? DEFAULT_SKIN
          fill(ctx, s, () => ellipse(ctx, 39, 50, 7, 9))
          fill(ctx, s, () => ellipse(ctx, 89, 50, 7, 9))
        },
      },
      {
        id: 'ears-pointed',
        label: 'Pointed',
        draw: (ctx, colors) => {
          const s = colors.primary ?? DEFAULT_SKIN
          // Left pointed ear
          fill(ctx, s, () => {
            ctx.moveTo(39, 58); ctx.lineTo(33, 36); ctx.lineTo(46, 50); ctx.closePath()
          })
          // Right pointed ear
          fill(ctx, s, () => {
            ctx.moveTo(89, 58); ctx.lineTo(95, 36); ctx.lineTo(82, 50); ctx.closePath()
          })
        },
      },
    ],
  },

  // ── Hair ──────────────────────────────────────────────────────────────────
  {
    key: 'hair',
    label: 'Hair',
    colorCount: 1,
    colorLabels: ['Color'],
    assets: [
      {
        id: 'hair-none',
        label: 'Bald',
        draw: (_ctx, _colors) => {},
      },
      {
        id: 'hair-short',
        label: 'Short',
        draw: (ctx, colors) => {
          const c = colors.primary ?? DEFAULT_HAIR
          fill(ctx, c, () => { ctx.roundRect(42, 16, 44, 28, [14, 14, 0, 0]) })
        },
      },
      {
        id: 'hair-long',
        label: 'Long',
        draw: (ctx, colors) => {
          const c = colors.primary ?? DEFAULT_HAIR
          fill(ctx, c, () => { ctx.roundRect(42, 16, 44, 28, [14, 14, 0, 0]) })
          // Long sides
          fill(ctx, c, () => { ctx.roundRect(32, 30, 16, 52, 6) })
          fill(ctx, c, () => { ctx.roundRect(80, 30, 16, 52, 6) })
        },
      },
      {
        id: 'hair-messy',
        label: 'Messy',
        draw: (ctx, colors) => {
          const c = colors.primary ?? DEFAULT_HAIR
          // Irregular chunks
          fill(ctx, c, () => ellipse(ctx, 52, 22, 14, 16))
          fill(ctx, c, () => ellipse(ctx, 68, 18, 12, 14))
          fill(ctx, c, () => ellipse(ctx, 64, 26, 18, 12))
        },
      },
    ],
  },

  // ── Hats ──────────────────────────────────────────────────────────────────
  {
    key: 'hats',
    label: 'Hats',
    colorCount: 2,
    colorLabels: ['Primary', 'Brim'],
    assets: [
      {
        id: 'hats-none',
        label: 'None',
        draw: (_ctx, _colors) => {},
      },
      {
        id: 'hats-cap',
        label: 'Cap',
        draw: (ctx, colors) => {
          const p = colors.primary ?? '#884400'
          fill(ctx, p, () => { ctx.roundRect(44, 12, 40, 24, [14, 14, 0, 0]) })
          // Brim
          fill(ctx, colors.secondary ?? '#6a3300', () => { ctx.roundRect(38, 34, 52, 6, 3) })
        },
      },
      {
        id: 'hats-wide',
        label: 'Wide Brim',
        draw: (ctx, colors) => {
          const p = colors.primary ?? '#884400'
          // Crown
          fill(ctx, p, () => { ctx.roundRect(48, 8, 32, 26, [10, 10, 0, 0]) })
          // Wide brim
          fill(ctx, colors.secondary ?? '#6a3300', () => { ctx.roundRect(22, 32, 84, 7, 3) })
        },
      },
      {
        id: 'hats-crown',
        label: 'Crown',
        draw: (ctx, colors) => {
          const p = colors.primary ?? '#c8a415'
          // Band
          fill(ctx, p, () => { ctx.roundRect(42, 28, 44, 14, 2) })
          // Points
          fill(ctx, p, () => {
            ctx.moveTo(46, 28); ctx.lineTo(50, 10); ctx.lineTo(54, 28)
            ctx.moveTo(60, 28); ctx.lineTo(64, 6); ctx.lineTo(68, 28)
            ctx.moveTo(74, 28); ctx.lineTo(78, 10); ctx.lineTo(82, 28)
          })
          // Gems
          fill(ctx, colors.secondary ?? '#cc3333', () => ellipse(ctx, 52, 21, 3, 4))
          fill(ctx, colors.secondary ?? '#cc3333', () => ellipse(ctx, 64, 17, 3, 4))
          fill(ctx, colors.secondary ?? '#cc3333', () => ellipse(ctx, 76, 21, 3, 4))
        },
      },
    ],
  },

  // ── Armor ─────────────────────────────────────────────────────────────────
  {
    key: 'armor',
    label: 'Armor',
    colorCount: 3,
    colorLabels: ['Primary', 'Secondary', 'Trim'],
    assets: [
      {
        id: 'armor-none',
        label: 'None',
        draw: (_ctx, _colors) => {},
      },
      {
        id: 'armor-light',
        label: 'Light',
        draw: (ctx, colors) => {
          const p = colors.primary ?? DEFAULT_ARMOR_P
          const s = colors.secondary ?? DEFAULT_ARMOR_S
          // Simple tabard
          fill(ctx, p, () => { ctx.roundRect(42, 82, 44, 50, 4) })
          // Center stripe
          fill(ctx, s, () => ctx.rect(60, 82, 8, 50))
          // Shoulders
          fill(ctx, s, () => { ctx.roundRect(28, 82, 18, 12, 4) })
          fill(ctx, s, () => { ctx.roundRect(82, 82, 18, 12, 4) })
        },
      },
      {
        id: 'armor-medium',
        label: 'Medium',
        draw: (ctx, colors) => {
          const p = colors.primary ?? DEFAULT_ARMOR_P
          const s = colors.secondary ?? DEFAULT_ARMOR_S
          const t = colors.tertiary ?? '#c8a415'
          // Chest plate
          fill(ctx, p, () => { ctx.roundRect(38, 80, 52, 56, 4) })
          // Pauldrons
          fill(ctx, s, () => { ctx.roundRect(22, 80, 20, 18, 6) })
          fill(ctx, s, () => { ctx.roundRect(86, 80, 20, 18, 6) })
          // Belt trim
          fill(ctx, t, () => ctx.rect(38, 130, 52, 6))
        },
      },
      {
        id: 'armor-heavy',
        label: 'Heavy Plate',
        draw: (ctx, colors) => {
          const p = colors.primary ?? DEFAULT_ARMOR_P
          const s = colors.secondary ?? DEFAULT_ARMOR_S
          const t = colors.tertiary ?? '#c8a415'
          // Full plate torso
          fill(ctx, p, () => { ctx.roundRect(36, 78, 56, 60, 4) })
          // Large pauldrons
          fill(ctx, s, () => { ctx.roundRect(18, 78, 24, 24, 6) })
          fill(ctx, s, () => { ctx.roundRect(86, 78, 24, 24, 6) })
          // Vambrace (forearm guards)
          fill(ctx, p, () => { ctx.roundRect(20, 110, 16, 26, 4) })
          fill(ctx, p, () => { ctx.roundRect(92, 110, 16, 26, 4) })
          // Gold trim
          fill(ctx, t, () => ctx.rect(36, 128, 56, 4))
          fill(ctx, t, () => ctx.rect(36, 80, 56, 4))
        },
      },
    ],
  },

  // ── Main Hand ─────────────────────────────────────────────────────────────
  {
    key: 'mainHand',
    label: 'Main Hand',
    colorCount: 0,
    colorLabels: [],
    assets: [
      {
        id: 'main-none',
        label: 'None',
        draw: (_ctx, _colors) => {},
      },
      {
        id: 'main-sword',
        label: 'Sword',
        draw: (ctx, _colors) => {
          // Blade
          fill(ctx, '#cccccc', () => { ctx.roundRect(100, 60, 8, 80, 2) })
          // Tip
          fill(ctx, '#cccccc', () => {
            ctx.moveTo(100, 60); ctx.lineTo(108, 60); ctx.lineTo(104, 44); ctx.closePath()
          })
          // Crossguard
          fill(ctx, '#888888', () => { ctx.roundRect(92, 136, 24, 8, 2) })
          // Grip
          fill(ctx, '#8b4513', () => { ctx.roundRect(101, 144, 6, 22, 2) })
          // Pommel
          fill(ctx, '#888888', () => ellipse(ctx, 104, 168, 6, 5))
        },
      },
      {
        id: 'main-staff',
        label: 'Staff',
        draw: (ctx, _colors) => {
          // Shaft
          fill(ctx, '#8b4513', () => { ctx.roundRect(101, 40, 7, 148, 3) })
          // Orb
          fill(ctx, '#4a90d9', () => ellipse(ctx, 104, 36, 12, 12))
          fill(ctx, 'rgba(255,255,255,0.4)', () => ellipse(ctx, 100, 32, 5, 5))
        },
      },
      {
        id: 'main-axe',
        label: 'Axe',
        draw: (ctx, _colors) => {
          // Handle
          fill(ctx, '#8b4513', () => { ctx.roundRect(101, 80, 6, 100, 2) })
          // Axe head
          fill(ctx, '#888888', () => {
            ctx.moveTo(100, 60); ctx.lineTo(122, 70); ctx.lineTo(118, 100); ctx.lineTo(100, 95); ctx.closePath()
          })
          fill(ctx, '#666666', () => {
            ctx.moveTo(102, 64); ctx.lineTo(108, 68); ctx.lineTo(106, 94); ctx.lineTo(102, 92); ctx.closePath()
          })
        },
      },
    ],
  },

  // ── Off Hand ──────────────────────────────────────────────────────────────
  {
    key: 'offHand',
    label: 'Off Hand',
    colorCount: 0,
    colorLabels: [],
    assets: [
      {
        id: 'off-none',
        label: 'None',
        draw: (_ctx, _colors) => {},
      },
      {
        id: 'off-shield',
        label: 'Shield',
        draw: (ctx, _colors) => {
          // Shield body
          fill(ctx, '#4a6fa5', () => {
            ctx.roundRect(4, 82, 30, 40, 4)
            ctx.moveTo(4, 120); ctx.lineTo(19, 138); ctx.lineTo(34, 120); ctx.closePath()
          })
          fill(ctx, '#2a3f5f', () => ctx.rect(18, 82, 3, 56))
          fill(ctx, '#c8a415', () => { ctx.roundRect(6, 84, 26, 4, 1) })
        },
      },
      {
        id: 'off-torch',
        label: 'Torch',
        draw: (ctx, _colors) => {
          // Handle
          fill(ctx, '#8b4513', () => { ctx.roundRect(15, 100, 7, 80, 2) })
          // Flame body
          fill(ctx, '#ff6600', () => ellipse(ctx, 18, 94, 8, 14))
          fill(ctx, '#ffcc00', () => ellipse(ctx, 18, 96, 5, 10))
          fill(ctx, '#ffffff', () => ellipse(ctx, 18, 98, 3, 6))
        },
      },
    ],
  },
]

// Compositor draw order (back to front)
export const COMPOSITOR_ORDER: SlotKey[] = [
  'ears', 'armor', 'offHand', 'face', 'hair', 'hats', 'mainHand',
]
```

- [ ] **Step 2: Create `apps/client/src/babylon/tokenCompositor.ts`**

```typescript
import { CANVAS_W, CANVAS_H, SLOT_DEFS, COMPOSITOR_ORDER, DEFAULT_SKIN, drawBodyBlank } from './tokenManifest'
import type { TokenDefinition, SlotKey, SlotColors } from '../types'

function getAssetDraw(slotKey: SlotKey, assetId: string): ((ctx: CanvasRenderingContext2D, colors: SlotColors) => void) | null {
  const slotDef = SLOT_DEFS.find((s) => s.key === slotKey)
  if (!slotDef) return null
  const asset = slotDef.assets.find((a) => a.id === assetId)
  return asset?.draw ?? null
}

export function compositeToken(definition: TokenDefinition): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')!

  const skinTone = definition.layers.face?.colors.primary ?? DEFAULT_SKIN

  // Base body
  drawBodyBlank(ctx, skinTone)

  // Layers in compositor order
  for (const slot of COMPOSITOR_ORDER) {
    const layer = definition.layers[slot]
    if (!layer) continue

    // Ears inherit skin from face
    const colors: SlotColors = slot === 'ears'
      ? { primary: skinTone }
      : layer.colors

    const draw = getAssetDraw(slot, layer.assetId)
    if (draw) draw(ctx, colors)
  }

  return canvas
}

export function compositeToDataUrl(definition: TokenDefinition): string {
  return compositeToken(definition).toDataURL('image/png')
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/babylon/tokenManifest.ts apps/client/src/babylon/tokenCompositor.ts
git commit -m "feat: token manifest (placeholder layers) and canvas compositor"
```

---

## Task 3: TokenBuilder UI Component

**Files:**
- Create: `apps/client/src/components/TokenBuilder.tsx`

- [ ] **Step 1: Create `apps/client/src/components/TokenBuilder.tsx`**

```typescript
import { useState } from 'react'
import { SLOT_DEFS, COLOR_PRESETS, compositeToken } from '../babylon/tokenManifest'
import { compositeToken as doComposite } from '../babylon/tokenCompositor'
import type { TokenDefinition, SlotKey, TokenLayerRef } from '../types'

// re-export compositeToken for thumbnails from the compositor, not the manifest
// (manifest has drawBodyBlank etc but compositor glues it together)

interface Props {
  definition: TokenDefinition
  onChange: (def: TokenDefinition) => void
  onSave: () => void
  onCancel: () => void
}

const BTN: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: 700,
}

function Thumbnail({ def, slot, assetId }: { def: TokenDefinition; slot: SlotKey; assetId: string }) {
  const previewDef: TokenDefinition = {
    ...def,
    layers: { ...def.layers, [slot]: { assetId, colors: def.layers[slot]?.colors ?? {} } },
  }
  const canvas = doComposite(previewDef)
  return (
    <canvas
      width={64}
      height={96}
      style={{ width: 64, height: 96, display: 'block' }}
      ref={(el) => {
        if (!el) return
        const ctx = el.getContext('2d')!
        ctx.clearRect(0, 0, 64, 96)
        ctx.drawImage(canvas, 0, 0, 64, 96)
      }}
    />
  )
}

export function TokenBuilder({ definition, onChange, onSave, onCancel }: Props) {
  const [activeSlot, setActiveSlot] = useState<SlotKey>(SLOT_DEFS[0].key)

  const slotDef = SLOT_DEFS.find((s) => s.key === activeSlot)!
  const currentLayer: TokenLayerRef | undefined = definition.layers[activeSlot]

  const selectVariant = (assetId: string) => {
    const existing = definition.layers[activeSlot]
    const updated: TokenLayerRef = { assetId, colors: existing?.colors ?? {} }
    onChange({ ...definition, layers: { ...definition.layers, [activeSlot]: updated } })
  }

  const setColor = (channel: 'primary' | 'secondary' | 'tertiary', color: string) => {
    const existing = definition.layers[activeSlot] ?? { assetId: slotDef.assets[0].id, colors: {} }
    const updated: TokenLayerRef = { ...existing, colors: { ...existing.colors, [channel]: color } }
    onChange({ ...definition, layers: { ...definition.layers, [activeSlot]: updated } })
  }

  const CHANNELS = ['primary', 'secondary', 'tertiary'] as const

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(10,12,10,0.97)', borderTop: '1px solid rgba(255,255,255,0.12)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Slot tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 8px' }}>
        {SLOT_DEFS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSlot(s.key)}
            style={{
              padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: 'transparent',
              color: activeSlot === s.key ? '#ffe033' : 'rgba(255,255,255,0.45)',
              borderBottom: activeSlot === s.key ? '2px solid #ffe033' : '2px solid transparent',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Variant picker row */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', overflowX: 'auto' }}>
        {slotDef.assets.map((asset) => {
          const selected = currentLayer?.assetId === asset.id ||
            (!currentLayer && asset.id === slotDef.assets[0].id)
          return (
            <div
              key={asset.id}
              onClick={() => selectVariant(asset.id)}
              style={{
                cursor: 'pointer', flexShrink: 0,
                border: selected ? '2px solid #ffe033' : '2px solid rgba(255,255,255,0.15)',
                borderRadius: 6, overflow: 'hidden', background: '#1a1e1a',
              }}
            >
              <Thumbnail def={definition} slot={activeSlot} assetId={asset.id} />
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '2px 0 4px' }}>
                {asset.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* Color swatches */}
      {slotDef.colorCount > 0 && (
        <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {CHANNELS.slice(0, slotDef.colorCount).map((channel, i) => (
            <div key={channel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', width: 52, flexShrink: 0 }}>
                {slotDef.colorLabels[i]}
              </span>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {COLOR_PRESETS.map((color) => {
                  const active = (currentLayer?.colors[channel] ?? null) === color
                  return (
                    <div
                      key={color}
                      onClick={() => setColor(channel, color)}
                      style={{
                        width: 18, height: 18, borderRadius: '50%', background: color,
                        cursor: 'pointer',
                        border: active ? '2px solid #fff' : '2px solid transparent',
                        boxSizing: 'border-box',
                        boxShadow: active ? '0 0 0 1px #ffe033' : undefined,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save / Cancel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px 12px' }}>
        <button onClick={onCancel} style={{ ...BTN, background: '#cc3333', color: '#fff' }}>Exit</button>
        <button onClick={onSave}   style={{ ...BTN, background: '#33aa44', color: '#fff' }}>Save</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/components/TokenBuilder.tsx
git commit -m "feat: TokenBuilder panel — tabs, variant picker, color swatches"
```

---

## Task 4: SpriteManager.updateTexture + Sprite Rendering for Custom Tokens

**Files:**
- Modify: `apps/client/src/babylon/sprites.ts`

- [ ] **Step 1: Modify `getTexture` to skip cache for data URLs**

In `apps/client/src/babylon/sprites.ts`, replace the existing `getTexture` method:

```typescript
private getTexture(path: string): Texture {
  if (path.startsWith('data:')) {
    const tex = new Texture(path, this.scene, false, true)
    tex.hasAlpha = true
    return tex
  }
  const cached = this.textureCache.get(path)
  if (cached) return cached
  const tex = new Texture(path, this.scene, false, true)
  this.textureCache.set(path, tex)
  return tex
}
```

- [ ] **Step 2: Add `updateTexture` method to `SpriteManager`**

Add after the `setZOrder` method (around line 199):

```typescript
updateTexture(instanceId: string, url: string): void {
  const mesh = this.meshes.get(instanceId)
  if (!mesh) return
  const mat = mesh.material as StandardMaterial
  const oldTex = mat.diffuseTexture
  const tex = new Texture(url, this.scene, false, true)
  tex.hasAlpha = true
  mat.diffuseTexture = tex
  oldTex?.dispose()

  const shadow = this.tokenShadows.get(instanceId)
  if (shadow && shadow.material instanceof StandardMaterial) {
    const sm = shadow.material as StandardMaterial
    const oldShadowTex = sm.diffuseTexture
    sm.diffuseTexture = new Texture(url, this.scene, false, true)
    oldShadowTex?.dispose()
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/babylon/sprites.ts
git commit -m "feat: SpriteManager.updateTexture for live token texture refresh"
```

---

## Task 5: Network Sync — host, guest, messages

**Files:**
- Modify: `apps/client/src/networking/messages.ts`
- Modify: `apps/client/src/networking/host.ts`
- Modify: `apps/client/src/networking/guest.ts`

- [ ] **Step 1: Add `sendTokenSnapshot` to `apps/client/src/networking/messages.ts`**

```typescript
import type { GameMessage, SpriteInstance, Player, BuildingTile, BuilderProp, Roof, TokenDefinition } from '../types'
// ... existing imports unchanged ...

export function sendTokenSnapshot(peer: PeerConnection, definitions: TokenDefinition[]): void {
  peer.sendReliable({ type: 'token:snapshot', definitions })
}
```

- [ ] **Step 2: Add `token:define` handler and snapshot to `apps/client/src/networking/host.ts`**

Add the import at the top:
```typescript
import { broadcastReliable, sendSnapshot, sendBuildingSnapshot, sendPropSnapshot, sendRoofSnapshot, sendTokenSnapshot } from './messages'
import { useTokenStore } from '../store/tokens'
```

In `handleGuestJoined.onConnected`, add snapshot call after `sendRoofSnapshot`:
```typescript
onConnected: () => {
  const { sprites } = useRoomStore.getState()
  const { players, localPlayer } = usePlayersStore.getState()
  sendSnapshot(peer, Object.values(sprites), [localPlayer, ...players])
  const { buildingTiles } = useRoomStore.getState()
  sendBuildingSnapshot(peer, Object.values(buildingTiles))
  const { builderProps, roofs } = useRoomStore.getState()
  sendPropSnapshot(peer, Object.values(builderProps))
  sendRoofSnapshot(peer, Object.values(roofs))
  sendTokenSnapshot(peer, Object.values(useTokenStore.getState().definitions))
},
```

Also add to `handleReconnect` after `sendRoofSnapshot`:
```typescript
sendTokenSnapshot(peer, Object.values(useTokenStore.getState().definitions))
```

Add `token:define` case in `handleMessage` switch (after `player:join`):
```typescript
case 'token:define': {
  useTokenStore.getState().addOrUpdate(msg.definition)
  break
}
```

The relay loop at the bottom of `handleMessage` already relays all reliable messages to other peers, so `token:define` is automatically forwarded.

- [ ] **Step 3: Add handlers to `apps/client/src/networking/guest.ts`**

Add import at top:
```typescript
import { useTokenStore } from '../store/tokens'
import { compositeToDataUrl } from '../babylon/tokenCompositor'
```

Modify the `sprite:place` case to composite when `definitionId` is present:
```typescript
case 'sprite:place': {
  const instance = {
    instanceId: msg.instanceId, spriteId: msg.spriteId,
    col: msg.col, row: msg.row, placedBy: msg.placedBy,
    zOrder: msg.zOrder, definitionId: msg.definitionId,
  }
  roomStore.placeSprite(instance)
  const url = msg.definitionId
    ? compositeToDataUrl(useTokenStore.getState().definitions[msg.definitionId] ?? { definitionId: msg.definitionId, ownedBy: msg.placedBy, layers: {} })
    : `/assets/sprites/${msg.spriteId}.svg`
  this.spriteManager.place(instance, url)
  break
}
```

Add `token:define` and `token:snapshot` cases in `handleMessage`:
```typescript
case 'token:define': {
  useTokenStore.getState().addOrUpdate(msg.definition)
  // Update texture for any sprites using this definition
  for (const [, s] of Object.entries(roomStore.sprites)) {
    if (s.definitionId === msg.definition.definitionId) {
      const url = compositeToDataUrl(msg.definition)
      this.spriteManager.updateTexture(s.instanceId, url)
    }
  }
  break
}
case 'token:snapshot': {
  useTokenStore.getState().loadSnapshot(msg.definitions)
  break
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/networking/messages.ts apps/client/src/networking/host.ts apps/client/src/networking/guest.ts
git commit -m "feat: token:define and token:snapshot network messages"
```

---

## Task 6: RoomPage Wiring — New Token Flow, Camera Zoom, Builder UI

**Files:**
- Modify: `apps/client/src/pages/RoomPage.tsx`
- Modify: `apps/client/src/components/Sidebar.tsx`
- Modify: `apps/client/src/components/token-menu/TokenMenu.tsx`

- [ ] **Step 1: Add imports and state to `RoomPage.tsx`**

Add imports at the top:
```typescript
import { TokenBuilder } from '../components/TokenBuilder'
import { compositeToDataUrl } from '../babylon/tokenCompositor'
import { useTokenStore } from '../store/tokens'
import type { ArcRotateCamera } from '@babylonjs/core'
import type { TokenDefinition } from '../types'
```

Add refs and state in the component body (after `const roofModeRef = useRef(false)`):
```typescript
const cameraRef = useRef<ArcRotateCamera | null>(null)
const [builderOpen, setBuilderOpen] = useState(false)
const [builderInstanceId, setBuilderInstanceId] = useState<string | null>(null)
const [builderDefinition, setBuilderDefinition] = useState<TokenDefinition | null>(null)
const [builderOriginalDef, setBuilderOriginalDef] = useState<TokenDefinition | null>(null)
```

- [ ] **Step 2: Expose `cameraRef` inside the main `useEffect`**

Immediately after `const { engine, scene, camera, ambientLight } = createScene(canvasRef.current)`, add:
```typescript
cameraRef.current = camera
```

- [ ] **Step 3: Add camera zoom helpers in the component body (after `const dispatchMsg = ...`)**

```typescript
const zoomToCell = (col: number, row: number) => {
  const camera = cameraRef.current
  if (!camera) return
  const { x, z } = cellToWorld(col, row)
  camera.target.set(x, 0, z)
  camera.radius = 10
}

const resetCameraZoom = () => {
  const camera = cameraRef.current
  if (!camera) return
  camera.target.set(0, 0, 0)
  camera.radius = 24
}
```

Note: `cellToWorld` is already imported from `'../babylon/grid'`.

- [ ] **Step 4: Add `openBuilder` helper**

```typescript
const openBuilder = (instanceId: string, definition: TokenDefinition) => {
  const sprite = useRoomStore.getState().sprites[instanceId]
  setBuilderInstanceId(instanceId)
  setBuilderDefinition(definition)
  setBuilderOriginalDef(definition)
  setBuilderOpen(true)
  if (sprite) zoomToCell(sprite.col, sprite.row)
}
```

- [ ] **Step 5: Add `handleNewToken` — called by Sidebar "New Token" button**

```typescript
const handleNewToken = () => {
  const { localPlayer } = usePlayersStore.getState()
  const definitionId = nanoid()
  const definition: TokenDefinition = { definitionId, ownedBy: localPlayer.playerId, layers: {} }
  const instanceId = nanoid()
  const { sprites } = useRoomStore.getState()
  const col = 0, row = 0   // center of grid; host can drag after saving
  const zOrder = Object.values(sprites).filter((s) => s.col === col && s.row === row).length
  const instance = { instanceId, spriteId: 'custom', col, row, placedBy: localPlayer.playerId, zOrder, definitionId }
  const url = compositeToDataUrl(definition)
  useRoomStore.getState().placeSprite(instance)
  spriteManagerRef.current?.place(instance, url)
  useTokenStore.getState().addOrUpdate(definition)
  dispatchMsg({ type: 'token:define', definition })
  dispatchMsg({ type: 'sprite:place', ...instance })
  openBuilder(instanceId, definition)
}
```

- [ ] **Step 6: Add `handleBuilderChange`, `handleBuilderSave`, `handleBuilderCancel`**

```typescript
const handleBuilderChange = (newDef: TokenDefinition) => {
  setBuilderDefinition(newDef)
  if (!builderInstanceId) return
  const url = compositeToDataUrl(newDef)
  spriteManagerRef.current?.updateTexture(builderInstanceId, url)
}

const handleBuilderSave = () => {
  if (!builderDefinition || !builderInstanceId) return
  useTokenStore.getState().addOrUpdate(builderDefinition)
  dispatchMsg({ type: 'token:define', definition: builderDefinition })
  setBuilderOpen(false)
  setBuilderInstanceId(null)
  setBuilderDefinition(null)
  setBuilderOriginalDef(null)
  resetCameraZoom()
}

const handleBuilderCancel = () => {
  if (builderOriginalDef && builderInstanceId) {
    // Restore original texture
    const url = compositeToDataUrl(builderOriginalDef)
    spriteManagerRef.current?.updateTexture(builderInstanceId, url)
  }
  setBuilderOpen(false)
  setBuilderInstanceId(null)
  setBuilderDefinition(null)
  setBuilderOriginalDef(null)
  resetCameraZoom()
}
```

- [ ] **Step 7: Add `TokenBuilder` to JSX**

After the `{propStackBadge && ...}` block, add:
```tsx
{builderOpen && builderDefinition && (
  <TokenBuilder
    definition={builderDefinition}
    onChange={handleBuilderChange}
    onSave={handleBuilderSave}
    onCancel={handleBuilderCancel}
  />
)}
```

- [ ] **Step 8: Add "New Token" button to `Sidebar.tsx`**

`Sidebar.tsx` needs a new prop `onNewToken: () => void`. Add it to the interface:
```typescript
interface Props {
  // ... existing props ...
  onNewToken: () => void
}
```

Destructure it:
```typescript
export function Sidebar({ ..., onNewToken }: Props) {
```

In the tokens tab panel section, add the button above `SpritePicker`:
```tsx
{activeTab === 'tokens' && (
  <>
    <div style={{ padding: '10px 10px 0' }}>
      <button
        onClick={onNewToken}
        style={{
          width: '100%', padding: '8px 0', borderRadius: 6, border: 'none',
          background: 'rgba(51,170,68,0.85)', color: '#fff', fontSize: 12,
          fontWeight: 700, cursor: 'pointer',
        }}
      >
        + New Token
      </button>
    </div>
    <SpritePicker
      selectedSpriteId={selectedSpriteId}
      onSelect={onSpriteSelect}
      onDeselect={onSpriteDeselect}
      activeWeather={activeWeather}
      onWeatherChange={onWeatherChange}
      activeBackground={activeBackground}
      onBackgroundChange={onBackgroundChange}
    />
  </>
)}
```

Wire it in `RoomPage.tsx` — add `onNewToken={handleNewToken}` to the `<Sidebar>` element.

- [ ] **Step 9: Add "Edit Token" to `TokenMenu.tsx`**

Add prop:
```typescript
interface Props {
  // ... existing ...
  onEditToken?: () => void
}
```

Add a button in the JSX (before or after the remove button):
```tsx
{onEditToken && (
  <button
    onClick={onEditToken}
    style={{ padding: '6px 14px', borderRadius: 5, border: 'none', background: 'rgba(74,144,217,0.8)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
  >
    Edit Token
  </button>
)}
```

In `RoomPage.tsx`, add `onEditToken` to the `<TokenMenu>` element:
```tsx
onEditToken={
  activeSprite?.definitionId
    ? () => {
        const def = useTokenStore.getState().definitions[activeSprite.definitionId!]
        if (def) { setTokenMenu(null); openBuilder(tokenMenu!.instanceId, def) }
      }
    : undefined
}
```

- [ ] **Step 10: Run type check**

```bash
cd apps/client && npx tsc --noEmit 2>&1 | grep -v "signaling\|buildings.ts"
```

Expected: no output (no errors from new code).

- [ ] **Step 11: Commit**

```bash
git add apps/client/src/pages/RoomPage.tsx apps/client/src/components/Sidebar.tsx apps/client/src/components/token-menu/TokenMenu.tsx
git commit -m "feat: token builder wired — new token flow, camera zoom, save/cancel, edit from menu"
```

---

## Self-Review

**Spec coverage check:**
- ✅ 7 slots (face, ears, hair, hats, armor, mainHand, offHand) — all in `SLOT_DEFS`
- ✅ Per-slot colors (face=2, ears=0, hair=1, hats=2, armor=3, hand slots=0)
- ✅ Skin tone shared: compositor passes `face.colors.primary` as ears primary, `drawBodyBlank` uses it
- ✅ Slot optionality: every slot has `assets[0]` as "none" option
- ✅ Stored as layer references + recomposited on each client
- ✅ Camera zooms to token on builder open, resets on save/cancel
- ✅ All players can build — `handleNewToken` available to all (not host-gated)
- ✅ Edit existing token from token menu (`onEditToken` prop)
- ✅ Network sync: `token:define` broadcast on save and on guest join snapshot
- ✅ No pedestal slot

**Placeholder scan:** No TBDs, no missing code, no "similar to Task N" shortcuts.

**Type consistency:** `TokenDefinition`, `SlotKey`, `TokenLayerRef`, `SlotColors` defined in Task 1 and used identically in Tasks 2–6. `compositeToDataUrl(def)` defined in Task 2 and called in Tasks 5 and 6. `updateTexture(instanceId, url)` defined in Task 4 and called in Tasks 5 and 6.
