import { describe, it, expect, beforeEach } from 'vitest'
import { useRoomStore } from './room'

describe('useRoomStore', () => {
  beforeEach(() => {
    useRoomStore.getState().reset()
  })

  it('starts with empty sprites map', () => {
    expect(Object.keys(useRoomStore.getState().sprites)).toHaveLength(0)
  })

  it('placeSprite adds a sprite', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 3, row: 4, placedBy: 'p1' })
    expect(useRoomStore.getState().sprites['i1']).toMatchObject({ col: 3, row: 4 })
  })

  it('moveSprite updates col and row', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1' })
    useRoomStore.getState().moveSprite('i1', 5, 6)
    expect(useRoomStore.getState().sprites['i1']).toMatchObject({ col: 5, row: 6 })
  })

  it('removeSprite deletes the sprite', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1' })
    useRoomStore.getState().removeSprite('i1')
    expect(useRoomStore.getState().sprites['i1']).toBeUndefined()
  })

  it('loadSnapshot replaces all sprites', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'old', spriteId: 's1', col: 0, row: 0, placedBy: 'p1' })
    useRoomStore.getState().loadSnapshot([
      { instanceId: 'new1', spriteId: 's2', col: 1, row: 1, placedBy: 'p2' },
    ])
    expect(useRoomStore.getState().sprites['old']).toBeUndefined()
    expect(useRoomStore.getState().sprites['new1']).toBeDefined()
  })
})

describe('useRoomStore — building tiles', () => {
  beforeEach(() => {
    useRoomStore.getState().reset()
  })

  it('starts with empty buildingTiles', () => {
    expect(Object.keys(useRoomStore.getState().buildingTiles)).toHaveLength(0)
  })

  it('placeTile adds a tile', () => {
    useRoomStore.getState().placeTile({ instanceId: 'b1', tileId: 'wall-wood', col: 2, row: 3 })
    expect(useRoomStore.getState().buildingTiles['b1']).toMatchObject({ col: 2, row: 3 })
  })

  it('removeTile deletes the tile', () => {
    useRoomStore.getState().placeTile({ instanceId: 'b1', tileId: 'wall-wood', col: 2, row: 3 })
    useRoomStore.getState().removeTile('b1')
    expect(useRoomStore.getState().buildingTiles['b1']).toBeUndefined()
  })

  it('loadBuildingSnapshot replaces all tiles', () => {
    useRoomStore.getState().placeTile({ instanceId: 'old', tileId: 'wall-wood', col: 0, row: 0 })
    useRoomStore.getState().loadBuildingSnapshot([
      { instanceId: 'new1', tileId: 'floor-dirt', col: 1, row: 1 },
    ])
    expect(useRoomStore.getState().buildingTiles['old']).toBeUndefined()
    expect(useRoomStore.getState().buildingTiles['new1']).toBeDefined()
    expect(Object.keys(useRoomStore.getState().buildingTiles)).toHaveLength(1)
  })

  it('reset clears buildingTiles', () => {
    useRoomStore.getState().placeTile({ instanceId: 'b1', tileId: 'wall-wood', col: 0, row: 0 })
    useRoomStore.getState().reset()
    expect(Object.keys(useRoomStore.getState().buildingTiles)).toHaveLength(0)
  })
})
