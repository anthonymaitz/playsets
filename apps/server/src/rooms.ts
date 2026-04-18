import { nanoid } from 'nanoid'

export interface RoomEntry {
  roomId: string
  hostSocketId: string
  guestSocketIds: string[]
  createdAt: number
}

export class RoomRegistry {
  private rooms = new Map<string, RoomEntry>()
  private readonly TTL_MS = 24 * 60 * 60 * 1000

  create(hostSocketId: string): RoomEntry {
    const entry: RoomEntry = {
      roomId: nanoid(8),
      hostSocketId,
      guestSocketIds: [],
      createdAt: Date.now(),
    }
    this.rooms.set(entry.roomId, entry)
    return entry
  }

  get(roomId: string): RoomEntry | undefined {
    const entry = this.rooms.get(roomId)
    if (!entry) return undefined
    if (Date.now() - entry.createdAt > this.TTL_MS) {
      this.rooms.delete(roomId)
      return undefined
    }
    return entry
  }

  addGuest(roomId: string, guestSocketId: string): 'ok' | 'full' | 'not-found' {
    const entry = this.get(roomId)
    if (!entry) return 'not-found'
    if (entry.guestSocketIds.length >= 3) return 'full'
    entry.guestSocketIds.push(guestSocketId)
    return 'ok'
  }

  removeSocket(socketId: string): void {
    for (const [roomId, entry] of this.rooms) {
      if (entry.hostSocketId === socketId) {
        this.rooms.delete(roomId)
        return
      }
      const idx = entry.guestSocketIds.indexOf(socketId)
      if (idx !== -1) {
        entry.guestSocketIds.splice(idx, 1)
        return
      }
    }
  }

  findRoomBySocket(socketId: string): RoomEntry | undefined {
    for (const entry of this.rooms.values()) {
      if (entry.hostSocketId === socketId || entry.guestSocketIds.includes(socketId)) {
        return entry
      }
    }
    return undefined
  }
}
