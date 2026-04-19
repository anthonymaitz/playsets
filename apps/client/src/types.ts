export type FacingDir = 'n' | 'e' | 's' | 'w'
export type AnimationName = 'dance' | 'sleep' | ''
export type WeatherType = 'sunny' | 'cloudy' | 'night' | 'rain'
export type BackgroundType = 'grass' | 'stars' | 'ocean' | 'snow' | 'lava'

export interface SpriteInstance {
  instanceId: string
  spriteId: string
  col: number
  row: number
  placedBy: string
  facing?: FacingDir
  statuses?: string[]
  speech?: string
  animation?: AnimationName
  hidden?: boolean
}

export interface Player {
  playerId: string
  displayName: string
  color: string
}

export interface SpriteManifestEntry {
  id: string
  label: string
  path: string
  hasDirections?: boolean
}

export interface SpriteCategory {
  id: string
  label: string
  sprites: SpriteManifestEntry[]
}

export interface SpriteManifest {
  categories: SpriteCategory[]
}

export type GameMessage =
  | { type: 'state:snapshot'; sprites: SpriteInstance[]; players: Player[] }
  | { type: 'sprite:place'; spriteId: string; col: number; row: number; instanceId: string; placedBy: string }
  | { type: 'sprite:move'; instanceId: string; col: number; row: number }
  | { type: 'sprite:remove'; instanceId: string }
  | { type: 'sprite:emote'; instanceId: string; emote: string }
  | { type: 'sprite:drag'; instanceId: string; col: number; row: number }
  | { type: 'sprite:face'; instanceId: string; facing: FacingDir }
  | { type: 'sprite:status'; instanceId: string; statuses: string[] }
  | { type: 'sprite:speech'; instanceId: string; speech: string }
  | { type: 'sprite:animate'; instanceId: string; animation: AnimationName }
  | { type: 'sprite:hide'; instanceId: string; hidden: boolean }
  | { type: 'cursor:move'; playerId: string; worldX: number; worldZ: number }
  | ({ type: 'player:join' } & Player)
  | { type: 'player:leave'; playerId: string }
