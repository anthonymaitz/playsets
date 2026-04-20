import { useEffect, useState } from 'react'
import type { PropManifest, PropManifestEntry, PropTheme } from '../types'

interface Props {
  selectedPropId: string | null
  onSelect: (entry: PropManifestEntry) => void
  onDeselect: () => void
}

const PROP_THUMB: Record<string, { bg: string; border: string; icon: string }> = {
  'door-wood':    { bg: '#6b3a1f', border: '#8b5a2b', icon: '🚪' },
  'window-wood':  { bg: '#4a7a9b', border: '#6aaad0', icon: '🪟' },
  'painting':     { bg: '#7a5a1e', border: '#c8a840', icon: '🖼️' },
  'rug':          { bg: '#7a2030', border: '#c03050', icon: '🔲' },
  'bartop':       { bg: '#3a2510', border: '#6b4520', icon: '🍺' },
}

export function PropPicker({ selectedPropId, onSelect, onDeselect }: Props) {
  const [manifest, setManifest] = useState<PropManifest | null>(null)
  const [themeIndex, setThemeIndex] = useState(0)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    fetch('/assets/props/manifest.json')
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setFetchError(true))
  }, [])

  const themes: PropTheme[] = manifest?.themes ?? []
  const theme = themes[themeIndex]

  if (fetchError) return (
    <div style={{ padding: 12, color: '#e74c3c', fontSize: 12 }}>Failed to load props</div>
  )

  if (!theme) return (
    <div style={{ padding: 12, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No props loaded</div>
  )

  return (
    <div style={{ padding: '8px 12px', minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => setThemeIndex((i) => Math.max(0, i - 1))}
          disabled={themeIndex === 0}
          style={navBtnStyle(themeIndex === 0)}
        >◀</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: 1, textTransform: 'uppercase' }}>
            {theme.label}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
            {themeIndex + 1} / {themes.length}
          </div>
        </div>
        <button
          onClick={() => setThemeIndex((i) => Math.min(themes.length - 1, i + 1))}
          disabled={themeIndex === themes.length - 1}
          style={navBtnStyle(themeIndex === themes.length - 1)}
        >▶</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {theme.props.map((entry) => {
          const thumb = PROP_THUMB[entry.id] ?? { bg: '#3a3a3a', border: '#666', icon: '📦' }
          const selected = selectedPropId === entry.id
          return (
            <button
              key={entry.id}
              onClick={() => selected ? onDeselect() : onSelect(entry)}
              title={entry.label}
              style={{
                width: '100%', aspectRatio: '1', border: '2px solid',
                borderColor: selected ? '#f0a84a' : 'rgba(255,255,255,0.1)',
                borderRadius: 6,
                background: selected ? 'rgba(240,168,74,0.15)' : 'rgba(255,255,255,0.06)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4,
              }}
            >
              <div style={{
                width: 30, height: 30, background: thumb.bg, borderRadius: 4,
                border: `2px solid ${thumb.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>
                {thumb.icon}
              </div>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.2 }}>
                {entry.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 24, height: 24, border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4, background: 'rgba(255,255,255,0.06)',
    color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
    cursor: disabled ? 'default' : 'pointer', fontSize: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  }
}
