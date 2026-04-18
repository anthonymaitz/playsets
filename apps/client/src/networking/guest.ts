import { SignalingClient } from './signaling'
import { PeerConnection } from './peer'
import { useRoomStore } from '../store/room'
import { usePlayersStore } from '../store/players'
import type { GameMessage } from '../types'
import type { SpriteManager } from '../babylon/sprites'
import type { CursorManager } from '../babylon/cursors'
import { showEmote } from '../babylon/emotes'
import type { Scene } from '@babylonjs/core'

export class GuestSession {
  private peer: PeerConnection | null = null
  private signaling: SignalingClient
  private onHostDisconnected: () => void

  constructor(
    roomId: string,
    private scene: Scene,
    private spriteManager: SpriteManager,
    private cursorManager: CursorManager,
    onConnected: () => void,
    onHostDisconnected: () => void,
  ) {
    this.onHostDisconnected = onHostDisconnected
    this.signaling = new SignalingClient({
      onGuestJoined: () => {},
      onGuestLeft: () => {},
      onOffer: (from, offer) => this.handleOffer(from, offer, onConnected),
      onAnswer: () => {},
      onIceCandidate: (_from, candidate) => this.peer?.addIceCandidate(candidate),
      onHostDisconnected,
    })

    this.signaling.joinRoom(roomId).then((res) => {
      if (res.error) {
        console.error('Join failed:', res.error)
      }
    })
  }

  private async handleOffer(hostSocketId: string, offer: RTCSessionDescriptionInit, onConnected: () => void): Promise<void> {
    this.peer = new PeerConnection({
      onMessage: (msg) => this.handleMessage(msg),
      onIceCandidate: (c) => this.signaling.sendIceCandidate(hostSocketId, c),
      onConnected: () => {
        const { localPlayer } = usePlayersStore.getState()
        this.send({ type: 'player:join', playerId: localPlayer.playerId, displayName: localPlayer.displayName, color: localPlayer.color })
        onConnected()
      },
      onDisconnected: () => this.onHostDisconnected(),
    })
    this.peer.listenForChannels()
    const answer = await this.peer.setRemoteOffer(offer)
    this.signaling.sendAnswer(hostSocketId, answer)
  }

  private handleMessage(msg: GameMessage): void {
    const roomStore = useRoomStore.getState()
    const playersStore = usePlayersStore.getState()

    switch (msg.type) {
      case 'state:snapshot': {
        roomStore.loadSnapshot(msg.sprites)
        playersStore.loadPlayers(msg.players)
        this.spriteManager.clear()
        for (const s of msg.sprites) {
          this.spriteManager.place(s, `/assets/sprites/${s.spriteId}.png`)
        }
        break
      }
      case 'sprite:place': {
        roomStore.placeSprite({ instanceId: msg.instanceId, spriteId: msg.spriteId, col: msg.col, row: msg.row, placedBy: msg.placedBy })
        this.spriteManager.place({ instanceId: msg.instanceId, spriteId: msg.spriteId, col: msg.col, row: msg.row, placedBy: msg.placedBy }, `/assets/sprites/${msg.spriteId}.png`)
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
      case 'sprite:drag': {
        this.spriteManager.move(msg.instanceId, msg.col, msg.row)
        break
      }
      case 'cursor:move': {
        const player = playersStore.players.find((p) => p.playerId === msg.playerId)
        if (player) this.cursorManager.upsert(msg.playerId, player.displayName, player.color, msg.worldX, msg.worldZ)
        break
      }
      case 'player:join': {
        playersStore.addPlayer({ playerId: msg.playerId, displayName: msg.displayName, color: msg.color })
        break
      }
      case 'player:leave': {
        playersStore.removePlayer(msg.playerId)
        this.cursorManager.remove(msg.playerId)
        break
      }
    }
  }

  send(msg: GameMessage): void {
    if (msg.type === 'sprite:drag' || msg.type === 'cursor:move') this.peer?.sendLossy(msg)
    else this.peer?.sendReliable(msg)
  }

  dispose(): void {
    this.peer?.close()
    this.signaling.disconnect()
  }
}
