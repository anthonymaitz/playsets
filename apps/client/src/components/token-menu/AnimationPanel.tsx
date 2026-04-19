import type { AnimationName } from '../../types'

const ANIMATIONS: { id: AnimationName; label: string }[] = [
  { id: 'dance', label: '💃 Dance' },
  { id: 'sleep', label: '😴 Sleep' },
]

interface Props {
  instanceId: string
  activeAnimation: AnimationName
  onAnimate: (instanceId: string, animation: AnimationName) => void
}

export function AnimationPanel({ instanceId, activeAnimation, onAnimate }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 120 }}>
      {ANIMATIONS.map(({ id, label }) => (
        <button
          key={id}
          onPointerDown={(e) => { e.stopPropagation(); onAnimate(instanceId, activeAnimation === id ? '' : id) }}
          style={{
            height: 28, fontSize: 12, fontWeight: 600,
            background: activeAnimation === id ? 'rgba(255,210,50,0.25)' : 'rgba(30,30,40,0.9)',
            border: activeAnimation === id ? '1px solid rgba(255,210,50,0.8)' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: 4, cursor: 'pointer', color: '#fff',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
