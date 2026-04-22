import { useState } from 'react'
import type { LayerBackground, LayerConfig } from '../types'

const LAYER_COUNT = 9

interface Props {
  isHost: boolean
  layers: Record<number, LayerConfig>
  activeLayerIndex: number
  onSelectLayer: (layerIndex: number) => void
  onToggleVisible: (layerIndex: number) => void
  onSetBackground: (layerIndex: number, bg: LayerBackground) => void
}

export function LayerPanel({ isHost, layers, activeLayerIndex, onSelectLayer, onToggleVisible, onSetBackground }: Props) {
  const [bgPickerFor, setBgPickerFor] = useState<number | null>(null)

  const handleCubeClick = (layerIndex: number) => {
    if (layerIndex === activeLayerIndex) {
      if (isHost) onToggleVisible(layerIndex)
    } else {
      onSelectLayer(layerIndex)
      setBgPickerFor(null)
    }
  }

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 4, padding: '8px 6px',
      background: 'rgba(8,12,8,0.85)', borderLeft: '1px solid rgba(255,255,255,0.08)',
      width: 52,
    }}>
      {Array.from({ length: LAYER_COUNT }, (_, i) => LAYER_COUNT - i).map((layerIndex) => {
        const cfg = layers[layerIndex] ?? { background: 'transparent', visible: true }
        const isActive = layerIndex === activeLayerIndex
        return (
          <div key={layerIndex} style={{ position: 'relative' }}>
            <button
              onClick={() => handleCubeClick(layerIndex)}
              title={`Layer ${layerIndex}${layerIndex === 5 ? ' (Ground)' : ''}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block' }}
            >
              <LayerCube
                layerIndex={layerIndex}
                bg={cfg.background}
                visible={cfg.visible}
                active={isActive}
              />
            </button>
            {isHost && isActive && (
              <button
                onClick={() => setBgPickerFor(bgPickerFor === layerIndex ? null : layerIndex)}
                title="Set background"
                style={{
                  position: 'absolute', right: -16, top: 4,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 3, color: 'rgba(255,255,255,0.5)', fontSize: 9,
                  cursor: 'pointer', padding: '1px 3px', lineHeight: 1,
                }}
              >
                ⚙
              </button>
            )}
            {bgPickerFor === layerIndex && isHost && (
              <div style={{
                position: 'absolute', right: 52, top: 0,
                background: 'rgba(10,15,10,0.96)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, padding: 6, display: 'flex', flexDirection: 'column', gap: 4,
                zIndex: 20, minWidth: 100,
              }}>
                {(['transparent', 'grass', 'dirt'] as LayerBackground[]).map((bg) => (
                  <button
                    key={bg}
                    onClick={() => { onSetBackground(layerIndex, bg); setBgPickerFor(null) }}
                    style={{
                      background: cfg.background === bg ? 'rgba(240,168,74,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${cfg.background === bg ? '#f0a84a' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 4, color: cfg.background === bg ? '#f0a84a' : 'rgba(255,255,255,0.6)',
                      cursor: 'pointer', fontSize: 10, padding: '4px 8px', textAlign: 'left',
                    }}
                  >
                    {bg === 'transparent' ? '✕ None' : bg === 'grass' ? '🌿 Grass' : '🟫 Dirt'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LayerCube({ layerIndex, bg, visible, active }: {
  layerIndex: number; bg: LayerBackground; visible: boolean; active: boolean
}) {
  const W = 36, H = 28
  const topColor = bg === 'grass' ? '#4a8a3a' : bg === 'dirt' ? '#5a3a1a' : 'rgba(255,255,255,0.07)'
  const leftColor = bg === 'grass' ? '#3a6e2a' : bg === 'dirt' ? '#3a2010' : 'rgba(255,255,255,0.04)'
  const rightColor = bg === 'grass' ? '#2d5a20' : bg === 'dirt' ? '#2e1a0c' : 'rgba(255,255,255,0.06)'
  const stroke = active ? '#f0a84a' : 'rgba(255,255,255,0.2)'
  const strokeW = active ? 2 : 1
  const dashArray = visible ? undefined : '3,2'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* top face */}
      <polygon
        points={`${W / 2},3 ${W - 2},${H / 2 - 2} ${W / 2},${H - 4} 2,${H / 2 - 2}`}
        fill={topColor}
        stroke={stroke}
        strokeWidth={strokeW}
        strokeDasharray={dashArray}
        fillOpacity={visible ? 1 : 0.3}
      />
      {/* left face */}
      <polygon
        points={`2,${H / 2 - 2} ${W / 2},${H - 4} ${W / 2},${H + 6} 2,${H / 2 + 6}`}
        fill={leftColor}
        stroke={stroke}
        strokeWidth={strokeW}
        strokeDasharray={dashArray}
        fillOpacity={visible ? 1 : 0.2}
      />
      {/* right face */}
      <polygon
        points={`${W - 2},${H / 2 - 2} ${W / 2},${H - 4} ${W / 2},${H + 6} ${W - 2},${H / 2 + 6}`}
        fill={rightColor}
        stroke={stroke}
        strokeWidth={strokeW}
        strokeDasharray={dashArray}
        fillOpacity={visible ? 1 : 0.2}
      />
      {!visible && (
        <text x={W / 2} y={H / 2 + 1} fontSize={7} fill="rgba(255,255,255,0.3)" textAnchor="middle" fontFamily="monospace">
          {layerIndex}
        </text>
      )}
      {active && visible && (
        <text x={W / 2} y={H / 2 + 1} fontSize={7} fill="rgba(255,255,255,0.7)" textAnchor="middle" fontFamily="monospace">
          {layerIndex}
        </text>
      )}
    </svg>
  )
}
