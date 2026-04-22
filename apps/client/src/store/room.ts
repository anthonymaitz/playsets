import { create } from 'zustand'
import type { SpriteInstance, FacingDir, AnimationName, BuildingTile, BuilderProp, Roof, LayerConfig } from '../types'

export const DEFAULT_LAYER_CONFIGS: Record<number, LayerConfig> = Object.fromEntries(
  Array.from({ length: 9 }, (_, i) => i + 1).map((i) => [
    i,
    { background: i === 1 ? 'dirt' : i === 5 ? 'grass' : 'transparent', visible: true },
  ])
)

interface RoomStore {
  roomId: string | null
  sprites: Record<string, SpriteInstance>
  buildingTiles: Record<string, BuildingTile>
  builderProps: Record<string, BuilderProp>
  roofs: Record<string, Roof>
  layers: Record<number, LayerConfig>
  setRoomId: (id: string) => void
  placeSprite: (s: SpriteInstance) => void
  moveSprite: (instanceId: string, col: number, row: number, layerIndex?: number) => void
  faceSprite: (instanceId: string, facing: FacingDir) => void
  setStatuses: (instanceId: string, statuses: string[]) => void
  setSpeech: (instanceId: string, speech: string) => void
  setAnimation: (instanceId: string, animation: AnimationName) => void
  setHidden: (instanceId: string, hidden: boolean) => void
  removeSprite: (instanceId: string) => void
  setZOrder: (instanceId: string, zOrder: number) => void
  loadSnapshot: (sprites: SpriteInstance[]) => void
  placeTile: (t: BuildingTile) => void
  removeTile: (instanceId: string) => void
  loadBuildingSnapshot: (tiles: BuildingTile[]) => void
  placeProp: (p: BuilderProp) => void
  removeProp: (instanceId: string) => void
  setPropState: (instanceId: string, state: Record<string, string | number | boolean>) => void
  loadPropSnapshot: (props: BuilderProp[]) => void
  setPropZOrder: (instanceId: string, zOrder: number) => void
  moveProp: (instanceId: string, col: number, row: number) => void
  placeRoof: (r: Roof) => void
  removeRoof: (instanceId: string) => void
  setRoofVisible: (instanceId: string, visible: boolean) => void
  setRoofTile: (instanceId: string, tileId: string) => void
  loadRoofSnapshot: (roofs: Roof[]) => void
  updateLayerConfig: (layerIndex: number, patch: Partial<LayerConfig>) => void
  loadLayerSnapshot: (configs: Record<number, LayerConfig>) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  roomId: null,
  sprites: {},
  buildingTiles: {},
  builderProps: {},
  roofs: {},
  layers: { ...DEFAULT_LAYER_CONFIGS },
  setRoomId: (id) => set({ roomId: id }),
  placeSprite: (s) => set((state) => ({ sprites: { ...state.sprites, [s.instanceId]: s } })),
  moveSprite: (instanceId, col, row, layerIndex) =>
    set((state) => {
      if (!state.sprites[instanceId]) return state
      const updated: SpriteInstance = { ...state.sprites[instanceId], col, row }
      if (layerIndex !== undefined) updated.layerIndex = layerIndex
      return { sprites: { ...state.sprites, [instanceId]: updated } }
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
  setZOrder: (instanceId, zOrder) =>
    set((state) => {
      if (!state.sprites[instanceId]) return state
      return { sprites: { ...state.sprites, [instanceId]: { ...state.sprites[instanceId], zOrder } } }
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
  setPropZOrder: (instanceId, zOrder) =>
    set((store) => {
      if (!store.builderProps[instanceId]) return store
      return {
        builderProps: {
          ...store.builderProps,
          [instanceId]: { ...store.builderProps[instanceId], zOrder },
        },
      }
    }),
  moveProp: (instanceId, col, row) =>
    set((store) => {
      if (!store.builderProps[instanceId]) return store
      return {
        builderProps: {
          ...store.builderProps,
          [instanceId]: { ...store.builderProps[instanceId], col, row },
        },
      }
    }),
  placeRoof: (r) => set((state) => ({ roofs: { ...state.roofs, [r.instanceId]: r } })),
  removeRoof: (instanceId) =>
    set((state) => {
      const next = { ...state.roofs }
      delete next[instanceId]
      return { roofs: next }
    }),
  setRoofVisible: (instanceId, visible) =>
    set((state) => {
      if (!state.roofs[instanceId]) return state
      return { roofs: { ...state.roofs, [instanceId]: { ...state.roofs[instanceId], visible } } }
    }),
  setRoofTile: (instanceId, tileId) =>
    set((state) => {
      if (!state.roofs[instanceId]) return state
      return { roofs: { ...state.roofs, [instanceId]: { ...state.roofs[instanceId], tileId } } }
    }),
  loadRoofSnapshot: (roofs) =>
    set({ roofs: Object.fromEntries(roofs.map((r) => [r.instanceId, r])) }),
  updateLayerConfig: (layerIndex, patch) =>
    set((state) => {
      if (!state.layers[layerIndex]) return state
      const cleanPatch = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      ) as Partial<LayerConfig>
      return {
        layers: {
          ...state.layers,
          [layerIndex]: { ...state.layers[layerIndex], ...cleanPatch },
        },
      }
    }),
  loadLayerSnapshot: (configs) => set({ layers: configs }),
  reset: () => set({ roomId: null, sprites: {}, buildingTiles: {}, builderProps: {}, roofs: {}, layers: { ...DEFAULT_LAYER_CONFIGS } }),
}))
