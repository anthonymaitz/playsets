interface Props {
  instanceId: string
  visible: boolean
  tileId: string
  x: number
  y: number
  onToggleVisible: (instanceId: string, visible: boolean) => void
  onChangeTile: (instanceId: string, tileId: string) => void
  onRemove: (instanceId: string) => void
  onClose: () => void
}

const ROOF_TILES = [
  { id: 'roof-thatch',   label: 'Thatch',   color: '#a68b4a' },
  { id: 'roof-wood',     label: 'Wood',     color: '#7a4a1e' },
  { id: 'roof-stone',    label: 'Stone',    color: '#808085' },
  { id: 'roof-red-tile', label: 'Red Tile', color: '#b84028' },
]

export function RoofMenu({ instanceId, visible, tileId, x, y, onToggleVisible, onChangeTile, onRemove, onClose }: Props) {
  const menuW = 180
  const menuH = 170
  const left = Math.min(x, window.innerWidth - menuW - 8)
  const top  = Math.min(y, window.innerHeight - menuH - 8)

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', left, top, zIndex: 60,
        background: 'rgba(12,16,12,0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        minWidth: menuW,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Roof
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onToggleVisible(instanceId, true)}
          style={{
            flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none',
            borderRadius: 4, background: visible ? '#4a9a5a' : 'rgba(255,255,255,0.07)',
            color: visible ? '#000' : 'rgba(255,255,255,0.45)',
          }}
        >
          Show
        </button>
        <button
          onClick={() => onToggleVisible(instanceId, false)}
          style={{
            flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none',
            borderRadius: 4, background: !visible ? '#9a4a2a' : 'rgba(255,255,255,0.07)',
            color: !visible ? '#fff' : 'rgba(255,255,255,0.45)',
          }}
        >
          Hide
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {ROOF_TILES.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => onChangeTile(instanceId, t.id)}
            style={{
              aspectRatio: '1', border: '2px solid',
              borderColor: tileId === t.id ? '#f0a84a' : 'rgba(255,255,255,0.1)',
              borderRadius: 4, background: t.color, cursor: 'pointer',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {ROOF_TILES.map((t) => (
          tileId === t.id ? (
            <span key={t.id} style={{ fontSize: 9, color: '#f0a84a' }}>{t.label}</span>
          ) : null
        ))}
      </div>

      <button
        onClick={() => { onRemove(instanceId); onClose() }}
        style={{
          padding: '4px 0', fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none',
          borderRadius: 4, background: 'rgba(180,40,40,0.25)', color: '#e07070',
        }}
      >
        Remove Roof
      </button>
    </div>
  )
}
