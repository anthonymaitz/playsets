import type { GameMessage, SpriteInstance, Player, BuildingTile, BuilderProp, Roof, TokenDefinition } from '../types'
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

export function sendBuildingSnapshot(peer: PeerConnection, tiles: BuildingTile[]): void {
  peer.sendReliable({ type: 'building:snapshot', tiles })
}

export function sendPropSnapshot(peer: PeerConnection, props: BuilderProp[]): void {
  peer.sendReliable({ type: 'prop:snapshot', props })
}

export function sendRoofSnapshot(peer: PeerConnection, roofs: Roof[]): void {
  peer.sendReliable({ type: 'roof:snapshot', roofs })
}

export function sendTokenSnapshot(peer: PeerConnection, definitions: TokenDefinition[]): void {
  peer.sendReliable({ type: 'token:snapshot', definitions })
}
