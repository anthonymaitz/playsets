import { createSignal } from 'solid-js'
import type { LayerBackgroundManager } from '../babylon/layers'
import type { LayerBackground } from '../types'

const LAYER_COUNT = 9

interface LayerState { visible: boolean; background: LayerBackground }

interface Props {
  activeLayerIndex: number
  onSelectLayer: (i: number) => void
  layerManager: LayerBackgroundManager
}

export function LayerPanel(props: Props) {
  const init = (): LayerState[] =>
    Array.from({ length: LAYER_COUNT + 1 }, () => ({ visible: true, background: 'transparent' as LayerBackground }))

  const [layers, setLayers] = createSignal<LayerState[]>(init())
  const [bgPickerFor, setBgPickerFor] = createSignal<number | null>(null)

  function toggleVisible(layerIndex: number) {
    const next = [...layers()]
    next[layerIndex] = { ...next[layerIndex], visible: !next[layerIndex].visible }
    setLayers(next)
    props.layerManager.setVisible(layerIndex, next[layerIndex].visible)
  }

  function setBackground(layerIndex: number, bg: LayerBackground) {
    const next = [...layers()]
    next[layerIndex] = { ...next[layerIndex], background: bg }
    setLayers(next)
    props.layerManager.updateLayer(layerIndex, { background: bg })
    setBgPickerFor(null)
  }

  function handleCubeClick(layerIndex: number) {
    if (layerIndex === props.activeLayerIndex) {
      toggleVisible(layerIndex)
    } else {
      props.onSelectLayer(layerIndex)
      setBgPickerFor(null)
    }
  }

  const indices = Array.from({ length: LAYER_COUNT }, (_, i) => LAYER_COUNT - i)

  return (
    <div style="position:absolute;right:0;top:0;bottom:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px 6px;background:rgba(8,12,8,0.85);border-left:1px solid rgba(255,255,255,0.08);width:56px;pointer-events:auto;">
      {indices.map(layerIndex => {
        const cfg = () => layers()[layerIndex] ?? { background: 'transparent' as LayerBackground, visible: true }
        const isActive = () => layerIndex === props.activeLayerIndex

        return (
          <div style="position:relative;">
            <button
              onClick={() => handleCubeClick(layerIndex)}
              title={`Layer ${layerIndex}${layerIndex === 5 ? ' (Ground)' : ''}${isActive() ? ' — click to toggle visibility' : ' — click to select'}`}
              style="background:none;border:none;cursor:pointer;padding:0;display:block;position:relative;"
            >
              <LayerCube
                layerIndex={layerIndex}
                bg={cfg().background}
                visible={cfg().visible}
                active={isActive()}
              />
              {/* Visibility overlay: eye-slash when hidden */}
              {!cfg().visible && (
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
                  <span style="font-size:13px;line-height:1;filter:drop-shadow(0 0 2px #000);">🚫</span>
                </div>
              )}
            </button>

            {/* Gear: opens background picker for active layer */}
            {isActive() && (
              <button
                onClick={() => setBgPickerFor(bgPickerFor() === layerIndex ? null : layerIndex)}
                title="Set background"
                style="position:absolute;left:-20px;top:4px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:3px;color:rgba(255,255,255,0.5);font-size:9px;cursor:pointer;padding:1px 3px;line-height:1;"
              >
                ⚙
              </button>
            )}

            {/* Background picker dropdown */}
            {bgPickerFor() === layerIndex && (
              <div style="position:absolute;right:58px;top:0;background:rgba(10,15,10,0.96);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:6px;display:flex;flex-direction:column;gap:4px;z-index:30;min-width:100px;">
                {(['transparent', 'grass', 'dirt'] as LayerBackground[]).map(bg => (
                  <button
                    onClick={() => setBackground(layerIndex, bg)}
                    style={`background:${cfg().background === bg ? 'rgba(240,168,74,0.2)' : 'rgba(255,255,255,0.04)'};border:1px solid ${cfg().background === bg ? '#f0a84a' : 'rgba(255,255,255,0.1)'};border-radius:4px;color:${cfg().background === bg ? '#f0a84a' : 'rgba(255,255,255,0.6)'};cursor:pointer;font-size:10px;padding:4px 8px;text-align:left;`}
                  >
                    {bg === 'transparent' ? '✕ None' : bg === 'grass' ? '🌿 Grass' : '🟫 Dirt'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Legend */}
      <div style="margin-top:4px;font-size:8px;color:rgba(255,255,255,0.25);text-align:center;line-height:1.3;">
        Click active<br/>= toggle vis
      </div>
    </div>
  )
}

function LayerCube(p: { layerIndex: number; bg: LayerBackground; visible: boolean; active: boolean }) {
  const W = 36, H = 28
  const topColor = p.bg === 'grass' ? '#4a8a3a' : p.bg === 'dirt' ? '#5a3a1a' : 'rgba(255,255,255,0.07)'
  const leftColor = p.bg === 'grass' ? '#3a6e2a' : p.bg === 'dirt' ? '#3a2010' : 'rgba(255,255,255,0.04)'
  const rightColor = p.bg === 'grass' ? '#2d5a20' : p.bg === 'dirt' ? '#2e1a0c' : 'rgba(255,255,255,0.06)'
  // Active = orange border. Hidden = red border. Normal = dim white.
  const stroke = p.active ? '#f0a84a' : !p.visible ? '#cc4444' : 'rgba(255,255,255,0.2)'
  const strokeW = p.active ? 2 : 1
  const alpha = p.visible ? 1 : 0.25

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polygon
        points={`${W/2},3 ${W-2},${H/2-2} ${W/2},${H-4} 2,${H/2-2}`}
        fill={topColor} stroke={stroke} stroke-width={strokeW}
        fill-opacity={alpha}
      />
      <polygon
        points={`2,${H/2-2} ${W/2},${H-4} ${W/2},${H+6} 2,${H/2+6}`}
        fill={leftColor} stroke={stroke} stroke-width={strokeW}
        fill-opacity={alpha}
      />
      <polygon
        points={`${W-2},${H/2-2} ${W/2},${H-4} ${W/2},${H+6} ${W-2},${H/2+6}`}
        fill={rightColor} stroke={stroke} stroke-width={strokeW}
        fill-opacity={alpha}
      />
      {/* Show layer number on active layer or when it has a non-transparent background */}
      {(p.active || p.bg !== 'transparent') && (
        <text x={W/2} y={H/2+1} font-size={7}
          fill={p.active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)'}
          text-anchor="middle" font-family="monospace">
          {p.layerIndex}
        </text>
      )}
    </svg>
  )
}
