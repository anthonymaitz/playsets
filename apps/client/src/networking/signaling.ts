import { io, Socket } from 'socket.io-client'

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'http://localhost:9001'

export interface SignalingEvents {
  onGuestJoined: (guestSocketId: string) => void
  onOffer: (from: string, offer: RTCSessionDescriptionInit) => void
  onAnswer: (from: string, answer: RTCSessionDescriptionInit) => void
  onIceCandidate: (from: string, candidate: RTCIceCandidateInit) => void
  onHostDisconnected: () => void
  onGuestLeft: (guestSocketId: string) => void
}

export class SignalingClient {
  private socket: Socket
  private visibilityHandler: (() => void) | null = null

  constructor(events: SignalingEvents, onReconnect?: () => void) {
    this.socket = io(SIGNALING_URL, {
      transports: ['websocket'],
      pingTimeout: 60000,   // 60s — tolerant of background tab throttling
    })
    this.socket.on('guest-joined', events.onGuestJoined)
    this.socket.on('offer', ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) =>
      events.onOffer(from, offer))
    this.socket.on('answer', ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) =>
      events.onAnswer(from, answer))
    this.socket.on('ice-candidate', ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) =>
      events.onIceCandidate(from, candidate))
    this.socket.on('host-disconnected', events.onHostDisconnected)
    this.socket.on('guest-left', events.onGuestLeft)
    let firstConnect = true
    this.socket.on('connect', () => {
      if (firstConnect) { firstConnect = false; return }
      onReconnect?.()
    })

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && !this.socket.connected) {
        this.socket.connect()
      }
    }
    document.addEventListener('visibilitychange', this.visibilityHandler)
  }

  createRoom(existingRoomId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('create-room timeout')), 10_000)
      const ack = ({ roomId }: { roomId: string }) => { clearTimeout(timer); resolve(roomId) }
      if (existingRoomId) {
        this.socket.emit('create-room', { roomId: existingRoomId }, ack)
      } else {
        this.socket.emit('create-room', ack)
      }
    })
  }

  joinRoom(roomId: string): Promise<{ error?: string }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('join-room timeout')), 10_000)
      this.socket.emit('join-room', roomId, (result: { error?: string }) => {
        clearTimeout(timer)
        resolve(result)
      })
    })
  }

  sendOffer(to: string, offer: RTCSessionDescriptionInit): void {
    this.socket.emit('offer', { to, offer })
  }

  sendAnswer(to: string, answer: RTCSessionDescriptionInit): void {
    this.socket.emit('answer', { to, answer })
  }

  sendIceCandidate(to: string, candidate: RTCIceCandidateInit): void {
    this.socket.emit('ice-candidate', { to, candidate })
  }

  get socketId(): string {
    return this.socket.id ?? ''
  }

  disconnect(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
    this.socket.disconnect()
  }
}
