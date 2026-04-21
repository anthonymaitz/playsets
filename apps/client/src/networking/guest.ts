import { SignalingClient } from './signaling'
import { PeerConnection } from './peer'
import { useRoomStore } from '../store/room'
import { usePlayersStore } from '../store/players'
import type { GameMessage } from '../types'
import type { SpriteManager } from '../babylon/sprites'
import type { BuildingManager } from '../babylon/buildings'
import type { CursorManager } from '../babylon/cursors'
import { type PropManager, getPropCategory } from '../babylon/props'
import type { RoofManager } from '../babylon/roofs'
import { showEmote } from '../babylon/emotes'
import type { Scene } from '@babylonjs/core'

export class GuestSession {
  private peer: PeerConnection | null = null
  private signaling: SignalingClient
  private onHostDisconnected: () => void
  private pendingCandidates: RTCIceCandidateInit[] = []

  constructor(
    roomId: string,
    private scene: Scene,
    private spriteManager: SpriteManager,
    private buildingManager: BuildingManager,
    private propManager: PropManager,
    private roofManager: RoofManager,
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
      onIceCandidate: (_from, candidate) => {
        if (this.peer) void this.peer.addIceCandidate(candidate)
        else this.pendingCandidates.push(candidate)
      },
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
    // Flush any ICE candidates that arrived before peer was ready
    for (const c of this.pendingCandidates) void this.peer.addIceCandidate(c)
    this.pendingCandidates = []
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
          this.spriteManager.place(s, `/assets/sprites/${s.spriteId}.svg`)
          if (s.animation) this.spriteManager.setAnimation(s.instanceId, s.animation)
          if (s.hidden) this.spriteManager.setHidden(s.instanceId, true)
          if (s.statuses?.length) this.spriteManager.setStatuses(s.instanceId, s.statuses)
        }
        break
      }
      case 'sprite:place': {
        roomStore.placeSprite({ instanceId: msg.instanceId, spriteId: msg.spriteId, col: msg.col, row: msg.row, placedBy: msg.placedBy, zOrder: msg.zOrder })
        this.spriteManager.place({ instanceId: msg.instanceId, spriteId: msg.spriteId, col: msg.col, row: msg.row, placedBy: msg.placedBy, zOrder: msg.zOrder }, `/assets/sprites/${msg.spriteId}.svg`)
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
      case 'sprite:status': {
        useRoomStore.getState().setStatuses(msg.instanceId, msg.statuses)
        this.spriteManager.setStatuses(msg.instanceId, msg.statuses)
        break
      }
      case 'sprite:speech': {
        useRoomStore.getState().setSpeech(msg.instanceId, msg.speech)
        break
      }
      case 'sprite:animate': {
        useRoomStore.getState().setAnimation(msg.instanceId, msg.animation)
        this.spriteManager.setAnimation(msg.instanceId, msg.animation)
        break
      }
      case 'sprite:hide': {
        useRoomStore.getState().setHidden(msg.instanceId, msg.hidden)
        this.spriteManager.setHidden(msg.instanceId, msg.hidden)
        break
      }
      case 'sprite:zorder': {
        useRoomStore.getState().setZOrder(msg.instanceId, msg.zOrder)
        this.spriteManager.setZOrder(msg.instanceId, msg.zOrder)
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
      case 'building:place': {
        useRoomStore.getState().placeTile(msg.tile)
        this.buildingManager.placeTile(msg.tile, `/assets/tiles/${msg.tile.tileId}.svg`)
        break
      }
      case 'building:remove': {
        useRoomStore.getState().removeTile(msg.instanceId)
        this.buildingManager.removeTile(msg.instanceId)
        break
      }
      case 'building:snapshot': {
        useRoomStore.getState().loadBuildingSnapshot(msg.tiles)
        this.buildingManager.loadSnapshot(msg.tiles)
        break
      }
      case 'prop:place': {
        useRoomStore.getState().placeProp(msg.prop)
        this.propManager.place(msg.prop, getPropCategory(msg.prop.propId), this.buildingManager)
        break
      }
      case 'prop:remove': {
        useRoomStore.getState().removeProp(msg.instanceId)
        this.propManager.remove(msg.instanceId, this.buildingManager)
        break
      }
      case 'prop:interact': {
        useRoomStore.getState().setPropState(msg.instanceId, msg.state)
        this.propManager.setState(msg.instanceId, msg.state)
        break
      }
      case 'prop:move': {
        useRoomStore.getState().moveProp(msg.instanceId, msg.col, msg.row)
        this.propManager.move(msg.instanceId, msg.col, msg.row, this.buildingManager)
        break
      }
      case 'prop:snapshot': {
        useRoomStore.getState().loadPropSnapshot(msg.props)
        this.propManager.loadSnapshot(msg.props, getPropCategory, this.buildingManager)
        break
      }
      case 'roof:place': {
        useRoomStore.getState().placeRoof(msg.roof)
        this.roofManager.place(msg.roof)
        break
      }
      case 'roof:remove': {
        useRoomStore.getState().removeRoof(msg.instanceId)
        this.roofManager.remove(msg.instanceId)
        break
      }
      case 'roof:visible': {
        useRoomStore.getState().setRoofVisible(msg.instanceId, msg.visible)
        this.roofManager.setVisible(msg.instanceId, msg.visible)
        break
      }
      case 'roof:tile': {
        useRoomStore.getState().setRoofTile(msg.instanceId, msg.tileId)
        this.roofManager.setTile(msg.instanceId, msg.tileId)
        break
      }
      case 'roof:snapshot': {
        useRoomStore.getState().loadRoofSnapshot(msg.roofs)
        this.roofManager.loadSnapshot(msg.roofs)
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
