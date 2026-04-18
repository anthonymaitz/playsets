import { SignalingClient } from './signaling'
import { PeerConnection } from './peer'
import { broadcastReliable, sendSnapshot } from './messages'
import { useRoomStore } from '../store/room'
import { usePlayersStore } from '../store/players'
import type { GameMessage } from '../types'
import type { SpriteManager } from '../babylon/sprites'
import type { CursorManager } from '../babylon/cursors'
import { showEmote } from '../babylon/emotes'
import type { Scene } from '@babylonjs/core'

export class HostSession {
  private peers = new Map<string, PeerConnection>()
  private signaling: SignalingClient
  private currentRoomId: string | null = null

  constructor(
    private scene: Scene,
    private spriteManager: SpriteManager,
    _cursorManager: CursorManager,
    onRoomCreated: (roomId: string) => void,
  ) {
    this.signaling = new SignalingClient({
      onGuestJoined: (guestSocketId) => this.handleGuestJoined(guestSocketId),
      onAnswer: (from, answer) => this.peers.get(from)?.setRemoteAnswer(answer),
      onIceCandidate: (from, candidate) => this.peers.get(from)?.addIceCandidate(candidate),
      onOffer: () => {},
      onHostDisconnected: () => {},
      onGuestLeft: (guestSocketId) => this.handleGuestLeft(guestSocketId),
    }, () => this.handleReconnect())

    this.signaling.createRoom().then((roomId) => {
      this.currentRoomId = roomId
      useRoomStore.getState().setRoomId(roomId)
      onRoomCreated(roomId)
    }).catch((err: unknown) => {
      console.error('Failed to create room:', err)
    })
  }

  private handleReconnect(): void {
    if (!this.currentRoomId) return
    this.signaling.createRoom(this.currentRoomId).catch((err: unknown) => {
      console.error('Failed to re-register room after reconnect:', err)
    })
  }

  private async handleGuestJoined(guestSocketId: string): Promise<void> {
    const peer = new PeerConnection({
      onMessage: (msg) => this.handleMessage(msg, guestSocketId),
      onIceCandidate: (c) => this.signaling.sendIceCandidate(guestSocketId, c),
      onConnected: () => {
        const { sprites } = useRoomStore.getState()
        const { players, localPlayer } = usePlayersStore.getState()
        sendSnapshot(peer, Object.values(sprites), [localPlayer, ...players])
      },
      onDisconnected: () => this.handleGuestLeft(guestSocketId),
    })

    this.peers.set(guestSocketId, peer)
    const offer = await peer.createOffer()
    this.signaling.sendOffer(guestSocketId, offer)
  }

  private handleGuestLeft(guestSocketId: string): void {
    this.peers.get(guestSocketId)?.close()
    this.peers.delete(guestSocketId)
    broadcastReliable(this.peers, { type: 'player:leave', playerId: guestSocketId })
  }

  private handleMessage(msg: GameMessage, fromSocketId: string): void {
    const roomStore = useRoomStore.getState()
    const playersStore = usePlayersStore.getState()

    switch (msg.type) {
      case 'sprite:place': {
        roomStore.placeSprite({ instanceId: msg.instanceId, spriteId: msg.spriteId, col: msg.col, row: msg.row, placedBy: msg.placedBy })
        this.spriteManager.place({ instanceId: msg.instanceId, spriteId: msg.spriteId, col: msg.col, row: msg.row, placedBy: msg.placedBy }, `/assets/sprites/${msg.spriteId}.svg`)
        break
      }
      case 'sprite:move': {
        roomStore.moveSprite(msg.instanceId, msg.col, msg.row)
        this.spriteManager.move(msg.instanceId, msg.col, msg.row)
        break
      }
      case 'sprite:remove': {
        roomStore.removeSprite(msg.instanceId)
        this.spriteManager.remove(msg.instanceId)
        break
      }
      case 'sprite:emote': {
        const instance = roomStore.sprites[msg.instanceId]
        if (instance) showEmote(this.scene, instance.col, instance.row, msg.emote)
        break
      }
      case 'sprite:face': {
        useRoomStore.getState().faceSprite(msg.instanceId, msg.facing)
        this.spriteManager.setFacing(msg.instanceId, msg.facing)
        break
      }
      case 'sprite:drag': {
        this.spriteManager.move(msg.instanceId, msg.col, msg.row)
        break
      }
      case 'cursor:move': {
        break
      }
      case 'player:join': {
        playersStore.addPlayer({ playerId: msg.playerId, displayName: msg.displayName, color: msg.color })
        break
      }
    }
    // Relay to all other guests
    for (const [socketId, peer] of this.peers) {
      if (socketId !== fromSocketId) {
        if (msg.type === 'sprite:drag' || msg.type === 'cursor:move') peer.sendLossy(msg)
        else peer.sendReliable(msg)
      }
    }
  }

  localAction(msg: GameMessage): void {
    this.handleMessage(msg, '__local__')
  }

  dispose(): void {
    for (const peer of this.peers.values()) peer.close()
    this.signaling.disconnect()
  }
}
