import { useEffect, useState } from 'react'
import type { BackgroundType, SpriteCategory, SpriteManifest, SpriteManifestEntry, WeatherType } from '../types'

interface Props {
  selectedSpriteId: string | null
  onSelect: (sprite: SpriteManifestEntry) => void
  onDeselect: () => void
  activeWeather: WeatherType
  onWeatherChange: (w: WeatherType) => void
  activeBackground: BackgroundType
  onBackgroundChange: (b: BackgroundType) => void
}

const WEATHERS: { id: WeatherType; label: string }[] = [
  { id: 'sunny',  label: '☀️ Sunny'  },
  { id: 'cloudy', label: '⛅ Clouds' },
  { id: 'night',  label: '🌙 Night'  },
  { id: 'rain',   label: '🌧️ Rain'   },
]

const BACKGROUNDS: { id: BackgroundType; label: string }[] = [
  { id: 'grass', label: '🌿 Grass' },
  { id: 'stars', label: '✨ Stars' },
  { id: 'ocean', label: '🌊 Ocean' },
  { id: 'snow',  label: '❄️ Snow'  },
  { id: 'lava',  label: '🔥 Lava'  },
]

export function SpritePicker({ selectedSpriteId, onSelect, onDeselect, activeWeather, onWeatherChange, activeBackground, onBackgroundChange }: Props) {
  const [manifest, setManifest] = useState<SpriteManifest | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [search, setSearch] = useState('')
  const [openCategory, setOpenCategory] = useState<string | null>(null)

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'assets/sprites/manifest.json')
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setFetchError(true))
  }, [])

  const categories: SpriteCategory[] = manifest?.categories ?? []
  const filtered = categories.map((cat) => ({
    ...cat,
    sprites: cat.sprites.filter((s) =>
      !search || s.label.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((cat) => cat.sprites.length > 0)

  if (fetchError) {
    return (
      <div style={{ padding: 16, color: '#e74c3c', fontSize: 13 }}>
        Failed to load sprites
      </div>
    )
  }

  return (
    <div style={{ padding: 8 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px', marginBottom: 5 }}>
          Weather
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {WEATHERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onWeatherChange(id)}
              style={{
                padding: '5px 4px',
                fontSize: 11,
                fontWeight: 600,
                background: activeWeather === id ? 'rgba(255,210,50,0.18)' : 'rgba(255,255,255,0.04)',
                border: activeWeather === id ? '1px solid rgba(255,210,50,0.6)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4,
                color: activeWeather === id ? '#ffe033' : '#bbb',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px', marginBottom: 5 }}>
          Background
        </div>
        <select
          value={activeBackground}
          onChange={(e) => onBackgroundChange(e.target.value as BackgroundType)}
          style={{
            width: '100%', padding: '5px 8px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4, color: '#bbb',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          {BACKGROUNDS.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search sprites..."
        style={{
          width: '100%', padding: '6px 10px', borderRadius: 6,
          border: '1px solid #444', background: '#2a2a3a', color: '#eee',
          fontSize: 13, marginBottom: 8,
        }}
      />
      {filtered.map((cat) => (
        <div key={cat.id}>
          <button
            onClick={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}
            style={{
              width: '100%', textAlign: 'left', padding: '6px 8px',
              background: 'none', border: 'none', color: '#aaa',
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              cursor: 'pointer', letterSpacing: 0.5,
            }}
          >
            {openCategory === cat.id ? '▾' : '▸'} {cat.label}
          </button>
          {openCategory === cat.id && cat.sprites.map((sprite) => (
            <button
              key={sprite.id}
              onPointerDown={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId)
                if (selectedSpriteId === sprite.id) onDeselect()
                else onSelect(sprite)
              }}
              onDragStart={(e) => e.preventDefault()}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '6px 8px 6px 20px',
                background: selectedSpriteId === sprite.id ? '#2d3f5a' : 'none',
                border: selectedSpriteId === sprite.id ? '1px solid #3b82f6' : '1px solid transparent',
                color: '#ddd', fontSize: 13,
                cursor: selectedSpriteId === sprite.id ? 'crosshair' : 'grab',
                borderRadius: 4, textAlign: 'left',
                userSelect: 'none',
              }}
            >
              <img src={import.meta.env.BASE_URL + sprite.path.slice(1)} alt={sprite.label} draggable={false} style={{ width: 28, height: 28, objectFit: 'contain', pointerEvents: 'none' }} />
              {sprite.label}
            </button>
          ))}
        </div>
      ))}
      {manifest && filtered.length === 0 && (
        <p style={{ color: '#666', fontSize: 13, padding: 8 }}>No sprites found</p>
      )}
    </div>
  )
}
