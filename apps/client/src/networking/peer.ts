import type { GameMessage } from '../types'

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export interface PeerCallbacks {
  onMessage: (msg: GameMessage) => void
  onIceCandidate: (candidate: RTCIceCandidateInit) => void
  onConnected: () => void
  onDisconnected: () => void
}

export class PeerConnection {
  private pc: RTCPeerConnection
  private reliableChannel: RTCDataChannel | null = null
  private lossyChannel: RTCDataChannel | null = null
  private connected = false

  constructor(private callbacks: PeerCallbacks) {
    this.pc = new RTCPeerConnection({ iceServers: STUN_SERVERS })
    this.pc.onicecandidate = (e) => {
      if (e.candidate) callbacks.onIceCandidate(e.candidate.toJSON())
    }
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'connected') {
        if (!this.connected) { this.connected = true; callbacks.onConnected() }
      }
      if (['disconnected', 'failed', 'closed'].includes(this.pc.connectionState))
        callbacks.onDisconnected()
    }
  }

  // Host: create channels and offer
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.reliableChannel = this.pc.createDataChannel('game-reliable', { ordered: true })
    this.lossyChannel = this.pc.createDataChannel('game-lossy', {
      ordered: false,
      maxRetransmits: 0,
    })
    this.bindChannelHandlers()
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    return offer
  }

  // Guest: receive channels via ondatachannel
  listenForChannels(): void {
    this.pc.ondatachannel = (e) => {
      if (e.channel.label === 'game-reliable') {
        this.reliableChannel = e.channel
        this.reliableChannel.onmessage = (ev) => this.handleMessage(ev.data as string)
        this.reliableChannel.onopen = () => {
          if (this.lossyChannel?.readyState === 'open') {
            if (!this.connected) { this.connected = true; this.callbacks.onConnected() }
          }
        }
      }
      if (e.channel.label === 'game-lossy') {
        this.lossyChannel = e.channel
        this.lossyChannel.onmessage = (ev) => this.handleMessage(ev.data as string)
        this.lossyChannel.onopen = () => {
          if (this.reliableChannel?.readyState === 'open') {
            if (!this.connected) { this.connected = true; this.callbacks.onConnected() }
          }
        }
      }
    }
  }

  async setRemoteOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(offer)
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return answer
  }

  async setRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer)
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.pc.addIceCandidate(candidate)
  }

  sendReliable(msg: GameMessage): void {
    if (this.reliableChannel?.readyState === 'open') {
      this.reliableChannel.send(JSON.stringify(msg))
    }
  }

  sendLossy(msg: GameMessage): void {
    if (this.lossyChannel?.readyState === 'open') {
      this.lossyChannel.send(JSON.stringify(msg))
    }
  }

  private bindChannelHandlers(): void {
    if (this.reliableChannel) {
      this.reliableChannel.onmessage = (e) => this.handleMessage(e.data as string)
      this.reliableChannel.onopen = () => {
        if (this.lossyChannel?.readyState === 'open') {
          if (!this.connected) { this.connected = true; this.callbacks.onConnected() }
        }
      }
    }
    if (this.lossyChannel) {
      this.lossyChannel.onmessage = (e) => this.handleMessage(e.data as string)
      this.lossyChannel.onopen = () => {
        if (this.reliableChannel?.readyState === 'open') {
          if (!this.connected) { this.connected = true; this.callbacks.onConnected() }
        }
      }
    }
  }

  private handleMessage(data: string): void {
    try {
      this.callbacks.onMessage(JSON.parse(data) as GameMessage)
    } catch {
      console.warn('Invalid message received', data)
    }
  }

  close(): void {
    this.reliableChannel?.close()
    this.lossyChannel?.close()
    this.pc.close()
  }
}
