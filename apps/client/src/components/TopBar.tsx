import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useRoomStore } from '../store/room'
import { PlayerList } from './PlayerList'

export function TopBar() {
  const roomId = useRoomStore((s) => s.roomId)
  const [showPlayers, setShowPlayers] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyLink = () => {
    if (!roomId) return
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 48,
      background: '#1a1a22', borderBottom: '1px solid #333',
      display: 'flex', alignItems: 'center', padding: '0 16px',
      gap: 12, zIndex: 50,
    }}>
      <span style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>Playsets</span>
      {roomId && (
        <>
          <span style={{ background: '#2a2a3a', borderRadius: 6, padding: '2px 10px', fontSize: 13, color: '#aaa' }}>
            {roomId}
          </span>
          <button onClick={copyLink} style={btnStyle}>
            {copied ? '✓ Copied' : 'Copy Link'}
          </button>
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <button onClick={() => setShowPlayers((v) => !v)} style={btnStyle}>
              Players ▾
            </button>
            {showPlayers && <PlayerList />}
          </div>
        </>
      )}
    </div>
  )
}

const btnStyle: CSSProperties = {
  padding: '4px 12px', borderRadius: 6,
  background: '#2a2a3a', color: '#ddd', border: '1px solid #444',
  cursor: 'pointer', fontSize: 13,
}
