const EMOTES = ['❤️', '💀', '⚔️', '🛡️', '🎲', '😴', '✨', '💬']

interface Props {
  instanceId: string
  position: { x: number; y: number }
  onEmote: (instanceId: string, emote: string) => void
  onClose: () => void
}

export function EmoteMenu({ instanceId, position, onEmote, onClose }: Props) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 59 }}
      />
      <div style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        background: '#2a2a3a',
        border: '1px solid #444',
        borderRadius: 12,
        padding: 8,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 4,
        zIndex: 60,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        {EMOTES.map((emote) => (
          <button
            key={emote}
            onClick={() => { onEmote(instanceId, emote); onClose() }}
            style={{
              fontSize: 24, padding: '6px 8px', border: 'none',
              background: 'none', cursor: 'pointer', borderRadius: 6,
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a4a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            {emote}
          </button>
        ))}
      </div>
    </>
  )
}
