import { describe, it, expect, beforeEach } from 'vitest'
import { useRoomStore } from './room'
import type { LayerConfig, LayerBackground } from '../types'

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

describe('useRoomStore — builderProps', () => {
  const sampleProp = { instanceId: 'p1', propId: 'door-wood', col: 2, row: 3, state: { open: false } }

  beforeEach(() => {
    useRoomStore.getState().reset()
  })

  it('starts with empty builderProps', () => {
    expect(Object.keys(useRoomStore.getState().builderProps)).toHaveLength(0)
  })

  it('placeProp adds a prop keyed by instanceId', () => {
    useRoomStore.getState().placeProp(sampleProp)
    expect(useRoomStore.getState().builderProps['p1']).toMatchObject({ propId: 'door-wood', col: 2, row: 3 })
  })

  it('removeProp removes a prop by instanceId', () => {
    useRoomStore.getState().placeProp(sampleProp)
    useRoomStore.getState().placeProp({ instanceId: 'p2', propId: 'window-wood', col: 5, row: 6, state: {} })
    useRoomStore.getState().removeProp('p1')
    expect(useRoomStore.getState().builderProps['p1']).toBeUndefined()
    expect(useRoomStore.getState().builderProps['p2']).toBeDefined()
  })

  it('setPropState updates state for an existing prop', () => {
    useRoomStore.getState().placeProp(sampleProp)
    useRoomStore.getState().setPropState('p1', { open: true })
    expect(useRoomStore.getState().builderProps['p1'].state).toEqual({ open: true })
  })

  it('setPropState does nothing for unknown instanceId', () => {
    useRoomStore.getState().placeProp(sampleProp)
    useRoomStore.getState().setPropState('unknown', { open: true })
    expect(useRoomStore.getState().builderProps['p1'].state).toEqual({ open: false })
  })

  it('loadPropSnapshot replaces all props', () => {
    useRoomStore.getState().placeProp(sampleProp)
    useRoomStore.getState().loadPropSnapshot([
      { instanceId: 'p10', propId: 'chest-wood', col: 1, row: 1, state: { locked: true } },
    ])
    expect(useRoomStore.getState().builderProps['p1']).toBeUndefined()
    expect(useRoomStore.getState().builderProps['p10']).toBeDefined()
    expect(Object.keys(useRoomStore.getState().builderProps)).toHaveLength(1)
  })

  it('reset clears builderProps', () => {
    useRoomStore.getState().placeProp(sampleProp)
    useRoomStore.getState().reset()
    expect(Object.keys(useRoomStore.getState().builderProps)).toHaveLength(0)
  })

  it('moveProp updates col and row', () => {
    const { placeProp, moveProp } = useRoomStore.getState()
    const prop = { instanceId: 'p1', propId: 'door-wood', col: 1, row: 1, state: { open: false } }
    placeProp(prop)
    moveProp('p1', 3, 4)
    expect(useRoomStore.getState().builderProps['p1']).toMatchObject({ col: 3, row: 4 })
  })

  it('moveProp ignores unknown instanceId', () => {
    expect(() => useRoomStore.getState().moveProp('ghost', 0, 0)).not.toThrow()
  })
})

describe('useRoomStore — zOrder', () => {
  beforeEach(() => { useRoomStore.getState().reset() })

  it('setZOrder updates zOrder for an existing sprite', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1' })
    useRoomStore.getState().setZOrder('i1', 2)
    expect(useRoomStore.getState().sprites['i1'].zOrder).toBe(2)
  })

  it('setZOrder does nothing for unknown instanceId', () => {
    expect(() => useRoomStore.getState().setZOrder('unknown', 2)).not.toThrow()
  })

  it('placeSprite preserves zOrder when provided', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1', zOrder: 3 })
    expect(useRoomStore.getState().sprites['i1'].zOrder).toBe(3)
  })
})

describe('useRoomStore — roofs', () => {
  const sampleRoof = {
    instanceId: 'r1',
    tileId: 'roof-thatch',
    cells: [{ col: 0, row: 0 }],
    tokenCol: 0,
    tokenRow: 0,
    visible: true,
    createdBy: 'player1',
  }

  beforeEach(() => {
    useRoomStore.getState().reset()
  })

  it('starts with empty roofs', () => {
    expect(Object.keys(useRoomStore.getState().roofs)).toHaveLength(0)
  })

  it('placeRoof stores a roof by instanceId', () => {
    useRoomStore.getState().placeRoof(sampleRoof)
    expect(useRoomStore.getState().roofs['r1']).toMatchObject({
      instanceId: 'r1',
      tileId: 'roof-thatch',
      visible: true,
    })
  })

  it('removeRoof deletes a roof by instanceId', () => {
    useRoomStore.getState().placeRoof(sampleRoof)
    useRoomStore.getState().removeRoof('r1')
    expect(useRoomStore.getState().roofs['r1']).toBeUndefined()
  })

  it('setRoofVisible updates visible for an existing roof', () => {
    useRoomStore.getState().placeRoof(sampleRoof)
    useRoomStore.getState().setRoofVisible('r1', false)
    expect(useRoomStore.getState().roofs['r1'].visible).toBe(false)
  })

  it('setRoofVisible does nothing for unknown instanceId', () => {
    useRoomStore.getState().placeRoof(sampleRoof)
    useRoomStore.getState().setRoofVisible('unknown', false)
    expect(useRoomStore.getState().roofs['r1'].visible).toBe(true)
  })

  it('setRoofTile updates tileId for an existing roof', () => {
    useRoomStore.getState().placeRoof(sampleRoof)
    useRoomStore.getState().setRoofTile('r1', 'roof-slate')
    expect(useRoomStore.getState().roofs['r1'].tileId).toBe('roof-slate')
  })

  it('setRoofTile does nothing for unknown instanceId', () => {
    useRoomStore.getState().placeRoof(sampleRoof)
    useRoomStore.getState().setRoofTile('unknown', 'roof-slate')
    expect(useRoomStore.getState().roofs['r1'].tileId).toBe('roof-thatch')
  })

  it('loadRoofSnapshot replaces all roofs', () => {
    useRoomStore.getState().placeRoof(sampleRoof)
    useRoomStore.getState().loadRoofSnapshot([
      {
        instanceId: 'r2',
        tileId: 'roof-slate',
        cells: [{ col: 1, row: 1 }],
        tokenCol: 1,
        tokenRow: 1,
        visible: false,
        createdBy: 'player2',
      },
    ])
    expect(useRoomStore.getState().roofs['r1']).toBeUndefined()
    expect(useRoomStore.getState().roofs['r2']).toBeDefined()
    expect(Object.keys(useRoomStore.getState().roofs)).toHaveLength(1)
  })

  it('reset clears roofs', () => {
    useRoomStore.getState().placeRoof(sampleRoof)
    useRoomStore.getState().reset()
    expect(Object.keys(useRoomStore.getState().roofs)).toHaveLength(0)
  })
})

describe('useRoomStore — layers', () => {
  beforeEach(() => {
    useRoomStore.getState().reset()
  })

  it('starts with default layer configs', () => {
    const { layers } = useRoomStore.getState()
    expect(layers[5]).toEqual({ background: 'grass', visible: true })
    expect(layers[1]).toEqual({ background: 'dirt', visible: true })
    expect(layers[3]).toEqual({ background: 'transparent', visible: true })
  })

  it('updateLayerConfig patches a single layer', () => {
    useRoomStore.getState().updateLayerConfig(3, { background: 'grass' })
    expect(useRoomStore.getState().layers[3].background).toBe('grass')
    expect(useRoomStore.getState().layers[3].visible).toBe(true)
  })

  it('updateLayerConfig toggling visible preserves background', () => {
    useRoomStore.getState().updateLayerConfig(5, { visible: false })
    expect(useRoomStore.getState().layers[5]).toEqual({ background: 'grass', visible: false })
  })

  it('loadLayerSnapshot replaces all configs', () => {
    const newConfigs: Record<number, LayerConfig> = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [i + 1, { background: 'transparent' as LayerBackground, visible: false }])
    )
    useRoomStore.getState().loadLayerSnapshot(newConfigs)
    expect(useRoomStore.getState().layers[5].background).toBe('transparent')
    expect(useRoomStore.getState().layers[5].visible).toBe(false)
  })

  it('moveSprite with layerIndex updates layerIndex on sprite', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1', layerIndex: 5 })
    useRoomStore.getState().moveSprite('i1', 2, 3, 6)
    const s = useRoomStore.getState().sprites['i1']
    expect(s.col).toBe(2)
    expect(s.row).toBe(3)
    expect(s.layerIndex).toBe(6)
  })

  it('moveSprite without layerIndex preserves existing layerIndex', () => {
    useRoomStore.getState().placeSprite({ instanceId: 'i1', spriteId: 's1', col: 0, row: 0, placedBy: 'p1', layerIndex: 7 })
    useRoomStore.getState().moveSprite('i1', 1, 1)
    expect(useRoomStore.getState().sprites['i1'].layerIndex).toBe(7)
  })

  it('updateLayerConfig ignores unknown layer index', () => {
    const before = { ...useRoomStore.getState().layers }
    useRoomStore.getState().updateLayerConfig(99, { visible: false })
    expect(useRoomStore.getState().layers).toEqual(before)
  })

  it('reset restores default layer configs', () => {
    useRoomStore.getState().updateLayerConfig(5, { visible: false })
    useRoomStore.getState().reset()
    expect(useRoomStore.getState().layers[5].visible).toBe(true)
  })
})
