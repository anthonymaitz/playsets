interface Props {
  instanceId: string
  layerIndex: number
  x: number
  y: number
  canInteract: boolean
  onMoveLayer: (instanceId: string, newLayerIndex: number) => void
}

export function TokenLayerMover({ instanceId, layerIndex, x, y, canInteract, onMoveLayer }: Props) {
  if (!canInteract) return null

  const canGoUp = layerIndex < 9
  const canGoDown = layerIndex > 1

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 30,
        top: y - 80,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        background: 'rgba(240,220,180,0.92)',
        borderRadius: 10,
        padding: '8px 10px',
        border: '2px solid rgba(200,170,110,0.8)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        pointerEvents: 'all',
      }}
    >
      <button
        onClick={() => canGoUp && onMoveLayer(instanceId, layerIndex + 1)}
        disabled={!canGoUp}
        style={{
          width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(200,170,110,0.5)',
          background: canGoUp ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)',
          cursor: canGoUp ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <polygon points="8,2 14,11 2,11" fill={canGoUp ? '#5a4a2a' : '#aaa'} />
        </svg>
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#c8a070', border: '2px solid #8a6a3a' }} />
        <div style={{ width: 22, height: 20, borderRadius: 4, background: '#b09060', border: '2px solid #8a6a3a' }} />
      </div>

      <button
        onClick={() => canGoDown && onMoveLayer(instanceId, layerIndex - 1)}
        disabled={!canGoDown}
        style={{
          width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(200,170,110,0.5)',
          background: canGoDown ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)',
          cursor: canGoDown ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <polygon points="8,14 14,5 2,5" fill={canGoDown ? '#5a4a2a' : '#aaa'} />
        </svg>
      </button>

      <span style={{ fontSize: 9, color: '#8a6a3a', fontFamily: 'monospace', fontWeight: 700 }}>
        Layer {layerIndex}
      </span>
    </div>
  )
}
