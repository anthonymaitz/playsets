import { createSignal, onMount, onCleanup } from 'solid-js'
import type { SceneToken } from '../PlaysetsBoardRoot'
import type { BuildManagers, SceneData } from '../PlaysetsBoardRoot'
import type { BuildingTile } from '../types'
import { BuilderToolbar } from './BuilderToolbar'
import { LayerPanel } from './LayerPanel'

export type ToolTab = 'wall' | 'floor' | 'prop' | 'token'

interface Props {
  host: HTMLElement
  scene: SceneData
  managers: BuildManagers
}

const NPC_COLOR_MAP: Record<string, string> = {
  innkeeper: '#2d7a2d',
  blacksmith: '#c07020',
  doorkeeper: '#6040c0',
}

function tokenDataUri(type: string, role?: string): string {
  const color = type === 'door' ? '#cc4444' : (NPC_COLOR_MAP[role ?? ''] ?? '#4488cc')
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96"><rect width="64" height="96" rx="8" fill="${color}"/></svg>`)}`
}

export function BuilderRoot(props: Props) {
  const [selectedTab, setSelectedTab] = createSignal<ToolTab>('wall')
  const [selectedTileId, setSelectedTileId] = createSignal('wall-wood')
  const [buildings, setBuildings] = createSignal<BuildingTile[]>([])
  const [tokens, setTokens] = createSignal<SceneToken[]>([])
  const [weather, setWeather] = createSignal(props.scene.weather ?? 'sunny')

  function isWall(col: number, row: number): boolean {
    return buildings().some(b => b.col === col && b.row === row && b.tileId.includes('wall'))
  }

  onMount(() => {
    const { buildingManager, spriteManager, weatherSystem } = props.managers

    const initBuildings: BuildingTile[] = (props.scene.buildings ?? []).map(b => ({
      instanceId: b.instanceId ?? `${b.col},${b.row}`,
      tileId: b.tileId,
      col: b.col,
      row: b.row,
    }))
    buildingManager.loadSnapshot(initBuildings)
    setBuildings(initBuildings)

    for (const t of props.scene.tokens ?? []) {
      spriteManager.place(
        { instanceId: t.id, spriteId: `tokens/${t.type}`, col: t.col, row: t.row, placedBy: 'builder' },
        tokenDataUri(t.type, t.role),
      )
    }
    setTokens(props.scene.tokens ?? [])

    weatherSystem.setWeather(weather() as Parameters<typeof weatherSystem.setWeather>[0])

    props.host.addEventListener('tokenmove', handleTokenMove)
    props.host.addEventListener('cellclick', handleCellClick)

    onCleanup(() => {
      props.host.removeEventListener('cellclick', handleCellClick)
      props.host.removeEventListener('tokenmove', handleTokenMove)
    })
  })

  function handleCellClick(e: Event) {
    const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail
    const { buildingManager, spriteManager } = props.managers
    const tab = selectedTab()

    if (tab === 'wall' || tab === 'floor') {
      const instanceId = `${x},${y}`
      const tileId = selectedTileId()
      const existing = buildings().find(b => b.col === x && b.row === y)
      if (existing) buildingManager.removeTile(existing.instanceId)
      const tile: BuildingTile = { instanceId, tileId, col: x, row: y }
      buildingManager.placeTile(tile, tileId)
      setBuildings(prev => [...prev.filter(b => !(b.col === x && b.row === y)), tile])
    } else if (tab === 'token') {
      if (isWall(x, y)) return
      const tileId = selectedTileId()
      const [tokenType, tokenRole] = tileId.split(':') as [string, string?]
      const id = `${tokenType}-${x}-${y}`
      const existing = tokens().find(t => t.col === x && t.row === y)
      if (existing) {
        spriteManager.remove(existing.id)
        setTokens(prev => prev.filter(t => t.id !== existing.id))
      }
      const token: SceneToken = {
        id,
        type: tokenType as 'npc' | 'door',
        col: x,
        row: y,
        role: tokenRole as SceneToken['role'],
        name: tokenRole,
      }
      spriteManager.place(
        { instanceId: id, spriteId: `tokens/${tokenType}`, col: x, row: y, placedBy: 'builder' },
        tokenDataUri(tokenType, tokenRole),
      )
      setTokens(prev => [...prev.filter(t => !(t.col === x && t.row === y)), token])
    }
  }

  function handleTokenMove(e: Event) {
    const { id, x, y } = (e as CustomEvent<{ id: string; x: number; y: number }>).detail
    if (isWall(x, y)) return
    props.managers.spriteManager.move(id, x, y)
    setTokens(prev => prev.map(t => t.id === id ? { ...t, col: x, row: y } : t))
  }

  function handleWeatherChange(w: string) {
    setWeather(w)
    props.managers.weatherSystem.setWeather(w as Parameters<typeof props.managers.weatherSystem.setWeather>[0])
  }

  function handleSave() {
    const sceneData: SceneData = {
      buildings: buildings().map(b => ({ col: b.col, row: b.row, tileId: b.tileId, instanceId: b.instanceId })),
      layers: props.scene.layers ?? [],
      props: props.scene.props ?? [],
      tokens: tokens(),
      weather: weather(),
    }
    props.host.dispatchEvent(new CustomEvent('scenechange', { bubbles: true, detail: { scene: sceneData } }))
  }

  return (
    <div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">
      <BuilderToolbar
        selectedTab={selectedTab()}
        onSelectTab={setSelectedTab}
        selectedTileId={selectedTileId()}
        onSelectTileId={setSelectedTileId}
        onSave={handleSave}
      />
      <LayerPanel
        weather={weather()}
        onWeatherChange={handleWeatherChange}
        layerManager={props.managers.layerBackgroundManager}
      />
    </div>
  )
}
