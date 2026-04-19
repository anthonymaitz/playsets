import { useState } from 'react'

interface Props {
  instanceId: string
  currentSpeech: string
  onSpeech: (instanceId: string, speech: string) => void
}

export function SpeechPanel({ instanceId, currentSpeech, onSpeech }: Props) {
  const [draft, setDraft] = useState(currentSpeech)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 120 }}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Say something…"
        rows={2}
        style={{
          resize: 'none', fontSize: 11, padding: '4px 6px',
          background: 'rgba(20,20,28,0.95)', color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onPointerDown={(e) => { e.stopPropagation(); onSpeech(instanceId, draft) }}
          style={{
            flex: 1, height: 24, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(80,180,100,0.3)', border: '1px solid rgba(80,180,100,0.7)',
            borderRadius: 4, color: '#aef7b8',
          }}
        >
          Say
        </button>
        <button
          onPointerDown={(e) => { e.stopPropagation(); setDraft(''); onSpeech(instanceId, '') }}
          style={{
            flex: 1, height: 24, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(30,30,40,0.9)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 4, color: '#aaa',
          }}
        >
          Clear
        </button>
      </div>
    </div>
  )
}
