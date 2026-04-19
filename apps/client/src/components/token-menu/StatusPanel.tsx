const STATUSES = ['🔥', '❄️', '⭐', '🤢', '😤', '🛡️', '💔', '⚡', '🕯️']

interface Props {
  instanceId: string
  activeStatuses: string[]
  onToggle: (instanceId: string, statuses: string[]) => void
}

export function StatusPanel({ instanceId, activeStatuses, onToggle }: Props) {
  const toggle = (s: string) => {
    const next = activeStatuses.includes(s)
      ? activeStatuses.filter((x) => x !== s)
      : [...activeStatuses, s]
    onToggle(instanceId, next)
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, width: 120 }}>
      {STATUSES.map((s) => (
        <button
          key={s}
          onPointerDown={(e) => { e.stopPropagation(); toggle(s) }}
          style={{
            width: 28, height: 28, fontSize: 16,
            background: activeStatuses.includes(s) ? 'rgba(255,210,50,0.25)' : 'rgba(30,30,40,0.9)',
            border: activeStatuses.includes(s) ? '1px solid rgba(255,210,50,0.8)' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: 4, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
