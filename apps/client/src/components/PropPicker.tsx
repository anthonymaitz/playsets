import { useEffect, useState } from 'react'
import type { PropManifest, PropManifestEntry } from '../types'

interface Props {
  selectedPropId: string | null
  onSelect: (entry: PropManifestEntry) => void
  onDeselect: () => void
}

const PROP_THUMB: Record<string, { bg: string; border: string; icon: string }> = {
  'door-wood':   { bg: '#6b3a1f', border: '#8b5a2b', icon: '🚪' },
  'window-wood': { bg: '#4a7a9b', border: '#6aaad0', icon: '🪟' },
  'painting':    { bg: '#7a5a1e', border: '#c8a840', icon: '🖼️' },
  'rug':         { bg: '#7a2030', border: '#c03050', icon: '🔲' },
  'bartop':      { bg: '#3a2510', border: '#6b4520', icon: '🍺' },
}

export function PropPicker({ selectedPropId, onSelect, onDeselect }: Props) {
  const [manifest, setManifest] = useState<PropManifest | null>(null)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    fetch('/assets/props/manifest.json')
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setFetchError(true))
  }, [])

  if (fetchError) return (
    <div style={{ padding: 12, color: '#e74c3c', fontSize: 12 }}>Failed to load props</div>
  )

  if (!manifest) return (
    <div style={{ padding: 12, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Loading…</div>
  )

  // Flatten all themes into one scrollable list with category dividers
  return (
    <div style={{ padding: '8px 10px' }}>
      {manifest.themes.map((theme) => (
        <div key={theme.id} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: 6, padding: '0 2px',
          }}>
            {theme.label}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {theme.props.map((entry) => {
              const thumb = PROP_THUMB[entry.id] ?? { bg: '#3a3a3a', border: '#666', icon: '📦' }
              const selected = selectedPropId === entry.id
              return (
                <button
                  key={entry.id}
                  onClick={() => selected ? onDeselect() : onSelect(entry)}
                  title={`${entry.label} — click to select, click again to deselect`}
                  style={{
                    width: '100%', aspectRatio: '1', border: '2px solid',
                    borderColor: selected ? '#f0a84a' : 'rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    background: selected ? 'rgba(240,168,74,0.15)' : 'rgba(255,255,255,0.05)',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 3, padding: 3,
                  }}
                >
                  <div style={{
                    width: 28, height: 28, background: thumb.bg, borderRadius: 4,
                    border: `2px solid ${thumb.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13,
                  }}>
                    {thumb.icon}
                  </div>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 1.2 }}>
                    {entry.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
