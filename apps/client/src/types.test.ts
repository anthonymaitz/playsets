import { describe, it, expect } from 'vitest'
import type { GameMessage, SpriteInstance, Player } from './types'

describe('GameMessage type guards', () => {
  it('sprite:place message has required fields', () => {
    const msg: GameMessage = {
      type: 'sprite:place',
      spriteId: 'token-warrior',
      col: 3,
      row: 5,
      instanceId: 'abc123',
      placedBy: 'player-1',
    }
    expect(msg.type).toBe('sprite:place')
    if (msg.type === 'sprite:place') {
      expect(msg.col).toBe(3)
      expect(msg.spriteId).toBe('token-warrior')
    }
  })

  it('state:snapshot contains sprites array', () => {
    const sprite: SpriteInstance = { instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1' }
    const player: Player = { playerId: 'p1', displayName: 'Alice', color: '#f00' }
    const msg: GameMessage = { type: 'state:snapshot', sprites: [sprite], players: [player] }
    expect(msg.type).toBe('state:snapshot')
    if (msg.type === 'state:snapshot') {
      expect(msg.sprites).toHaveLength(1)
    }
  })
})
