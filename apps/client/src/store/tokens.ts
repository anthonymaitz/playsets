import { create } from 'zustand'
import type { TokenDefinition } from '../types'

interface TokenStore {
  definitions: Record<string, TokenDefinition>
  addOrUpdate: (def: TokenDefinition) => void
  remove: (definitionId: string) => void
  loadSnapshot: (defs: TokenDefinition[]) => void
  reset: () => void
}

export const useTokenStore = create<TokenStore>((set) => ({
  definitions: {},
  addOrUpdate: (def) => {
    if (!def.definitionId) return
    set((s) => ({ definitions: { ...s.definitions, [def.definitionId]: def } }))
  },
  remove: (definitionId) =>
    set((s) => {
      const next = { ...s.definitions }
      delete next[definitionId]
      return { definitions: next }
    }),
  loadSnapshot: (defs) =>
    set({ definitions: Object.fromEntries(defs.map((d) => [d.definitionId, d])) }),
  reset: () => set({ definitions: {} }),
}))
