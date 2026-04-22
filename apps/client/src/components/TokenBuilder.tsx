import { useState } from 'react'
import type React from 'react'
import { SLOT_DEFS, COLOR_PRESETS } from '../babylon/tokenManifest'
import { compositeToDataUrl } from '../babylon/tokenCompositor'
import type { TokenDefinition, SlotKey, TokenLayerRef } from '../types'

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

const CHANNELS = ['primary', 'secondary', 'tertiary'] as const

function Thumbnail({ def, slot, assetId }: { def: TokenDefinition; slot: SlotKey; assetId: string }) {
  const previewDef: TokenDefinition = {
    ...def,
    layers: { ...def.layers, [slot]: { assetId, colors: def.layers[slot]?.colors ?? {} } },
  }
  return <img src={compositeToDataUrl(previewDef)} width={64} height={96} style={{ display: 'block' }} alt="" />
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
