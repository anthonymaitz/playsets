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

  drawBodyBlank(ctx, skinTone)

  for (const slot of COMPOSITOR_ORDER) {
    const layer = definition.layers[slot]
    if (!layer) continue

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
