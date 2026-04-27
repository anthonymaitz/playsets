interface Props {
  instanceId: string
  layerIndex: number
  screenX: number
  screenY: number
  onMoveLayer: (instanceId: string, newLayerIndex: number) => void
}

export function TokenLayerMoverOverlay(props: Props) {
  const canGoUp = () => props.layerIndex < 9
  const canGoDown = () => props.layerIndex > 1
  return (
    <div
      style={`position:fixed;left:${props.screenX - 30}px;top:${props.screenY - 80}px;z-index:75;display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(240,220,180,0.92);border-radius:10px;padding:8px 10px;border:2px solid rgba(200,170,110,0.8);box-shadow:0 4px 16px rgba(0,0,0,0.5);pointer-events:all;`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => canGoUp() && props.onMoveLayer(props.instanceId, props.layerIndex + 1)}
        disabled={!canGoUp()}
        style={`width:32px;height:32px;border-radius:6px;border:1px solid rgba(200,170,110,0.5);background:${canGoUp() ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'};cursor:${canGoUp() ? 'pointer' : 'default'};display:flex;align-items:center;justify-content:center;`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <polygon points="8,2 14,11 2,11" fill={canGoUp() ? '#5a4a2a' : '#aaa'} />
        </svg>
      </button>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
        <div style="width:18px;height:18px;border-radius:50%;background:#c8a070;border:2px solid #8a6a3a;" />
        <div style="width:22px;height:20px;border-radius:4px;background:#b09060;border:2px solid #8a6a3a;" />
      </div>
      <button
        onClick={() => canGoDown() && props.onMoveLayer(props.instanceId, props.layerIndex - 1)}
        disabled={!canGoDown()}
        style={`width:32px;height:32px;border-radius:6px;border:1px solid rgba(200,170,110,0.5);background:${canGoDown() ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'};cursor:${canGoDown() ? 'pointer' : 'default'};display:flex;align-items:center;justify-content:center;`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <polygon points="8,14 14,5 2,5" fill={canGoDown() ? '#5a4a2a' : '#aaa'} />
        </svg>
      </button>
      <span style="font-size:9px;color:#8a6a3a;font-family:monospace;font-weight:700;">
        Layer {props.layerIndex}
      </span>
    </div>
  )
}
