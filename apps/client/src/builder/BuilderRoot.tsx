import { createSignal, onMount, onCleanup } from 'solid-js'
import { PointerEventTypes, Vector3, Matrix } from '@babylonjs/core'
import type { BuildManagers, SceneData, SceneToken } from '../PlaysetsBoardRoot'
import type { BuildingTile } from '../types'
import { worldToCell } from '../babylon/grid'
import { normalizeRect } from '../babylon/buildingUtils'
import { BuilderToolbar } from './BuilderToolbar'
import { LayerPanel } from './LayerPanel'

export type ToolTab = 'wall' | 'floor' | 'prop' | 'token'

interface ScreenCorners {
  nw: { x: number; y: number }
  ne: { x: number; y: number }
  sw: { x: number; y: number }
  se: { x: number; y: number }
  center: { x: number; y: number }
  width: number
  height: number
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

interface Props {
  host: HTMLElement
  scene: SceneData
  managers: BuildManagers
}

export function BuilderRoot(props: Props) {
  const [selectedTab, setSelectedTab] = createSignal<ToolTab>('wall')
  const [selectedTileId, setSelectedTileId] = createSignal('wall-wood')
  const [buildMode, setBuildMode] = createSignal<'build' | 'erase'>('build')
  const [mergeMode, setMergeMode] = createSignal<'open' | 'walled'>('open')
  const [buildings, setBuildings] = createSignal<BuildingTile[]>([])
  const [tokens, setTokens] = createSignal<SceneToken[]>([])
  const [weather, setWeather] = createSignal(props.scene.weather ?? 'sunny')
  const [screenCorners, setScreenCorners] = createSignal<ScreenCorners | null>(null)

  let previewEnd: { col: number; row: number } | null = null
  let draggingCorner: 'nw' | 'ne' | 'sw' | 'se' | null = null
  let isDragPreview = false

  function wallPath(id: string) { return `/assets/tiles/${id}.svg` }
  function floorPath(id: string) { return `/assets/tiles/${id}.svg` }

  function isWall(col: number, row: number): boolean {
    return buildings().some(b => b.col === col && b.row === row && b.tileId.includes('wall'))
  }

  function projectCorners(): ScreenCorners | null {
    const { bjsScene, bjsCamera, buildingManager } = props.managers
    const end = previewEnd
    if (!end) return null
    const worldCorners = buildingManager.getPreviewWorldCorners(end.col, end.row)
    if (!worldCorners) return null

    const engine = bjsScene.getEngine()
    const viewport = bjsCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    const transform = bjsScene.getTransformMatrix()
    const canvas = engine.getRenderingCanvas()
    if (!canvas) return null
    const canvasBounds = canvas.getBoundingClientRect()
    const scaleX = canvasBounds.width / engine.getRenderWidth()
    const scaleY = canvasBounds.height / engine.getRenderHeight()

    const project = (v: Vector3) => {
      const s = Vector3.Project(v, Matrix.Identity(), transform, viewport)
      return { x: s.x * scaleX + canvasBounds.left, y: s.y * scaleY + canvasBounds.top }
    }

    const previewRect = buildingManager.getPreviewStart()
    if (!previewRect) return null
    const { minCol, minRow, maxCol, maxRow } = normalizeRect({
      startCol: previewRect.startCol,
      startRow: previewRect.startRow,
      endCol: end.col,
      endRow: end.row,
    })

    return {
      nw: project(worldCorners.nw),
      ne: project(worldCorners.ne),
      sw: project(worldCorners.sw),
      se: project(worldCorners.se),
      center: project(worldCorners.center),
      width: maxCol - minCol + 1,
      height: maxRow - minRow + 1,
    }
  }

  onMount(() => {
    const { buildingManager, spriteManager, weatherSystem, bjsScene } = props.managers

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

    // Update screen corners every frame when preview is active
    const renderObserver = bjsScene.onBeforeRenderObservable.add(() => {
      if (previewEnd) setScreenCorners(projectCorners())
      else setScreenCorners(null)
    })

    // Scene pointer observer for build/erase/token placement
    const pointerObserver = bjsScene.onPointerObservable.add((info) => {
      const tab = selectedTab()

      // Only pick non-sprite meshes to avoid conflicts with DragController
      const isBuildSurface = (m: { name: string }) =>
        m.name === 'ground' || m.name.startsWith('building-') || m.name.startsWith('preview-')

      if (info.type === PointerEventTypes.POINTERDOWN) {
        const pick = bjsScene.pick(bjsScene.pointerX, bjsScene.pointerY, isBuildSurface)
        if (!pick.hit || !pick.pickedPoint) return
        const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)

        if ((tab === 'wall' || tab === 'floor') && buildMode() === 'build') {
          isDragPreview = true
          buildingManager.beginPreview(col, row)
          buildingManager.updatePreview(col, row, wallPath(selectedWallId()), floorPath(selectedFloorId()))
          previewEnd = { col, row }
        } else if ((tab === 'wall' || tab === 'floor') && buildMode() === 'erase') {
          const existing = buildings().find(b => b.col === col && b.row === row)
          if (existing) {
            buildingManager.removeTile(existing.instanceId)
            setBuildings(prev => prev.filter(b => b.instanceId !== existing.instanceId))
          }
        }
      }

      if (info.type === PointerEventTypes.POINTERMOVE && isDragPreview) {
        if (draggingCorner) return
        const pick = bjsScene.pick(bjsScene.pointerX, bjsScene.pointerY, isBuildSurface)
        if (!pick.hit || !pick.pickedPoint) return
        const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
        buildingManager.updatePreview(col, row, wallPath(selectedWallId()), floorPath(selectedFloorId()))
        previewEnd = { col, row }
      }

      if (info.type === PointerEventTypes.POINTERUP) {
        isDragPreview = false
        // Token placement on click (not drag)
        if (tab === 'token') {
          const pick = bjsScene.pick(bjsScene.pointerX, bjsScene.pointerY, isBuildSurface)
          if (pick.hit && pick.pickedPoint) {
            const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
            handleTokenClick(col, row)
          }
        }
      }
    })

    // Corner drag — window-level so mouse can leave canvas
    const onWindowMove = (e: PointerEvent) => {
      const bm = buildingManager
      const scene = bjsScene
      const canvas = scene.getEngine().getRenderingCanvas()
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const pick = scene.pick(e.clientX - rect.left, e.clientY - rect.top)
      if (!pick.hit || !pick.pickedPoint) return
      const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)

      if (draggingCorner) {
        bm.updatePreview(col, row, wallPath(selectedWallId()), floorPath(selectedFloorId()))
        previewEnd = { col, row }
      }
    }
    const onWindowUp = () => { draggingCorner = null }
    window.addEventListener('pointermove', onWindowMove)
    window.addEventListener('pointerup', onWindowUp)

    // Token placement via host events
    props.host.addEventListener('tokenmove', handleTokenMove)

    onCleanup(() => {
      bjsScene.onPointerObservable.remove(pointerObserver)
      bjsScene.onBeforeRenderObservable.remove(renderObserver)
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('pointerup', onWindowUp)
      props.host.removeEventListener('tokenmove', handleTokenMove)
    })
  })

  function selectedWallId() {
    const tab = selectedTab()
    if (tab === 'wall') return selectedTileId()
    return 'wall-wood'
  }

  function selectedFloorId() {
    const tab = selectedTab()
    if (tab === 'floor') return selectedTileId()
    return 'floor-dirt'
  }

  function handlePlaceRoom() {
    const { buildingManager } = props.managers
    const end = previewEnd
    if (!end) return

    const existingMap: Record<string, BuildingTile> = {}
    for (const b of buildings()) existingMap[b.instanceId] = b

    const { tiles, removedIds } = buildingManager.commitPreview(
      end.col, end.row,
      selectedWallId(), selectedFloorId(),
      existingMap, mergeMode(),
    )

    previewEnd = null
    setScreenCorners(null)

    setBuildings(prev => {
      const filtered = prev.filter(b => !removedIds.includes(b.instanceId))
      return [...filtered, ...tiles]
    })
  }

  function handleTokenClick(col: number, row: number) {
    if (isWall(col, row)) return
    const tileId = selectedTileId()
    const [tokenType, tokenRole] = tileId.split(':') as [string, string?]
    const id = `${tokenType}-${col}-${row}`
    const existing = tokens().find(t => t.col === col && t.row === row)
    if (existing) {
      props.managers.spriteManager.remove(existing.id)
      setTokens(prev => prev.filter(t => t.id !== existing.id))
    }
    const token: SceneToken = {
      id, type: tokenType as 'npc' | 'door', col, row,
      role: tokenRole as SceneToken['role'], name: tokenRole,
    }
    props.managers.spriteManager.place(
      { instanceId: id, spriteId: `tokens/${tokenType}`, col, row, placedBy: 'builder' },
      tokenDataUri(tokenType, tokenRole),
    )
    setTokens(prev => [...prev.filter(t => !(t.col === col && t.row === row)), token])
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

  function handleCornerDragStart(corner: 'nw' | 'ne' | 'sw' | 'se') {
    const bm = props.managers.buildingManager
    const previewRect = bm.getPreviewStart()
    const end = previewEnd
    if (bm && previewRect && end) {
      const { minCol, minRow, maxCol, maxRow } = normalizeRect({
        startCol: previewRect.startCol, startRow: previewRect.startRow,
        endCol: end.col, endRow: end.row,
      })
      const opposites = {
        nw: { col: maxCol, row: maxRow },
        ne: { col: minCol, row: maxRow },
        sw: { col: maxCol, row: minRow },
        se: { col: minCol, row: minRow },
      }
      bm.setPreviewStart(opposites[corner].col, opposites[corner].row)
    }
    draggingCorner = corner
  }

  const HANDLE_SIZE = 16

  return (
    <div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">
      <BuilderToolbar
        selectedTab={selectedTab()}
        onSelectTab={(tab) => { setSelectedTab(tab) }}
        selectedTileId={selectedTileId()}
        onSelectTileId={setSelectedTileId}
        buildMode={buildMode()}
        onBuildModeChange={setBuildMode}
        mergeMode={mergeMode()}
        onMergeModeChange={setMergeMode}
        onSave={handleSave}
      />
      <LayerPanel
        weather={weather()}
        onWeatherChange={handleWeatherChange}
        layerManager={props.managers.layerBackgroundManager}
      />

      {/* Room draw overlay — BuildingControls */}
      {screenCorners() && (() => {
        const c = screenCorners()!
        return (
          <>
            {/* NW handle */}
            <div
              onPointerDown={(e) => { e.stopPropagation(); handleCornerDragStart('nw') }}
              style={`position:fixed;left:${c.nw.x - HANDLE_SIZE / 2}px;top:${c.nw.y - HANDLE_SIZE / 2}px;width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;background:#fff;border:2px solid #c8893a;border-radius:3px;cursor:crosshair;touch-action:none;box-shadow:0 1px 6px rgba(0,0,0,0.5);z-index:20;pointer-events:auto;`}
            />
            {/* NE handle */}
            <div
              onPointerDown={(e) => { e.stopPropagation(); handleCornerDragStart('ne') }}
              style={`position:fixed;left:${c.ne.x - HANDLE_SIZE / 2}px;top:${c.ne.y - HANDLE_SIZE / 2}px;width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;background:#fff;border:2px solid #c8893a;border-radius:3px;cursor:crosshair;touch-action:none;box-shadow:0 1px 6px rgba(0,0,0,0.5);z-index:20;pointer-events:auto;`}
            />
            {/* SW handle */}
            <div
              onPointerDown={(e) => { e.stopPropagation(); handleCornerDragStart('sw') }}
              style={`position:fixed;left:${c.sw.x - HANDLE_SIZE / 2}px;top:${c.sw.y - HANDLE_SIZE / 2}px;width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;background:#fff;border:2px solid #c8893a;border-radius:3px;cursor:crosshair;touch-action:none;box-shadow:0 1px 6px rgba(0,0,0,0.5);z-index:20;pointer-events:auto;`}
            />
            {/* SE handle */}
            <div
              onPointerDown={(e) => { e.stopPropagation(); handleCornerDragStart('se') }}
              style={`position:fixed;left:${c.se.x - HANDLE_SIZE / 2}px;top:${c.se.y - HANDLE_SIZE / 2}px;width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;background:#fff;border:2px solid #c8893a;border-radius:3px;cursor:crosshair;touch-action:none;box-shadow:0 1px 6px rgba(0,0,0,0.5);z-index:20;pointer-events:auto;`}
            />

            {/* Floating control strip */}
            <div style={`position:fixed;left:${c.center.x}px;top:${c.center.y}px;transform:translate(-50%,-100%);display:flex;align-items:center;gap:6px;background:rgba(10,15,10,0.88);border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:6px 10px;box-shadow:0 4px 16px rgba(0,0,0,0.5);white-space:nowrap;z-index:20;pointer-events:auto;`}>
              <span style="color:rgba(200,137,58,0.9);font-size:11px;font-family:monospace;padding-right:6px;border-right:1px solid rgba(255,255,255,0.1);">
                {c.width} × {c.height}
              </span>
              <div style="display:flex;border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);">
                {(['open', 'walled'] as const).map(m => (
                  <button
                    onClick={() => setMergeMode(m)}
                    style={`padding:4px 8px;font-size:10px;font-weight:700;border:none;cursor:pointer;background:${mergeMode() === m ? '#c8893a' : 'rgba(255,255,255,0.06)'};color:${mergeMode() === m ? '#000' : 'rgba(255,255,255,0.45)'};text-transform:capitalize;`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div style="width:1px;height:20px;background:rgba(255,255,255,0.1);" />
              <button
                onClick={handlePlaceRoom}
                style="padding:5px 14px;border-radius:5px;background:#4a7a40;color:#fff;font-size:11px;font-weight:700;cursor:pointer;border:none;letter-spacing:0.3px;"
              >
                Place Room
              </button>
            </div>
          </>
        )
      })()}
    </div>
  )
}
