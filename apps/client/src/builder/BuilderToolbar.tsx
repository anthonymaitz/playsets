import type { ToolTab } from './BuilderRoot'

interface TileEntry { id: string; label: string; color: string }

const WALL_TILES: TileEntry[] = [
  { id: 'wall-wood', label: 'Wood Wall', color: '#8B4513' },
  { id: 'wall-stone', label: 'Stone Wall', color: '#888' },
]

const FLOOR_TILES: TileEntry[] = [
  { id: 'floor-wood', label: 'Wood Floor', color: '#c8a05a' },
  { id: 'floor-stone', label: 'Stone Floor', color: '#aaa' },
]

const PROP_TILES: TileEntry[] = [
  { id: 'bartop', label: 'Bar Top', color: '#7b4f1a' },
  { id: 'rug', label: 'Rug', color: '#8b2020' },
]

const TOKEN_TILES: TileEntry[] = [
  { id: 'npc:innkeeper', label: 'Innkeeper', color: '#2d7a2d' },
  { id: 'npc:blacksmith', label: 'Blacksmith', color: '#c07020' },
  { id: 'npc:doorkeeper', label: 'Doorkeeper', color: '#6040c0' },
  { id: 'door:', label: 'Door', color: '#cc4444' },
]

const ALL_TILES: Array<{ entry: TileEntry; tab: ToolTab }> = [
  ...WALL_TILES.map(e => ({ entry: e, tab: 'wall' as ToolTab })),
  ...FLOOR_TILES.map(e => ({ entry: e, tab: 'floor' as ToolTab })),
  ...PROP_TILES.map(e => ({ entry: e, tab: 'prop' as ToolTab })),
  ...TOKEN_TILES.map(e => ({ entry: e, tab: 'token' as ToolTab })),
]

const TABS: { id: ToolTab; label: string }[] = [
  { id: 'wall', label: 'Walls' },
  { id: 'floor', label: 'Floors' },
  { id: 'prop', label: 'Props' },
  { id: 'token', label: 'Tokens' },
]

interface Props {
  selectedTab: ToolTab
  onSelectTab: (tab: ToolTab) => void
  selectedTileId: string
  onSelectTileId: (id: string) => void
  onSave: () => void
}

function firstTileForTab(tab: ToolTab): string {
  if (tab === 'wall') return WALL_TILES[0]?.id ?? ''
  if (tab === 'floor') return FLOOR_TILES[0]?.id ?? ''
  if (tab === 'prop') return PROP_TILES[0]?.id ?? ''
  return TOKEN_TILES[0]?.id ?? ''
}

export function BuilderToolbar(props: Props) {
  return (
    <div style="position:absolute;top:0;left:0;height:100%;width:160px;background:rgba(20,20,20,0.88);display:flex;flex-direction:column;pointer-events:all;z-index:10;">
      <div style="display:flex;border-bottom:1px solid #444;flex-shrink:0;">
        {TABS.map((tab) => (
          <button
            onClick={() => { props.onSelectTab(tab.id); props.onSelectTileId(firstTileForTab(tab.id)) }}
            style={`flex:1;padding:6px 2px;font-size:10px;cursor:pointer;background:${props.selectedTab === tab.id ? '#444' : 'transparent'};color:#fff;border:none;`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style="flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;min-height:0;">
        {ALL_TILES.map(({ entry: tile, tab }) => (
          <button
            onClick={() => props.onSelectTileId(tile.id)}
            style={`padding:6px;display:${props.selectedTab === tab ? 'flex' : 'none'};align-items:center;gap:6px;background:${props.selectedTileId === tile.id ? '#555' : '#333'};border:1px solid ${props.selectedTileId === tile.id ? '#aaa' : 'transparent'};color:#fff;cursor:pointer;border-radius:4px;`}
          >
            <div style={`width:20px;height:20px;background:${tile.color};border-radius:3px;flex-shrink:0;`} />
            <span style="font-size:11px;">{tile.label}</span>
          </button>
        ))}
      </div>

      <div style="padding:8px;border-top:1px solid #444;flex-shrink:0;">
        <button
          onClick={props.onSave}
          style="width:100%;padding:8px;background:#2d6a2d;color:#fff;border:none;cursor:pointer;border-radius:4px;font-size:13px;"
        >
          Save
        </button>
      </div>
    </div>
  )
}
