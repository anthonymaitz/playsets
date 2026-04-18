import { create } from 'zustand'
import type { SpriteInstance } from '../types'

interface RoomStore {
  roomId: string | null
  sprites: Record<string, SpriteInstance>
  setRoomId: (id: string) => void
  placeSprite: (s: SpriteInstance) => void
  moveSprite: (instanceId: string, col: number, row: number) => void
  removeSprite: (instanceId: string) => void
  loadSnapshot: (sprites: SpriteInstance[]) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  roomId: null,
  sprites: {},
  setRoomId: (id) => set({ roomId: id }),
  placeSprite: (s) => set((state) => ({ sprites: { ...state.sprites, [s.instanceId]: s } })),
  moveSprite: (instanceId, col, row) =>
    set((state) => {
      if (!state.sprites[instanceId]) return state
      return {
        sprites: { ...state.sprites, [instanceId]: { ...state.sprites[instanceId], col, row } },
      }
    }),
  removeSprite: (instanceId) =>
    set((state) => {
      const next = { ...state.sprites }
      delete next[instanceId]
      return { sprites: next }
    }),
  loadSnapshot: (sprites) =>
    set({ sprites: Object.fromEntries(sprites.map((s) => [s.instanceId, s])) }),
  reset: () => set({ roomId: null, sprites: {} }),
}))
