import type { FacingDir } from '../types'

interface Props {
  screenX: number
  screenY: number
  onPick: (facing: FacingDir) => void
  onDismiss: () => void
}

// Arrow positions match isometric screen-space directions for a corners-forward camera:
// N → upper-left, E → upper-right, S → lower-right, W → lower-left
const ARROWS: { dir: FacingDir; label: string; dx: number; dy: number }[] = [
  { dir: 'n', label: '↖ N', dx: -56, dy: -44 },
  { dir: 'e', label: '↗ E', dx:  56, dy: -44 },
  { dir: 's', label: '↘ S', dx:  56, dy:  44 },
  { dir: 'w', label: '↙ W', dx: -56, dy:  44 },
]

export function DirectionPicker({ screenX, screenY, onPick, onDismiss }: Props) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 75 }}
      onPointerDown={onDismiss}
    >
      {ARROWS.map(({ dir, label, dx, dy }) => (
        <button
          key={dir}
          onPointerDown={(e) => { e.stopPropagation(); onPick(dir) }}
          style={{
            position: 'fixed',
            left: screenX + dx - 26,
            top:  screenY + dy - 18,
            width: 52,
            height: 36,
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
          {label}
        </button>
      ))}
    </div>
  )
}
