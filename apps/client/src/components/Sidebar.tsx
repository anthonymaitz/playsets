import { useState } from 'react'
import type { SpriteManifestEntry, TileManifestEntry, TileCategory, WeatherType, BackgroundType, PropManifestEntry } from '../types'
import { SpritePicker } from './SpritePicker'
import { PropPicker } from './PropPicker'

type SidebarTab = 'tokens' | 'build' | 'props' | 'roof'

interface BuildPanelProps {
  wallTileId: string
  floorTileId: string
  buildMode: 'build' | 'erase'
  mergeMode: 'open' | 'walled'
  tiles: TileManifestEntry[]
  onWallSelect: (id: string) => void
  onFloorSelect: (id: string) => void
  onBuildModeChange: (m: 'build' | 'erase') => void
  onMergeModeChange: (m: 'open' | 'walled') => void
}

interface Props {
  isHost: boolean
  selectedSpriteId: string | null
  onSpriteSelect: (s: SpriteManifestEntry) => void
  onSpriteDeselect: () => void
  activeWeather: WeatherType
  onWeatherChange: (w: WeatherType) => void
  activeBackground: BackgroundType
  onBackgroundChange: (b: BackgroundType) => void
  onNewToken: () => void
  onBuildingModeChange: (active: boolean) => void
  onRoofModeChange: (active: boolean) => void
  buildPanel: BuildPanelProps
  selectedPropId: string | null
  onPropSelect: (entry: PropManifestEntry) => void
  onPropDeselect: () => void
}

export function Sidebar({
  isHost,
  selectedSpriteId,
  onSpriteSelect,
  onSpriteDeselect,
  activeWeather,
  onWeatherChange,
  activeBackground,
  onBackgroundChange,
  onNewToken,
  onBuildingModeChange,
  onRoofModeChange,
  buildPanel,
  selectedPropId,
  onPropSelect,
  onPropDeselect,
}: Props) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('tokens')

  const handleTabClick = (tab: SidebarTab) => {
    if (tab === activeTab) return
    onBuildingModeChange(tab === 'build')
    onRoofModeChange(tab === 'roof')
    setActiveTab(tab)
  }

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', zIndex: 10 }}>
      {/* Tab strip */}
      <div style={{
        width: 48, background: 'rgba(8,12,8,0.95)', borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 56, gap: 6,
      }}>
        <TabButton icon="🧙" label="Tokens" active={activeTab === 'tokens'} onClick={() => handleTabClick('tokens')} />
        {isHost && (
          <TabButton icon="🏗️" label="Build" active={activeTab === 'build'} onClick={() => handleTabClick('build')} />
        )}
        {isHost && (
          <TabButton icon="🚪" label="Props" active={activeTab === 'props'} onClick={() => handleTabClick('props')} />
        )}
        {isHost && (
          <TabButton icon="🏠" label="Roof" active={activeTab === 'roof'} onClick={() => handleTabClick('roof')} />
        )}
      </div>

      {/* Panel */}
      <div style={{
        width: 220, background: 'rgba(10,15,10,0.92)', borderRight: '1px solid rgba(255,255,255,0.08)',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingTop: 48,
      }}>
        {activeTab === 'tokens' && (
          <>
            <div style={{ padding: '10px 10px 0' }}>
              <button
                onClick={onNewToken}
                style={{
                  width: '100%', padding: '8px 0', borderRadius: 6, border: 'none',
                  background: 'rgba(51,170,68,0.85)', color: '#fff', fontSize: 12,
                  fontWeight: 700, cursor: 'pointer',
                }}
              >
                + New Token
              </button>
            </div>
            <SpritePicker
              selectedSpriteId={selectedSpriteId}
              onSelect={onSpriteSelect}
              onDeselect={onSpriteDeselect}
              activeWeather={activeWeather}
              onWeatherChange={onWeatherChange}
              activeBackground={activeBackground}
              onBackgroundChange={onBackgroundChange}
            />
          </>
        )}
        {activeTab === 'build' && isHost && (
          <BuildPanel {...buildPanel} />
        )}
        {activeTab === 'props' && isHost && (
          <PropPicker
            selectedPropId={selectedPropId}
            onSelect={onPropSelect}
            onDeselect={onPropDeselect}
          />
        )}
        {activeTab === 'roof' && isHost && (
          <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Roof Builder</span>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>
              Click any building tile to add a roof covering its connected structure.
            </p>
            <p style={{ fontSize: 10, color: 'rgba(140,100,220,0.7)', margin: 0, lineHeight: 1.5 }}>
              Tap the purple marker to change tile or toggle visibility.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 36, height: 36, borderRadius: '50%', border: '2px solid',
        borderColor: active ? '#f0a84a' : 'rgba(255,255,255,0.12)',
        background: active ? 'rgba(240,168,74,0.18)' : 'rgba(255,255,255,0.05)',
        cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0,
      }}
    >
      {icon}
    </button>
  )
}

function BuildPanel({ wallTileId, floorTileId, buildMode, mergeMode, tiles, onWallSelect, onFloorSelect, onBuildModeChange, onMergeModeChange }: BuildPanelProps) {
  const byCategory = (cat: TileCategory) => tiles.filter((t) => t.category === cat)

  return (
    <div style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TileRow label="Wall" tiles={byCategory('wall')} selectedId={wallTileId} onSelect={onWallSelect} />
      <TileRow label="Floor" tiles={byCategory('floor')} selectedId={floorTileId} onSelect={onFloorSelect} />
      <div style={{ display: 'flex', gap: 6 }}>
        {(['build', 'erase'] as const).map((m) => (
          <button key={m} onClick={() => onBuildModeChange(m)} style={{
            flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
            borderRadius: 4, background: buildMode === m ? '#c8893a' : 'rgba(255,255,255,0.06)',
            color: buildMode === m ? '#000' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize',
          }}>{m}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['open', 'walled'] as const).map((m) => (
          <button key={m} onClick={() => onMergeModeChange(m)} style={{
            flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
            borderRadius: 4, background: mergeMode === m ? '#5a9a6a' : 'rgba(255,255,255,0.06)',
            color: mergeMode === m ? '#000' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize',
          }}>{m}</button>
        ))}
      </div>
    </div>
  )
}

function TileRow({ label, tiles, selectedId, onSelect }: { label: string; tiles: TileManifestEntry[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {tiles.map((t) => (
          <button key={t.id} onClick={() => onSelect(t.id)} title={t.label} style={{
            width: 36, height: 36, border: '2px solid',
            borderColor: selectedId === t.id ? '#f0a84a' : 'rgba(255,255,255,0.1)',
            borderRadius: 4, background: 'rgba(255,255,255,0.06)', cursor: 'pointer', padding: 2, overflow: 'hidden',
          }}>
            <img src={import.meta.env.BASE_URL + t.path.slice(1)} alt={t.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </button>
        ))}
      </div>
    </div>
  )
}
