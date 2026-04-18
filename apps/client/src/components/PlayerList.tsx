import { usePlayersStore } from '../store/players'

export function PlayerList() {
  const { players, localPlayer } = usePlayersStore()
  const all = [localPlayer, ...players]

  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 4,
      background: '#2a2a3a', border: '1px solid #444', borderRadius: 8,
      minWidth: 180, padding: 8,
    }}>
      {all.map((p) => (
        <div key={p.playerId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
          <span style={{ fontSize: 13 }}>{p.displayName || 'Anonymous'}</span>
          {p.playerId === localPlayer.playerId && (
            <span style={{ fontSize: 11, color: '#666', marginLeft: 'auto' }}>you</span>
          )}
        </div>
      ))}
    </div>
  )
}
