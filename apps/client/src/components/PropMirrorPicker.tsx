import type React from 'react'

interface Props {
  instanceId: string
  screenX: number
  screenY: number
  isHost: boolean
  onMirror: (instanceId: string, mirrored: boolean) => void
  onRemove: (instanceId: string) => void
}

const BTN: React.CSSProperties = {
  position: 'fixed',
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
  boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
}

export function PropMirrorPicker({ instanceId, screenX, screenY, isHost, onMirror, onRemove }: Props) {
  return (
    <>
      <button
        onPointerDown={(e) => { e.stopPropagation(); onMirror(instanceId, true) }}
        style={{ ...BTN, left: screenX - 56 - 26, top: screenY + 44 - 18 }}
      >↙</button>
      <button
        onPointerDown={(e) => { e.stopPropagation(); onMirror(instanceId, false) }}
        style={{ ...BTN, left: screenX + 56 - 26, top: screenY + 44 - 18 }}
      >↘</button>
      {isHost && (
        <button
          onPointerDown={(e) => { e.stopPropagation(); onRemove(instanceId) }}
          style={{ ...BTN, left: screenX - 26, top: screenY + 88 - 18, border: '1px solid rgba(255,80,80,0.7)', color: '#ff6060' }}
        >✕</button>
      )}
    </>
  )
}
