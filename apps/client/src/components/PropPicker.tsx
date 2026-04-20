import { useEffect, useState } from 'react'
import type { PropManifest, PropManifestEntry, PropTheme } from '../types'

interface Props {
  selectedPropId: string | null
  onSelect: (entry: PropManifestEntry) => void
  onDeselect: () => void
}

export function PropPicker({ selectedPropId, onSelect, onDeselect }: Props) {
  const [manifest, setManifest] = useState<PropManifest | null>(null)
  const [themeIndex, setThemeIndex] = useState(0)

  useEffect(() => {
    fetch('/assets/props/manifest.json')
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => {})
  }, [])

  const themes: PropTheme[] = manifest?.themes ?? []
  const theme = themes[themeIndex]

  if (!theme) return (
    <div style={{ padding: 12, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No props loaded</div>
  )

  return (
    <div style={{ padding: '8px 12px', minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => setThemeIndex((i) => Math.max(0, i - 1))}
          disabled={themeIndex === 0}
          style={navBtnStyle}
        >◀</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase' }}>
          {theme.label}
        </span>
        <button
          onClick={() => setThemeIndex((i) => Math.min(themes.length - 1, i + 1))}
          disabled={themeIndex === themes.length - 1}
          style={navBtnStyle}
        >▶</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {theme.props.map((entry) => (
          <button
            key={entry.id}
            onClick={() => selectedPropId === entry.id ? onDeselect() : onSelect(entry)}
            title={entry.label}
            style={{
              width: '100%', aspectRatio: '1', border: '2px solid',
              borderColor: selectedPropId === entry.id ? '#f0a84a' : 'rgba(255,255,255,0.1)',
              borderRadius: 6, background: selectedPropId === entry.id ? 'rgba(240,168,74,0.15)' : 'rgba(255,255,255,0.06)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <div style={{ width: 28, height: 28, background: '#7a4a1e', borderRadius: 3, border: '2px solid #5a3210' }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.2 }}>
              {entry.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  width: 24, height: 24, border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
  cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
}
