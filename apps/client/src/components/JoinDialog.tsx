import { useState } from 'react'
import { usePlayersStore } from '../store/players'

interface Props { onDone: () => void }

export function JoinDialog({ onDone }: Props) {
  const { setDisplayName, localPlayer } = usePlayersStore()
  const [name, setName] = useState(localPlayer?.displayName ?? '')

  const submit = () => {
    if (!name.trim()) return
    setDisplayName(name.trim())
    localStorage.setItem('playsets-display-name', name.trim())
    onDone()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{ background: '#2a2a32', borderRadius: 12, padding: 32, minWidth: 320 }}>
        <h2 style={{ marginBottom: 16 }}>Enter your name</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Display name"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            border: '1px solid #555', background: '#1e1e24', color: '#eee',
            fontSize: 16, marginBottom: 16,
          }}
        />
        <button
          onClick={submit}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8,
            background: '#3b82f6', color: '#fff', border: 'none',
            fontSize: 16, cursor: 'pointer',
          }}
        >
          Join
        </button>
      </div>
    </div>
  )
}
