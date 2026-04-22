import { SignalingClient } from './signaling'
import { PeerConnection } from './peer'
import { broadcastReliable, sendSnapshot, sendBuildingSnapshot, sendPropSnapshot, sendRoofSnapshot, sendTokenSnapshot, sendLayerSnapshot } from './messages'
import { useRoomStore } from '../store/room'
import { usePlayersStore } from '../store/players'
import { useTokenStore } from '../store/tokens'
import type { GameMessage, LayerConfig } from '../types'
import type { SpriteManager } from '../babylon/sprites'
import type { BuildingManager } from '../babylon/buildings'
import type { CursorManager } from '../babylon/cursors'
import { type PropManager, getPropCategory } from '../babylon/props'
import type { RoofManager } from '../babylon/roofs'
import type { LayerBackgroundManager } from '../babylon/layers'
import { showEmote } from '../babylon/emotes'
import { compositeToDataUrl } from '../babylon/tokenCompositor'
import type { Scene } from '@babylonjs/core'

export class HostSession {
  private peers = new Map<string, PeerConnection>()
  private signaling: SignalingClient
  private currentRoomId: string | null = null

  constructor(
    private scene: Scene,
    private spriteManager: SpriteManager,
    private buildingManager: BuildingManager,
    private propManager: PropManager,
    private roofManager: RoofManager,
    private layerBackgroundManager: LayerBackgroundManager,
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
    this.signaling.createRoom(this.currentRoomId).then(() => {
      const { sprites, buildingTiles } = useRoomStore.getState()
      const { players, localPlayer } = usePlayersStore.getState()
      const { builderProps, roofs } = useRoomStore.getState()
      for (const peer of this.peers.values()) {
        sendSnapshot(peer, Object.values(sprites), [localPlayer, ...players])
        sendBuildingSnapshot(peer, Object.values(buildingTiles))
        sendPropSnapshot(peer, Object.values(builderProps))
        sendRoofSnapshot(peer, Object.values(roofs))
        sendTokenSnapshot(peer, Object.values(useTokenStore.getState().definitions))
        sendLayerSnapshot(peer, useRoomStore.getState().layers)
      }
    }).catch((err: unknown) => {
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
        const { buildingTiles } = useRoomStore.getState()
        sendBuildingSnapshot(peer, Object.values(buildingTiles))
        const { builderProps, roofs } = useRoomStore.getState()
        sendPropSnapshot(peer, Object.values(builderProps))
        sendRoofSnapshot(peer, Object.values(roofs))
        sendTokenSnapshot(peer, Object.values(useTokenStore.getState().definitions))
        sendLayerSnapshot(peer, useRoomStore.getState().layers)
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
        const instance = {
          instanceId: msg.instanceId, spriteId: msg.spriteId,
          col: msg.col, row: msg.row, placedBy: msg.placedBy,
          zOrder: msg.zOrder, definitionId: msg.definitionId,
          layerIndex: msg.layerIndex,
        }
        roomStore.placeSprite(instance)
        const defH = msg.definitionId ? (useTokenStore.getState().definitions[msg.definitionId] ?? { definitionId: msg.definitionId, ownedBy: msg.placedBy, layers: {} }) : null
        const url = defH ? compositeToDataUrl(defH) : `/assets/sprites/${msg.spriteId}.svg`
        this.spriteManager.place(instance, url)
        if (defH) this.spriteManager.setTokenDataUrls(msg.instanceId, url, compositeToDataUrl(defH, false))
        break
      }
      case 'sprite:move': {
        roomStore.moveSprite(msg.instanceId, msg.col, msg.row, msg.layerIndex)
        this.spriteManager.move(msg.instanceId, msg.col, msg.row)
        if (msg.layerIndex !== undefined) this.spriteManager.setLayer(msg.instanceId, msg.layerIndex)
        broadcastReliable(this.peers, msg)
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
        // Host never receives a snapshot — ignore defensively
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
      case 'prop:zorder': {
        useRoomStore.getState().setPropZOrder(msg.instanceId, msg.zOrder)
        this.propManager.setPropZOrder(msg.instanceId, msg.zOrder)
        break
      }
      case 'prop:snapshot': {
        // Host never receives a snapshot — ignore defensively
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
        // Host never receives a snapshot — ignore defensively
        break
      }
      case 'token:define': {
        useTokenStore.getState().addOrUpdate(msg.definition)
        break
      }
      case 'player:join': {
        playersStore.addPlayer({ playerId: msg.playerId, displayName: msg.displayName, color: msg.color })
        break
      }
      case 'layer:config': {
        const patch: Partial<LayerConfig> = {}
        if (msg.background !== undefined) patch.background = msg.background
        if (msg.visible !== undefined) patch.visible = msg.visible
        useRoomStore.getState().updateLayerConfig(msg.layerIndex, patch)
        this.layerBackgroundManager.updateLayer(msg.layerIndex, patch)
        if (msg.visible !== undefined) {
          this.spriteManager.setLayerVisibility(msg.layerIndex, msg.visible)
          this.buildingManager.setLayerVisibility(msg.layerIndex, msg.visible)
          this.propManager.setLayerVisibility(msg.layerIndex, msg.visible)
        }
        broadcastReliable(this.peers, msg)
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
