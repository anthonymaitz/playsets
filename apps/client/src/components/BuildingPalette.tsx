import { useEffect, useState } from 'react'
import type { TileManifestEntry, TileCategory } from '../types'

interface Props {
  wallTileId: string
  floorTileId: string
  mode: 'build' | 'erase'
  onWallSelect: (tileId: string) => void
  onFloorSelect: (tileId: string) => void
  onModeChange: (mode: 'build' | 'erase') => void
}

export function BuildingPalette({ wallTileId, floorTileId, mode, onWallSelect, onFloorSelect, onModeChange }: Props) {
  const [tiles, setTiles] = useState<TileManifestEntry[]>([])

  useEffect(() => {
    fetch('/assets/tiles/manifest.json')
      .then((r) => r.json())
      .then((data: { tiles: TileManifestEntry[] }) => setTiles(data.tiles))
      .catch(() => {})
  }, [])

  const byCategory = (cat: TileCategory) => tiles.filter((t) => t.category === cat)

  const Row = ({ category, selectedId, onSelect }: { category: TileCategory; selectedId: string; onSelect: (id: string) => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 36, fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 }}>
        {category}
      </span>
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto' }}>
        {byCategory(category).map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            title={t.label}
            style={{
              width: 40, height: 40, flexShrink: 0, border: '2px solid',
              borderColor: selectedId === t.id ? '#f0a84a' : 'rgba(255,255,255,0.1)',
              borderRadius: 4, background: 'rgba(255,255,255,0.06)',
              cursor: 'pointer', padding: 2, overflow: 'hidden',
            }}
          >
            <img src={t.path} alt={t.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 44, right: 0,
      background: 'rgba(10,15,10,0.92)', borderTop: '1px solid rgba(255,255,255,0.1)',
      padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <Row category="wall" selectedId={wallTileId} onSelect={onWallSelect} />
        <Row category="floor" selectedId={floorTileId} onSelect={onFloorSelect} />
      </div>
      <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
        {(['build', 'erase'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: mode === m ? '#c8893a' : 'rgba(255,255,255,0.06)',
              color: mode === m ? '#000' : 'rgba(255,255,255,0.5)',
              textTransform: 'capitalize',
            }}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}
