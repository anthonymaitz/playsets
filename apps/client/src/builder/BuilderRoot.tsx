import { createSignal, onMount, onCleanup } from 'solid-js'
import { PointerEventTypes, Vector3, Matrix } from '@babylonjs/core'
import type { BuildManagers, SceneData, SceneToken } from '../PlaysetsBoardRoot'
import type { BuildingTile } from '../types'
import { worldToCell } from '../babylon/grid'
import { normalizeRect } from '../babylon/buildingUtils'
import { BuilderToolbar } from './BuilderToolbar'
import type { ToolTab } from './BuilderToolbar'
import { LayerPanel } from './LayerPanel'

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
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96"><rect width="64" height="96" rx="8" fill="${color}"/></svg>`,
  )}`
}

interface Props {
  host: HTMLElement
  scene: SceneData
  managers: BuildManagers
}

const HANDLE_SIZE = 16

export function BuilderRoot(props: Props) {
  const [selectedTab, setSelectedTab] = createSignal<ToolTab>('build')
  const [wallTileId, setWallTileId] = createSignal('wall-wood')
  const [floorTileId, setFloorTileId] = createSignal('floor-dirt')
  const [selectedTokenId, setSelectedTokenId] = createSignal('npc:innkeeper')
  const [buildMode, setBuildMode] = createSignal<'build' | 'erase'>('build')
  const [buildings, setBuildings] = createSignal<BuildingTile[]>([])
  const [tokens, setTokens] = createSignal<SceneToken[]>([])
  const [weather] = createSignal(props.scene.weather ?? 'sunny')
  const [activeLayerIndex, setActiveLayerIndex] = createSignal(5)
  const [screenCorners, setScreenCorners] = createSignal<ScreenCorners | null>(null)

  let previewEnd: { col: number; row: number } | null = null
  let draggingCorner: 'nw' | 'ne' | 'sw' | 'se' | null = null
  let isDragPreview = false

  function tilePath(id: string) { return `/assets/tiles/${id}.svg` }

  function isWallAt(col: number, row: number): boolean {
    return buildings().some(b => b.col === col && b.row === row && b.tileId.includes('wall'))
  }

  function computeScreenCorners(): ScreenCorners | null {
    const { bjsScene, bjsCamera, buildingManager } = props.managers
    const end = previewEnd
    if (!end) return null
    if (!buildingManager.getPreviewStart()) return null

    const worldCorners = buildingManager.getPreviewWorldCorners(end.col, end.row)
    if (!worldCorners) return null

    const engine = bjsScene.getEngine()
    const canvas = engine.getRenderingCanvas()
    if (!canvas) return null

    const viewport = bjsCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    const transform = bjsScene.getTransformMatrix()
    const canvasBounds = canvas.getBoundingClientRect()
    const scaleX = canvasBounds.width / engine.getRenderWidth()
    const scaleY = canvasBounds.height / engine.getRenderHeight()

    const project = (v: Vector3) => {
      const s = Vector3.Project(v, Matrix.Identity(), transform, viewport)
      return { x: s.x * scaleX + canvasBounds.left, y: s.y * scaleY + canvasBounds.top }
    }

    const rect = buildingManager.getPreviewStart()!
    const { minCol, minRow, maxCol, maxRow } = normalizeRect({
      startCol: rect.startCol, startRow: rect.startRow, endCol: end.col, endRow: end.row,
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

  function handlePlaceRoom() {
    const end = previewEnd
    if (!end) return
    const { buildingManager } = props.managers

    const existingMap: Record<string, BuildingTile> = {}
    for (const b of buildings()) existingMap[b.instanceId] = b

    const { tiles, removedIds } = buildingManager.commitPreview(
      end.col,
      end.row,
      wallTileId(),
      floorTileId(),
      existingMap,
      'open',
      activeLayerIndex(),
    )

    previewEnd = null
    setScreenCorners(null)
    setBuildings(prev => [
      ...prev.filter(b => !removedIds.includes(b.instanceId)),
      ...tiles,
    ])
  }

  function handleCornerDragStart(corner: 'nw' | 'ne' | 'sw' | 'se') {
    const bm = props.managers.buildingManager
    const rect = bm.getPreviewStart()
    const end = previewEnd
    if (rect && end) {
      const { minCol, minRow, maxCol, maxRow } = normalizeRect({
        startCol: rect.startCol, startRow: rect.startRow, endCol: end.col, endRow: end.row,
      })
      const opp = {
        nw: { col: maxCol, row: maxRow }, ne: { col: minCol, row: maxRow },
        sw: { col: maxCol, row: minRow }, se: { col: minCol, row: minRow },
      }
      bm.setPreviewStart(opp[corner].col, opp[corner].row)
    }
    draggingCorner = corner
  }

  function handleTokenClick(col: number, row: number) {
    if (isWallAt(col, row)) return
    const tileId = selectedTokenId()
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
    if (isWallAt(x, y)) return
    props.managers.spriteManager.move(id, x, y)
    setTokens(prev => prev.map(t => t.id === id ? { ...t, col: x, row: y } : t))
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

    // Update screen-space corners every frame while a preview is active
    const renderObserver = bjsScene.onBeforeRenderObservable.add(() => {
      const next = (previewEnd && buildingManager.getPreviewStart())
        ? computeScreenCorners()
        : null
      setScreenCorners(next)
    })

    // Pick filter: ground plane + btile meshes (BuildingManager prefix)
    const isBuildMesh = (m: { name: string }) =>
      m.name === 'ground' || m.name.startsWith('btile-') || m.name.startsWith('_wa-') || m.name.startsWith('_wb-')

    const pointerObserver = bjsScene.onPointerObservable.add((info) => {
      const tab = selectedTab()
      const mode = buildMode()

      if (info.type === PointerEventTypes.POINTERDOWN) {
        const pick = bjsScene.pick(bjsScene.pointerX, bjsScene.pointerY, isBuildMesh)
        if (!pick.hit || !pick.pickedPoint) return
        const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)

        if (tab === 'build' && mode === 'build') {
          isDragPreview = true
          buildingManager.beginPreview(col, row)
          buildingManager.updatePreview(col, row, tilePath(wallTileId()), tilePath(floorTileId()))
          previewEnd = { col, row }
        } else if (tab === 'build' && mode === 'erase') {
          const existing = buildings().find(b => b.col === col && b.row === row)
          if (existing) {
            buildingManager.removeTile(existing.instanceId)
            setBuildings(prev => prev.filter(b => b.instanceId !== existing.instanceId))
          }
        }
      }

      if (info.type === PointerEventTypes.POINTERMOVE && isDragPreview && !draggingCorner) {
        const pick = bjsScene.pick(bjsScene.pointerX, bjsScene.pointerY, isBuildMesh)
        if (!pick.hit || !pick.pickedPoint) return
        const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
        buildingManager.updatePreview(col, row, tilePath(wallTileId()), tilePath(floorTileId()))
        previewEnd = { col, row }
      }

      if (info.type === PointerEventTypes.POINTERUP) {
        isDragPreview = false
        if (tab === 'token') {
          const pick = bjsScene.pick(bjsScene.pointerX, bjsScene.pointerY, isBuildMesh)
          if (pick.hit && pick.pickedPoint) {
            const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
            handleTokenClick(col, row)
          }
        }
      }
    })

    // Window listeners so corner-drag works when pointer leaves the canvas
    const onWindowMove = (e: PointerEvent) => {
      if (!draggingCorner || !previewEnd) return
      const canvas = bjsScene.getEngine().getRenderingCanvas()
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const pick = bjsScene.pick(e.clientX - rect.left, e.clientY - rect.top, isBuildMesh)
      if (!pick.hit || !pick.pickedPoint) return
      const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
      buildingManager.updatePreview(col, row, tilePath(wallTileId()), tilePath(floorTileId()))
      previewEnd = { col, row }
    }
    const onWindowUp = () => { draggingCorner = null }

    window.addEventListener('pointermove', onWindowMove)
    window.addEventListener('pointerup', onWindowUp)
    props.host.addEventListener('tokenmove', handleTokenMove)

    onCleanup(() => {
      bjsScene.onPointerObservable.remove(pointerObserver)
      bjsScene.onBeforeRenderObservable.remove(renderObserver)
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('pointerup', onWindowUp)
      props.host.removeEventListener('tokenmove', handleTokenMove)
    })
  })

  // --- JSX ---
  // screenCorners() is read reactively inside the ternary — SolidJS updates the DOM when it changes
  return (
    <div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">
      <BuilderToolbar
        selectedTab={selectedTab()}
        onSelectTab={setSelectedTab}
        wallTileId={wallTileId()}
        onWallSelect={setWallTileId}
        floorTileId={floorTileId()}
        onFloorSelect={setFloorTileId}
        selectedTokenId={selectedTokenId()}
        onTokenSelect={setSelectedTokenId}
        buildMode={buildMode()}
        onBuildModeChange={setBuildMode}
        onSave={handleSave}
      />

      <LayerPanel
        activeLayerIndex={activeLayerIndex()}
        onSelectLayer={setActiveLayerIndex}
        layerManager={props.managers.layerBackgroundManager}
      />

      {/* Corner handles — rendered reactively via screenCorners() reads */}
      {screenCorners() !== null && (
        <div style="position:fixed;top:0;left:0;pointer-events:none;z-index:20;">
          <div
            onPointerDown={(e) => { e.stopPropagation(); handleCornerDragStart('nw') }}
            style={`position:fixed;pointer-events:auto;cursor:crosshair;touch-action:none;background:#fff;border:2px solid #c8893a;border-radius:3px;box-shadow:0 1px 6px rgba(0,0,0,0.5);width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;left:${(screenCorners()?.nw.x ?? 0) - HANDLE_SIZE / 2}px;top:${(screenCorners()?.nw.y ?? 0) - HANDLE_SIZE / 2}px;`}
          />
          <div
            onPointerDown={(e) => { e.stopPropagation(); handleCornerDragStart('ne') }}
            style={`position:fixed;pointer-events:auto;cursor:crosshair;touch-action:none;background:#fff;border:2px solid #c8893a;border-radius:3px;box-shadow:0 1px 6px rgba(0,0,0,0.5);width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;left:${(screenCorners()?.ne.x ?? 0) - HANDLE_SIZE / 2}px;top:${(screenCorners()?.ne.y ?? 0) - HANDLE_SIZE / 2}px;`}
          />
          <div
            onPointerDown={(e) => { e.stopPropagation(); handleCornerDragStart('sw') }}
            style={`position:fixed;pointer-events:auto;cursor:crosshair;touch-action:none;background:#fff;border:2px solid #c8893a;border-radius:3px;box-shadow:0 1px 6px rgba(0,0,0,0.5);width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;left:${(screenCorners()?.sw.x ?? 0) - HANDLE_SIZE / 2}px;top:${(screenCorners()?.sw.y ?? 0) - HANDLE_SIZE / 2}px;`}
          />
          <div
            onPointerDown={(e) => { e.stopPropagation(); handleCornerDragStart('se') }}
            style={`position:fixed;pointer-events:auto;cursor:crosshair;touch-action:none;background:#fff;border:2px solid #c8893a;border-radius:3px;box-shadow:0 1px 6px rgba(0,0,0,0.5);width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;left:${(screenCorners()?.se.x ?? 0) - HANDLE_SIZE / 2}px;top:${(screenCorners()?.se.y ?? 0) - HANDLE_SIZE / 2}px;`}
          />

          {/* Place Room strip */}
          <div style={`position:fixed;pointer-events:auto;display:flex;align-items:center;gap:8px;background:rgba(10,15,10,0.88);border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:6px 10px;box-shadow:0 4px 16px rgba(0,0,0,0.5);left:${screenCorners()?.center.x ?? 0}px;top:${screenCorners()?.center.y ?? 0}px;transform:translate(-50%,-100%);`}>
            <span style="color:rgba(200,137,58,0.9);font-size:11px;font-family:monospace;">
              {screenCorners()?.width ?? 0} × {screenCorners()?.height ?? 0}
            </span>
            <button
              onClick={handlePlaceRoom}
              style="padding:5px 14px;border-radius:5px;background:#4a7a40;color:#fff;font-size:11px;font-weight:700;cursor:pointer;border:none;"
            >
              Place Room
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
