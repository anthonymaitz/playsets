const EMOTES = ['😄', '😂', '😮', '😢', '😡', '❤️', '👍', '👏']

interface Props {
  instanceId: string
  onEmote: (instanceId: string, emote: string) => void
}

export function EmotePanel({ instanceId, onEmote }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, width: 120 }}>
      {EMOTES.map((e) => (
        <button
          key={e}
          onPointerDown={(ev) => { ev.stopPropagation(); onEmote(instanceId, e) }}
          style={{
            width: 28, height: 28, fontSize: 16, background: 'rgba(30,30,40,0.9)',
            border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
