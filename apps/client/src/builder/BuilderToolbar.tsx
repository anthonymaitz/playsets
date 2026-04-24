export type ToolTab = 'build' | 'token' | 'prop'

interface TileEntry { id: string; label: string; color: string }

const WALL_TILES: TileEntry[] = [
  { id: 'wall-wood', label: 'Wood', color: '#8B4513' },
  { id: 'wall-stone', label: 'Stone', color: '#888' },
  { id: 'wall-dirt', label: 'Dirt', color: '#7a5c3a' },
]

const FLOOR_TILES: TileEntry[] = [
  { id: 'floor-wood', label: 'Wood', color: '#c8a05a' },
  { id: 'floor-stone', label: 'Stone', color: '#aaa' },
  { id: 'floor-dirt', label: 'Dirt', color: '#9e7a4a' },
]

const TOKEN_TILES: TileEntry[] = [
  { id: 'npc:innkeeper', label: 'Innkeeper', color: '#2d7a2d' },
  { id: 'npc:blacksmith', label: 'Blacksmith', color: '#c07020' },
  { id: 'npc:doorkeeper', label: 'Doorkeeper', color: '#6040c0' },
  { id: 'door:', label: 'Door', color: '#cc4444' },
]

const PROP_TILES: TileEntry[] = [
  { id: 'door-wood', label: 'Door', color: '#8B5E3C' },
  { id: 'window-wood', label: 'Window', color: '#6BA3BE' },
  { id: 'painting', label: 'Painting', color: '#C8A415' },
  { id: 'rug', label: 'Rug', color: '#A83228' },
  { id: 'bartop', label: 'Bar Top', color: '#7A5C3A' },
]

const WEATHER_OPTIONS = [
  { id: 'sunny', label: 'Sunny', icon: '☀' },
  { id: 'cloudy', label: 'Cloudy', icon: '☁' },
  { id: 'night', label: 'Night', icon: '🌙' },
  { id: 'rain', label: 'Rain', icon: '🌧' },
]

const TABS: { id: ToolTab; label: string; emoji: string }[] = [
  { id: 'build', label: 'Build', emoji: '🏗' },
  { id: 'token', label: 'Tokens', emoji: '🧙' },
  { id: 'prop', label: 'Props', emoji: '🚪' },
]

interface Props {
  selectedTab: ToolTab
  onSelectTab: (tab: ToolTab) => void
  wallTileId: string
  onWallSelect: (id: string) => void
  floorTileId: string
  onFloorSelect: (id: string) => void
  selectedTokenId: string
  onTokenSelect: (id: string) => void
  onTokenPointerDown: (tokenId: string, e: PointerEvent) => void
  selectedPropId: string
  onPropSelect: (id: string) => void
  buildMode: 'build' | 'erase'
  onBuildModeChange: (m: 'build' | 'erase') => void
  weather: string
  onWeatherChange: (w: string) => void
  onSave: () => void
}

function TileRow(p: { label: string; tiles: TileEntry[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div style="margin-bottom:8px;">
      <div style="font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
        {p.label}
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        {p.tiles.map(tile => (
          <button
            onClick={() => p.onSelect(tile.id)}
            title={tile.label}
            style={`width:36px;height:36px;border:2px solid ${p.selectedId === tile.id ? '#f0a84a' : 'rgba(255,255,255,0.1)'};border-radius:4px;background:${p.selectedId === tile.id ? 'rgba(240,168,74,0.18)' : 'rgba(255,255,255,0.05)'};cursor:pointer;padding:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;`}
          >
            <div style={`width:22px;height:22px;background:${tile.color};border-radius:2px;`} />
            <span style="font-size:7px;color:rgba(255,255,255,0.55);line-height:1;">{tile.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function BuilderToolbar(props: Props) {
  return (
    <div style="position:absolute;top:0;left:0;height:100%;width:160px;background:rgba(10,15,10,0.92);border-right:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;pointer-events:all;z-index:10;">
      {/* Tab strip */}
      <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
        {TABS.map(tab => (
          <button
            onClick={() => props.onSelectTab(tab.id)}
            title={tab.label}
            style={`flex:1;padding:10px 2px;font-size:16px;cursor:pointer;background:${props.selectedTab === tab.id ? 'rgba(240,168,74,0.18)' : 'transparent'};color:#fff;border:none;border-bottom:2px solid ${props.selectedTab === tab.id ? '#f0a84a' : 'transparent'};`}
          >
            {tab.emoji}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style="flex:1;overflow-y:auto;padding:10px 8px;min-height:0;">

        {/* Build tab */}
        {props.selectedTab === 'build' && (
          <div>
            {/* Build / Erase toggle */}
            <div style="display:flex;gap:4px;margin-bottom:10px;">
              {(['build', 'erase'] as const).map(m => (
                <button
                  onClick={() => props.onBuildModeChange(m)}
                  style={`flex:1;padding:5px 0;font-size:10px;font-weight:700;cursor:pointer;border:none;border-radius:3px;background:${props.buildMode === m ? '#c8893a' : 'rgba(255,255,255,0.06)'};color:${props.buildMode === m ? '#000' : 'rgba(255,255,255,0.5)'};text-transform:capitalize;`}
                >
                  {m}
                </button>
              ))}
            </div>

            <TileRow
              label="Wall"
              tiles={WALL_TILES}
              selectedId={props.wallTileId}
              onSelect={props.onWallSelect}
            />
            <TileRow
              label="Floor"
              tiles={FLOOR_TILES}
              selectedId={props.floorTileId}
              onSelect={props.onFloorSelect}
            />

            {/* Weather */}
            <div style="margin-top:10px;">
              <div style="font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
                Weather
              </div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;">
                {WEATHER_OPTIONS.map(w => (
                  <button
                    onClick={() => props.onWeatherChange(w.id)}
                    title={w.label}
                    style={`width:36px;height:36px;border:2px solid ${props.weather === w.id ? '#f0a84a' : 'rgba(255,255,255,0.1)'};border-radius:4px;background:${props.weather === w.id ? 'rgba(240,168,74,0.18)' : 'rgba(255,255,255,0.05)'};cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;`}
                  >
                    {w.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Token tab */}
        {props.selectedTab === 'token' && (
          <div>
            <p style="font-size:9px;color:rgba(255,255,255,0.35);margin:0 0 6px;">Drag onto board or tap to select, then click board</p>
            <div style="display:flex;flex-direction:column;gap:5px;">
              {TOKEN_TILES.map(tile => (
                <button
                  onPointerDown={(e) => { props.onTokenSelect(tile.id); props.onTokenPointerDown(tile.id, e) }}
                  style={`padding:6px;display:flex;align-items:center;gap:6px;background:${props.selectedTokenId === tile.id ? 'rgba(240,168,74,0.18)' : 'rgba(255,255,255,0.04)'};border:1px solid ${props.selectedTokenId === tile.id ? '#f0a84a' : 'rgba(255,255,255,0.08)'};color:#fff;cursor:grab;border-radius:4px;width:100%;text-align:left;`}
                >
                  <div style={`width:24px;height:24px;background:${tile.color};border-radius:3px;flex-shrink:0;`} />
                  <span style="font-size:11px;">{tile.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prop tab */}
        {props.selectedTab === 'prop' && (
          <div>
            <p style="font-size:9px;color:rgba(255,255,255,0.35);margin:0 0 6px;">Select a prop, then click on the board to place it</p>
            <div style="display:flex;flex-direction:column;gap:5px;">
              {PROP_TILES.map(tile => (
                <button
                  onClick={() => props.onPropSelect(tile.id)}
                  style={`padding:6px;display:flex;align-items:center;gap:6px;background:${props.selectedPropId === tile.id ? 'rgba(240,168,74,0.18)' : 'rgba(255,255,255,0.04)'};border:1px solid ${props.selectedPropId === tile.id ? '#f0a84a' : 'rgba(255,255,255,0.08)'};color:#fff;cursor:pointer;border-radius:4px;width:100%;text-align:left;`}
                >
                  <div style={`width:24px;height:24px;background:${tile.color};border-radius:3px;flex-shrink:0;`} />
                  <span style="font-size:11px;">{tile.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
