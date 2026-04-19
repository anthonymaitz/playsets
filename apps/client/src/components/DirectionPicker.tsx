import type { FacingDir } from '../types'
import { getCameraSnapIndex, getArrowWorldDir } from '../babylon/cameraFacing'

interface Props {
  screenX: number
  screenY: number
  cameraAlpha: number
  onPick: (facing: FacingDir) => void
  onDismiss?: () => void
}

// Screen positions for the 4 arrows, matching isometric corners-forward layout.
// Order matches getArrowWorldDir arrowIndex: 0=↙, 1=↘, 2=↖, 3=↗
const ARROW_POSITIONS = [
  { label: '↙', dx: -56, dy:  44 },  // 0: lower-left  → front unmirrored
  { label: '↘', dx:  56, dy:  44 },  // 1: lower-right → front mirrored
  { label: '↖', dx: -56, dy: -44 },  // 2: upper-left  → back  unmirrored
  { label: '↗', dx:  56, dy: -44 },  // 3: upper-right → back  mirrored
]

export function DirectionPicker({ screenX, screenY, cameraAlpha, onPick }: Props) {
  const snapIndex = getCameraSnapIndex(cameraAlpha)

  return (
    <>
      {ARROW_POSITIONS.map(({ label, dx, dy }, i) => {
        const dir = getArrowWorldDir(i, snapIndex)
        return (
          <button
            key={i}
            onPointerDown={(e) => { e.stopPropagation(); onPick(dir) }}
            style={{
              position: 'fixed',
              left: screenX + dx - 26,
              top:  screenY + dy - 18,
              width: 52,
              height: 36,
              zIndex: 70,
              background: 'rgba(15,15,20,0.88)',
              border: '1px solid rgba(255,210,50,0.7)',
              borderRadius: 6,
              color: '#ffe033',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: '0.03em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
            }}
          >
            {label} {dir.toUpperCase()}
          </button>
        )
      })}
    </>
  )
}
