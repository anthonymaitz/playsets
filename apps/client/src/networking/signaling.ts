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

  constructor(events: SignalingEvents) {
    this.socket = io(SIGNALING_URL, { transports: ['websocket'] })
    this.socket.on('guest-joined', events.onGuestJoined)
    this.socket.on('offer', ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) =>
      events.onOffer(from, offer))
    this.socket.on('answer', ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) =>
      events.onAnswer(from, answer))
    this.socket.on('ice-candidate', ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) =>
      events.onIceCandidate(from, candidate))
    this.socket.on('host-disconnected', events.onHostDisconnected)
    this.socket.on('guest-left', events.onGuestLeft)
  }

  createRoom(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('create-room timeout')), 10_000)
      this.socket.emit('create-room', ({ roomId }: { roomId: string }) => {
        clearTimeout(timer)
        resolve(roomId)
      })
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
    this.socket.disconnect()
  }
}
