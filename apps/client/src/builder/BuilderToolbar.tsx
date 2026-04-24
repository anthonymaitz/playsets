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

const TABS: { id: ToolTab; label: string }[] = [
  { id: 'wall', label: 'Walls' },
  { id: 'floor', label: 'Floors' },
  { id: 'prop', label: 'Props' },
  { id: 'token', label: 'Tokens' },
]

function tilesForTab(tab: ToolTab): TileEntry[] {
  if (tab === 'wall') return WALL_TILES
  if (tab === 'floor') return FLOOR_TILES
  if (tab === 'prop') return PROP_TILES
  return TOKEN_TILES
}

interface Props {
  selectedTab: ToolTab
  onSelectTab: (tab: ToolTab) => void
  selectedTileId: string
  onSelectTileId: (id: string) => void
  onSave: () => void
}

export function BuilderToolbar(props: Props) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, height: '100%', width: '160px',
      background: 'rgba(20,20,20,0.88)', display: 'flex', flexDirection: 'column',
      pointerEvents: 'all', zIndex: 10,
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #444' }}>
        {TABS.map((tab) => (
          <button
            onClick={() => { props.onSelectTab(tab.id); props.onSelectTileId(tilesForTab(tab.id)[0]?.id ?? '') }}
            style={{
              flex: 1, padding: '6px 2px', fontSize: '10px', cursor: 'pointer',
              background: props.selectedTab === tab.id ? '#444' : 'transparent',
              color: '#fff', border: 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {tilesForTab(props.selectedTab).map((tile) => (
          <button
            onClick={() => props.onSelectTileId(tile.id)}
            style={{
              padding: '6px', display: 'flex', alignItems: 'center', gap: '6px',
              background: props.selectedTileId === tile.id ? '#555' : '#333',
              border: props.selectedTileId === tile.id ? '1px solid #aaa' : '1px solid transparent',
              color: '#fff', cursor: 'pointer', borderRadius: '4px',
            }}
          >
            <div style={{ width: '20px', height: '20px', background: tile.color, borderRadius: '3px', flexShrink: 0 }} />
            <span style={{ fontSize: '11px' }}>{tile.label}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: '8px', borderTop: '1px solid #444' }}>
        <button
          onClick={props.onSave}
          style={{
            width: '100%', padding: '8px', background: '#2d6a2d', color: '#fff',
            border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '13px',
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
