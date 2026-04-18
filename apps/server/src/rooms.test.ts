import { describe, it, expect, beforeEach } from 'vitest'
import { RoomRegistry } from './rooms'

describe('RoomRegistry', () => {
  let registry: RoomRegistry

  beforeEach(() => { registry = new RoomRegistry() })

  it('creates a room with an 8-char roomId', () => {
    const entry = registry.create('socket-host')
    expect(entry.roomId).toHaveLength(8)
    expect(entry.hostSocketId).toBe('socket-host')
    expect(entry.guestSocketIds).toHaveLength(0)
  })

  it('retrieves a created room by id', () => {
    const { roomId } = registry.create('socket-host')
    expect(registry.get(roomId)).toBeDefined()
  })

  it('returns undefined for unknown roomId', () => {
    expect(registry.get('no-such-room')).toBeUndefined()
  })

  it('adds guests up to the limit of 3', () => {
    const { roomId } = registry.create('host')
    expect(registry.addGuest(roomId, 'g1')).toBe('ok')
    expect(registry.addGuest(roomId, 'g2')).toBe('ok')
    expect(registry.addGuest(roomId, 'g3')).toBe('ok')
    expect(registry.addGuest(roomId, 'g4')).toBe('full')
  })

  it('returns not-found when adding guest to missing room', () => {
    expect(registry.addGuest('nope', 'g1')).toBe('not-found')
  })

  it('removes host and deletes the room', () => {
    const { roomId } = registry.create('host')
    registry.removeSocket('host')
    expect(registry.get(roomId)).toBeUndefined()
  })

  it('removes a guest but keeps the room', () => {
    const { roomId } = registry.create('host')
    registry.addGuest(roomId, 'guest')
    registry.removeSocket('guest')
    const entry = registry.get(roomId)
    expect(entry).toBeDefined()
    expect(entry?.guestSocketIds).toHaveLength(0)
  })

  it('findRoomBySocket finds a host', () => {
    const { roomId } = registry.create('host')
    expect(registry.findRoomBySocket('host')?.roomId).toBe(roomId)
  })

  it('findRoomBySocket finds a guest', () => {
    const { roomId } = registry.create('host')
    registry.addGuest(roomId, 'guest')
    expect(registry.findRoomBySocket('guest')?.roomId).toBe(roomId)
  })
})
