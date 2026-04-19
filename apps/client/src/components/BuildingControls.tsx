
export interface ScreenCorners {
  nw: { x: number; y: number }
  ne: { x: number; y: number }
  sw: { x: number; y: number }
  se: { x: number; y: number }
  center: { x: number; y: number }
  width: number
  height: number
}

interface Props {
  corners: ScreenCorners | null
  mergeMode: 'open' | 'walled'
  onMergeModeChange: (m: 'open' | 'walled') => void
  onPlace: () => void
  onCornerDragStart: (corner: 'nw' | 'ne' | 'sw' | 'se') => void
}

const HANDLE_SIZE = 16

export function BuildingControls({ corners, mergeMode, onMergeModeChange, onPlace, onCornerDragStart }: Props) {
  if (!corners) return null

  const Handle = ({ corner, pos }: { corner: 'nw' | 'ne' | 'sw' | 'se'; pos: { x: number; y: number } }) => (
    <div
      onPointerDown={(e) => { e.stopPropagation(); onCornerDragStart(corner) }}
      style={{
        position: 'absolute',
        left: pos.x - HANDLE_SIZE / 2,
        top: pos.y - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        background: '#fff',
        border: '2px solid #c8893a',
        borderRadius: 3,
        cursor: 'crosshair',
        touchAction: 'none',
        boxShadow: '0 1px 6px rgba(0,0,0,0.5)',
        zIndex: 10,
      }}
    />
  )

  return (
    <>
      <Handle corner="nw" pos={corners.nw} />
      <Handle corner="ne" pos={corners.ne} />
      <Handle corner="sw" pos={corners.sw} />
      <Handle corner="se" pos={corners.se} />

      {/* Floating control strip */}
      <div style={{
        position: 'absolute',
        left: corners.center.x,
        top: corners.center.y,
        transform: 'translate(-50%, -100%)',
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(10,15,10,0.88)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 8, padding: '6px 10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'auto',
      }}>
        <span style={{ color: 'rgba(200,137,58,0.9)', fontSize: 11, fontFamily: 'monospace', paddingRight: 6, borderRight: '1px solid rgba(255,255,255,0.1)' }}>
          {corners.width} × {corners.height}
        </span>

        <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
          {(['open', 'walled'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onMergeModeChange(m)}
              style={{
                padding: '4px 8px', fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: mergeMode === m ? '#c8893a' : 'rgba(255,255,255,0.06)',
                color: mergeMode === m ? '#000' : 'rgba(255,255,255,0.45)',
                textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

        <button
          onClick={onPlace}
          style={{
            padding: '5px 14px', borderRadius: 5, background: '#4a7a40', color: '#fff',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', letterSpacing: 0.3,
          }}
        >
          Place Room
        </button>
      </div>
    </>
  )
}
