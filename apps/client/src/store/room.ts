import { create } from 'zustand'
import type { SpriteInstance, FacingDir, AnimationName, BuildingTile, BuilderProp } from '../types'

interface RoomStore {
  roomId: string | null
  sprites: Record<string, SpriteInstance>
  buildingTiles: Record<string, BuildingTile>
  builderProps: Record<string, BuilderProp>
  setRoomId: (id: string) => void
  placeSprite: (s: SpriteInstance) => void
  moveSprite: (instanceId: string, col: number, row: number) => void
  faceSprite: (instanceId: string, facing: FacingDir) => void
  setStatuses: (instanceId: string, statuses: string[]) => void
  setSpeech: (instanceId: string, speech: string) => void
  setAnimation: (instanceId: string, animation: AnimationName) => void
  setHidden: (instanceId: string, hidden: boolean) => void
  removeSprite: (instanceId: string) => void
  loadSnapshot: (sprites: SpriteInstance[]) => void
  placeTile: (t: BuildingTile) => void
  removeTile: (instanceId: string) => void
  loadBuildingSnapshot: (tiles: BuildingTile[]) => void
  placeProp: (p: BuilderProp) => void
  removeProp: (instanceId: string) => void
  setPropState: (instanceId: string, state: Record<string, string | number | boolean>) => void
  loadPropSnapshot: (props: BuilderProp[]) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  roomId: null,
  sprites: {},
  buildingTiles: {},
  builderProps: {},
  setRoomId: (id) => set({ roomId: id }),
  placeSprite: (s) => set((state) => ({ sprites: { ...state.sprites, [s.instanceId]: s } })),
  moveSprite: (instanceId, col, row) =>
    set((state) => {
      if (!state.sprites[instanceId]) return state
      return {
        sprites: { ...state.sprites, [instanceId]: { ...state.sprites[instanceId], col, row } },
      }
    }),
  faceSprite: (instanceId, facing) =>
    set((state) => {
      if (!state.sprites[instanceId]) return state
      return { sprites: { ...state.sprites, [instanceId]: { ...state.sprites[instanceId], facing } } }
    }),
  setStatuses: (instanceId, statuses) =>
    set((state) => {
      if (!state.sprites[instanceId]) return state
      return { sprites: { ...state.sprites, [instanceId]: { ...state.sprites[instanceId], statuses } } }
    }),
  setSpeech: (instanceId, speech) =>
    set((state) => {
      if (!state.sprites[instanceId]) return state
      return { sprites: { ...state.sprites, [instanceId]: { ...state.sprites[instanceId], speech } } }
    }),
  setAnimation: (instanceId, animation) =>
    set((state) => {
      if (!state.sprites[instanceId]) return state
      return { sprites: { ...state.sprites, [instanceId]: { ...state.sprites[instanceId], animation } } }
    }),
  setHidden: (instanceId, hidden) =>
    set((state) => {
      if (!state.sprites[instanceId]) return state
      return { sprites: { ...state.sprites, [instanceId]: { ...state.sprites[instanceId], hidden } } }
    }),
  removeSprite: (instanceId) =>
    set((state) => {
      const next = { ...state.sprites }
      delete next[instanceId]
      return { sprites: next }
    }),
  loadSnapshot: (sprites) =>
    set({ sprites: Object.fromEntries(sprites.map((s) => [s.instanceId, s])) }),
  placeTile: (t) => set((state) => ({ buildingTiles: { ...state.buildingTiles, [t.instanceId]: t } })),
  removeTile: (instanceId) =>
    set((state) => {
      const next = { ...state.buildingTiles }
      delete next[instanceId]
      return { buildingTiles: next }
    }),
  loadBuildingSnapshot: (tiles) =>
    set({ buildingTiles: Object.fromEntries(tiles.map((t) => [t.instanceId, t])) }),
  placeProp: (p) => set((state) => ({ builderProps: { ...state.builderProps, [p.instanceId]: p } })),
  removeProp: (instanceId) =>
    set((state) => {
      const next = { ...state.builderProps }
      delete next[instanceId]
      return { builderProps: next }
    }),
  setPropState: (instanceId, state) =>
    set((store) => {
      if (!store.builderProps[instanceId]) return store
      return {
        builderProps: {
          ...store.builderProps,
          [instanceId]: { ...store.builderProps[instanceId], state },
        },
      }
    }),
  loadPropSnapshot: (props) =>
    set({ builderProps: Object.fromEntries(props.map((p) => [p.instanceId, p])) }),
  reset: () => set({ roomId: null, sprites: {}, buildingTiles: {}, builderProps: {} }),
}))
