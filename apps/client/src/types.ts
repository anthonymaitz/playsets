export interface SpriteInstance {
  instanceId: string
  spriteId: string
  col: number
  row: number
  placedBy: string
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
  | { type: 'cursor:move'; playerId: string; worldX: number; worldZ: number }
  | ({ type: 'player:join' } & Player)
  | { type: 'player:leave'; playerId: string }
