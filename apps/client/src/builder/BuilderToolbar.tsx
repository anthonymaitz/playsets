import type { ToolTab } from './BuilderRoot'

interface TileEntry { id: string; label: string; color: string }

const WALL_TILES: TileEntry[] = [
  { id: 'wall-wood', label: 'Wood Wall', color: '#8B4513' },
  { id: 'wall-stone', label: 'Stone Wall', color: '#888' },
  { id: 'wall-dirt', label: 'Dirt Wall', color: '#7a5c3a' },
]

const FLOOR_TILES: TileEntry[] = [
  { id: 'floor-wood', label: 'Wood Floor', color: '#c8a05a' },
  { id: 'floor-stone', label: 'Stone Floor', color: '#aaa' },
  { id: 'floor-dirt', label: 'Dirt Floor', color: '#9e7a4a' },
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

const TABS: { id: ToolTab; label: string; emoji: string }[] = [
  { id: 'wall', label: 'Walls', emoji: '🏗️' },
  { id: 'floor', label: 'Floors', emoji: '🟫' },
  { id: 'prop', label: 'Props', emoji: '🚪' },
  { id: 'token', label: 'Tokens', emoji: '🧙' },
]

interface Props {
  selectedTab: ToolTab
  onSelectTab: (tab: ToolTab) => void
  selectedTileId: string
  onSelectTileId: (id: string) => void
  buildMode: 'build' | 'erase'
  onBuildModeChange: (m: 'build' | 'erase') => void
  mergeMode: 'open' | 'walled'
  onMergeModeChange: (m: 'open' | 'walled') => void
  onSave: () => void
}

function firstTileForTab(tab: ToolTab): string {
  if (tab === 'wall') return WALL_TILES[0]?.id ?? ''
  if (tab === 'floor') return FLOOR_TILES[0]?.id ?? ''
  if (tab === 'prop') return PROP_TILES[0]?.id ?? ''
  return TOKEN_TILES[0]?.id ?? ''
}

export function BuilderToolbar(props: Props) {
  const isBuildTab = () => props.selectedTab === 'wall' || props.selectedTab === 'floor'

  return (
    <div style="position:absolute;top:0;left:0;height:100%;width:160px;background:rgba(10,15,10,0.92);border-right:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;pointer-events:all;z-index:10;">
      {/* Tab strip */}
      <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
        {TABS.map((tab) => (
          <button
            onClick={() => { props.onSelectTab(tab.id); props.onSelectTileId(firstTileForTab(tab.id)) }}
            title={tab.label}
            style={`flex:1;padding:10px 2px;font-size:16px;cursor:pointer;background:${props.selectedTab === tab.id ? 'rgba(240,168,74,0.18)' : 'transparent'};color:#fff;border:none;border-bottom:2px solid ${props.selectedTab === tab.id ? '#f0a84a' : 'transparent'};`}
          >
            {tab.emoji}
          </button>
        ))}
      </div>

      {/* Build/Erase toggle — only shown for wall/floor tabs */}
      {isBuildTab() && (
        <div style="display:flex;gap:4px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
          {(['build', 'erase'] as const).map(m => (
            <button
              onClick={() => props.onBuildModeChange(m)}
              style={`flex:1;padding:4px 0;font-size:10px;font-weight:700;cursor:pointer;border:none;border-radius:3px;background:${props.buildMode === m ? '#c8893a' : 'rgba(255,255,255,0.06)'};color:${props.buildMode === m ? '#000' : 'rgba(255,255,255,0.5)'};text-transform:capitalize;`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Tile list */}
      <div style="flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:5px;min-height:0;">
        {ALL_TILES.map(({ entry: tile, tab }) => (
          <button
            onClick={() => props.onSelectTileId(tile.id)}
            style={`padding:6px;display:${props.selectedTab === tab ? 'flex' : 'none'};align-items:center;gap:6px;background:${props.selectedTileId === tile.id ? 'rgba(240,168,74,0.18)' : 'rgba(255,255,255,0.04)'};border:1px solid ${props.selectedTileId === tile.id ? '#f0a84a' : 'rgba(255,255,255,0.08)'};color:#fff;cursor:pointer;border-radius:4px;width:100%;text-align:left;`}
          >
            <div style={`width:24px;height:24px;background:${tile.color};border-radius:3px;flex-shrink:0;`} />
            <span style="font-size:11px;">{tile.label}</span>
          </button>
        ))}
      </div>

      {/* Save */}
      <div style="padding:8px;border-top:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
        <button
          onClick={props.onSave}
          style="width:100%;padding:8px;background:#2d6a2d;color:#fff;border:none;cursor:pointer;border-radius:4px;font-size:12px;font-weight:700;"
        >
          Save Scene
        </button>
      </div>
    </div>
  )
}
