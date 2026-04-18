import type { GameMessage, SpriteInstance, Player } from '../types'
import type { PeerConnection } from './peer'

type PeerMap = Map<string, PeerConnection>

export function broadcastReliable(peers: PeerMap, msg: GameMessage): void {
  for (const peer of peers.values()) peer.sendReliable(msg)
}

export function broadcastLossy(peers: PeerMap, msg: GameMessage): void {
  for (const peer of peers.values()) peer.sendLossy(msg)
}

export function sendSnapshot(peer: PeerConnection, sprites: SpriteInstance[], players: Player[]): void {
  peer.sendReliable({ type: 'state:snapshot', sprites, players })
}
