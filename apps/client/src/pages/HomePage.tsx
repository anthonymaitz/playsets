import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CSSProperties } from 'react'

export function HomePage() {
  const navigate = useNavigate()
  const [roomInput, setRoomInput] = useState('')

  const joinRoom = () => {
    const id = roomInput.trim()
    if (id) navigate(`/room/${id}`)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 24,
    }}>
      <h1 style={{ fontSize: 48, fontWeight: 800 }}>Playsets</h1>
      <p style={{ color: '#888' }}>Virtual tabletop for everyone</p>
      <button onClick={() => navigate('/room/new?host=1')} style={primaryBtn}>
        Create Room
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          placeholder="Room code"
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #444', background: '#2a2a32', color: '#eee', fontSize: 15 }}
        />
        <button onClick={joinRoom} style={secondaryBtn}>Join</button>
      </div>
    </div>
  )
}

const primaryBtn: CSSProperties = {
  padding: '12px 32px', borderRadius: 10, background: '#3b82f6',
  color: '#fff', border: 'none', fontSize: 17, cursor: 'pointer', fontWeight: 600,
}
const secondaryBtn: CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: '#2a2a3a',
  color: '#ddd', border: '1px solid #444', fontSize: 15, cursor: 'pointer',
}
