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
  draw: (ctx: CanvasRenderingContext2D, colors: SlotColors) => void
}

export interface SlotDef {
  key: SlotKey
  label: string
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

export function drawBodyBlank(ctx: CanvasRenderingContext2D, skinTone: string): void {
  const s = skinTone
  fill(ctx, s, () => ellipse(ctx, 64, 48, 24, 28))
  fill(ctx, s, () => ctx.rect(56, 72, 16, 10))
  fill(ctx, s, () => { ctx.roundRect(38, 80, 52, 56, 4) })
  fill(ctx, s, () => { ctx.roundRect(20, 82, 18, 46, 6) })
  fill(ctx, s, () => { ctx.roundRect(90, 82, 18, 46, 6) })
  fill(ctx, s, () => { ctx.roundRect(22, 124, 14, 30, 5) })
  fill(ctx, s, () => { ctx.roundRect(92, 124, 14, 30, 5) })
  fill(ctx, s, () => ellipse(ctx, 29, 157, 9, 7))
  fill(ctx, s, () => ellipse(ctx, 99, 157, 9, 7))
  fill(ctx, s, () => { ctx.roundRect(42, 134, 20, 48, 5) })
  fill(ctx, s, () => { ctx.roundRect(66, 134, 20, 48, 5) })
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
        draw: (_ctx, _colors) => {},
      },
      {
        id: 'face-round',
        label: 'Round',
        draw: (ctx, colors) => {
          const eye = colors.secondary ?? DEFAULT_EYE
          fill(ctx, eye, () => ellipse(ctx, 55, 45, 5, 5))
          fill(ctx, eye, () => ellipse(ctx, 73, 45, 5, 5))
          fill(ctx, 'rgba(255,255,255,0.5)', () => ellipse(ctx, 57, 43, 2, 2))
          fill(ctx, 'rgba(255,255,255,0.5)', () => ellipse(ctx, 75, 43, 2, 2))
          fill(ctx, colors.primary ?? DEFAULT_SKIN, () => ellipse(ctx, 64, 54, 3, 2))
        },
      },
      {
        id: 'face-stern',
        label: 'Stern',
        draw: (ctx, colors) => {
          const eye = colors.secondary ?? DEFAULT_EYE
          ctx.strokeStyle = eye
          ctx.lineWidth = 2
          ctx.beginPath(); ctx.moveTo(49, 38); ctx.lineTo(61, 41); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(79, 38); ctx.lineTo(67, 41); ctx.stroke()
          fill(ctx, eye, () => { ctx.roundRect(50, 44, 12, 4, 2) })
          fill(ctx, eye, () => { ctx.roundRect(66, 44, 12, 4, 2) })
        },
      },
    ],
  },

  // ── Ears ──────────────────────────────────────────────────────────────────
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
          fill(ctx, s, () => {
            ctx.moveTo(39, 58); ctx.lineTo(33, 36); ctx.lineTo(46, 50); ctx.closePath()
          })
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
          fill(ctx, c, () => { ctx.roundRect(32, 30, 16, 52, 6) })
          fill(ctx, c, () => { ctx.roundRect(80, 30, 16, 52, 6) })
        },
      },
      {
        id: 'hair-messy',
        label: 'Messy',
        draw: (ctx, colors) => {
          const c = colors.primary ?? DEFAULT_HAIR
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
          fill(ctx, colors.secondary ?? '#6a3300', () => { ctx.roundRect(38, 34, 52, 6, 3) })
        },
      },
      {
        id: 'hats-wide',
        label: 'Wide Brim',
        draw: (ctx, colors) => {
          const p = colors.primary ?? '#884400'
          fill(ctx, p, () => { ctx.roundRect(48, 8, 32, 26, [10, 10, 0, 0]) })
          fill(ctx, colors.secondary ?? '#6a3300', () => { ctx.roundRect(22, 32, 84, 7, 3) })
        },
      },
      {
        id: 'hats-crown',
        label: 'Crown',
        draw: (ctx, colors) => {
          const p = colors.primary ?? '#c8a415'
          fill(ctx, p, () => { ctx.roundRect(42, 28, 44, 14, 2) })
          fill(ctx, p, () => { ctx.moveTo(46, 28); ctx.lineTo(50, 10); ctx.lineTo(54, 28); ctx.closePath() })
          fill(ctx, p, () => { ctx.moveTo(60, 28); ctx.lineTo(64, 6); ctx.lineTo(68, 28); ctx.closePath() })
          fill(ctx, p, () => { ctx.moveTo(74, 28); ctx.lineTo(78, 10); ctx.lineTo(82, 28); ctx.closePath() })
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
          fill(ctx, p, () => { ctx.roundRect(42, 82, 44, 50, 4) })
          fill(ctx, s, () => ctx.rect(60, 82, 8, 50))
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
          fill(ctx, p, () => { ctx.roundRect(38, 80, 52, 56, 4) })
          fill(ctx, s, () => { ctx.roundRect(22, 80, 20, 18, 6) })
          fill(ctx, s, () => { ctx.roundRect(86, 80, 20, 18, 6) })
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
          fill(ctx, p, () => { ctx.roundRect(36, 78, 56, 60, 4) })
          fill(ctx, s, () => { ctx.roundRect(18, 78, 24, 24, 6) })
          fill(ctx, s, () => { ctx.roundRect(86, 78, 24, 24, 6) })
          fill(ctx, p, () => { ctx.roundRect(20, 110, 16, 26, 4) })
          fill(ctx, p, () => { ctx.roundRect(92, 110, 16, 26, 4) })
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
          fill(ctx, '#cccccc', () => { ctx.roundRect(100, 60, 8, 80, 2) })
          fill(ctx, '#cccccc', () => {
            ctx.moveTo(100, 60); ctx.lineTo(108, 60); ctx.lineTo(104, 44); ctx.closePath()
          })
          fill(ctx, '#888888', () => { ctx.roundRect(92, 136, 24, 8, 2) })
          fill(ctx, '#8b4513', () => { ctx.roundRect(101, 144, 6, 22, 2) })
          fill(ctx, '#888888', () => ellipse(ctx, 104, 168, 6, 5))
        },
      },
      {
        id: 'main-staff',
        label: 'Staff',
        draw: (ctx, _colors) => {
          fill(ctx, '#8b4513', () => { ctx.roundRect(101, 40, 7, 148, 3) })
          fill(ctx, '#4a90d9', () => ellipse(ctx, 104, 36, 12, 12))
          fill(ctx, 'rgba(255,255,255,0.4)', () => ellipse(ctx, 100, 32, 5, 5))
        },
      },
      {
        id: 'main-axe',
        label: 'Axe',
        draw: (ctx, _colors) => {
          fill(ctx, '#8b4513', () => { ctx.roundRect(101, 80, 6, 100, 2) })
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
          fill(ctx, '#4a6fa5', () => { ctx.roundRect(4, 82, 30, 40, 4) })
          fill(ctx, '#4a6fa5', () => { ctx.moveTo(4, 120); ctx.lineTo(19, 138); ctx.lineTo(34, 120); ctx.closePath() })
          fill(ctx, '#2a3f5f', () => ctx.rect(18, 82, 3, 56))
          fill(ctx, '#c8a415', () => { ctx.roundRect(6, 84, 26, 4, 1) })
        },
      },
      {
        id: 'off-torch',
        label: 'Torch',
        draw: (ctx, _colors) => {
          fill(ctx, '#8b4513', () => { ctx.roundRect(15, 100, 7, 80, 2) })
          fill(ctx, '#ff6600', () => ellipse(ctx, 18, 94, 8, 14))
          fill(ctx, '#ffcc00', () => ellipse(ctx, 18, 96, 5, 10))
          fill(ctx, '#ffffff', () => ellipse(ctx, 18, 98, 3, 6))
        },
      },
    ],
  },
]

export const COMPOSITOR_ORDER: SlotKey[] = [
  'ears', 'armor', 'offHand', 'face', 'hair', 'hats', 'mainHand',
]
