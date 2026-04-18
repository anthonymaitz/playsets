import { useEffect, useState } from 'react'
import type { SpriteCategory, SpriteManifest, SpriteManifestEntry } from '../types'

interface Props {
  selectedSpriteId: string | null
  onSelect: (sprite: SpriteManifestEntry) => void
}

export function SpritePicker({ selectedSpriteId, onSelect }: Props) {
  const [manifest, setManifest] = useState<SpriteManifest | null>(null)
  const [search, setSearch] = useState('')
  const [openCategory, setOpenCategory] = useState<string | null>(null)

  useEffect(() => {
    fetch('/assets/sprites/manifest.json')
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setManifest({ categories: [] }))
  }, [])

  const categories: SpriteCategory[] = manifest?.categories ?? []
  const filtered = categories.map((cat) => ({
    ...cat,
    sprites: cat.sprites.filter((s) =>
      !search || s.label.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((cat) => cat.sprites.length > 0)

  return (
    <div style={{
      position: 'fixed', top: 48, left: 0, bottom: 0, width: 200,
      background: '#1a1a22', borderRight: '1px solid #333',
      overflowY: 'auto', padding: 8, zIndex: 40,
    }}>
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
              onClick={() => onSelect(sprite)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '6px 8px 6px 20px',
                background: selectedSpriteId === sprite.id ? '#2d3f5a' : 'none',
                border: 'none', color: '#ddd', fontSize: 13,
                cursor: 'pointer', borderRadius: 4, textAlign: 'left',
              }}
            >
              <img src={sprite.path} alt={sprite.label} style={{ width: 28, height: 28, objectFit: 'contain' }} />
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
