import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Player } from '../types'

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']

interface PlayersStore {
  localPlayer: Player
  players: Player[]
  setDisplayName: (name: string) => void
  addPlayer: (p: Player) => void
  removePlayer: (playerId: string) => void
  loadPlayers: (players: Player[]) => void
  reset: () => void
}

function makeLocalPlayer(): Player {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('playsets-player')
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Player>
      if (parsed.playerId && parsed.displayName !== undefined && parsed.color) {
        return parsed as Player
      }
    }
  }
  const player: Player = {
    playerId: nanoid(),
    displayName: '',
    color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('playsets-player', JSON.stringify(player))
  }
  return player
}

export const usePlayersStore = create<PlayersStore>((set, get) => ({
  localPlayer: makeLocalPlayer(),
  players: [],
  setDisplayName: (name) => {
    const updated = { ...get().localPlayer, displayName: name }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('playsets-player', JSON.stringify(updated))
    }
    set({ localPlayer: updated })
  },
  addPlayer: (p) => set((s) => ({ players: [...s.players.filter((x) => x.playerId !== p.playerId), p] })),
  removePlayer: (id) => set((s) => ({ players: s.players.filter((p) => p.playerId !== id) })),
  loadPlayers: (players) => set({ players }),
  reset: () => set({ players: [] }),
}))
