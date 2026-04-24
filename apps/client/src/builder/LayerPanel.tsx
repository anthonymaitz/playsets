import { createSignal } from 'solid-js'
import type { LayerBackgroundManager } from '../babylon/layers'
import type { LayerBackground } from '../types'

interface Props {
  weather: string
  onWeatherChange: (w: string) => void
  layerManager: LayerBackgroundManager
}

const WEATHER_OPTIONS = ['sunny', 'cloudy', 'night', 'rain']
const BG_OPTIONS: LayerBackground[] = ['transparent', 'grass', 'dirt']
const LAYER_COUNT = 9

export function LayerPanel(props: Props) {
  const [layerVisibility, setLayerVisibility] = createSignal<boolean[]>(Array(LAYER_COUNT).fill(true))
  const [layerBg, setLayerBg] = createSignal<LayerBackground[]>(Array(LAYER_COUNT).fill('transparent' as LayerBackground))

  function toggleLayer(i: number) {
    const next = [...layerVisibility()]
    next[i] = !next[i]
    setLayerVisibility(next)
    props.layerManager.setVisible(i + 1, next[i])
  }

  function changeBackground(i: number, bg: LayerBackground) {
    const next = [...layerBg()]
    next[i] = bg
    setLayerBg(next)
    props.layerManager.updateLayer(i + 1, { background: bg })
  }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: '160px', right: 0,
      background: 'rgba(20,20,20,0.88)', padding: '8px', display: 'flex',
      gap: '12px', alignItems: 'center', pointerEvents: 'all', zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: '#aaa', fontSize: '11px' }}>Weather:</span>
        <select
          value={props.weather}
          onChange={e => props.onWeatherChange(e.currentTarget.value)}
          style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '2px 4px', fontSize: '11px' }}
        >
          {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', flex: 1 }}>
        {Array.from({ length: LAYER_COUNT }, (_, i) => i).map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ color: '#888', fontSize: '9px' }}>L{i + 1}</span>
            <input
              type="checkbox"
              checked={layerVisibility()[i]}
              onChange={() => toggleLayer(i)}
            />
            <select
              value={layerBg()[i]}
              onChange={e => changeBackground(i, e.currentTarget.value as LayerBackground)}
              style={{ background: '#333', color: '#fff', border: '1px solid #555', fontSize: '9px', width: '52px' }}
            >
              {BG_OPTIONS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
