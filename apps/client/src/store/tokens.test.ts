import { describe, it, expect, beforeEach } from 'vitest'
import { useTokenStore } from './tokens'

describe('useTokenStore', () => {
  beforeEach(() => {
    useTokenStore.getState().reset()
  })

  it('starts with empty definitions', () => {
    expect(Object.keys(useTokenStore.getState().definitions)).toHaveLength(0)
  })

  it('addOrUpdate adds a definition', () => {
    useTokenStore.getState().addOrUpdate({ definitionId: 'd1', ownedBy: 'p1', layers: {} })
    expect(useTokenStore.getState().definitions['d1']).toMatchObject({ ownedBy: 'p1' })
  })

  it('addOrUpdate replaces existing definition', () => {
    useTokenStore.getState().addOrUpdate({ definitionId: 'd1', ownedBy: 'p1', layers: {} })
    useTokenStore.getState().addOrUpdate({
      definitionId: 'd1', ownedBy: 'p1',
      layers: { face: { assetId: 'face-1', colors: { primary: '#ff0000' } } },
    })
    expect(useTokenStore.getState().definitions['d1'].layers.face?.assetId).toBe('face-1')
  })

  it('remove deletes a definition', () => {
    useTokenStore.getState().addOrUpdate({ definitionId: 'd1', ownedBy: 'p1', layers: {} })
    useTokenStore.getState().remove('d1')
    expect(useTokenStore.getState().definitions['d1']).toBeUndefined()
  })

  it('remove is a no-op for unknown id', () => {
    expect(() => useTokenStore.getState().remove('unknown')).not.toThrow()
  })

  it('loadSnapshot replaces all definitions', () => {
    useTokenStore.getState().addOrUpdate({ definitionId: 'old', ownedBy: 'p1', layers: {} })
    useTokenStore.getState().loadSnapshot([
      { definitionId: 'new1', ownedBy: 'p2', layers: {} },
    ])
    expect(useTokenStore.getState().definitions['old']).toBeUndefined()
    expect(useTokenStore.getState().definitions['new1']).toBeDefined()
  })

  it('reset clears all definitions', () => {
    useTokenStore.getState().addOrUpdate({ definitionId: 'd1', ownedBy: 'p1', layers: {} })
    useTokenStore.getState().reset()
    expect(Object.keys(useTokenStore.getState().definitions)).toHaveLength(0)
  })
})
