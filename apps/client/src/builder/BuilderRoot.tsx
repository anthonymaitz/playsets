import { createSignal, createEffect, on, onMount, onCleanup, Show } from 'solid-js'
import { PointerEventTypes, Vector3, Matrix } from '@babylonjs/core'
import { nanoid } from 'nanoid'
import type { BuildManagers, SceneData, SceneToken } from '../PlaysetsBoardRoot'
import type { BuildingTile, BuilderProp, WeatherType, FacingDir } from '../types'
import { worldToCell } from '../babylon/grid'
import { normalizeRect } from '../babylon/buildingUtils'
import { getPropCategory } from '../babylon/props'
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

function tokenColor(tokenId: string): string {
  const [type, role] = tokenId.split(':')
  return type === 'door' ? '#cc4444' : (NPC_COLOR_MAP[role ?? ''] ?? '#4488cc')
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
  const [selectedPropId, setSelectedPropId] = createSignal('door-wood')
  const [buildMode, setBuildMode] = createSignal<'build' | 'erase'>('build')
  const [buildings, setBuildings] = createSignal<BuildingTile[]>([])
  const [tokens, setTokens] = createSignal<SceneToken[]>([])
  const [placedProps, setPlacedProps] = createSignal<BuilderProp[]>([])
  const [weather, setWeather] = createSignal<string>(props.scene.weather ?? 'sunny')
  const [activeLayerIndex, setActiveLayerIndex] = createSignal(5)
  const [screenCorners, setScreenCorners] = createSignal<ScreenCorners | null>(null)
  const [toolbarDragToken, setToolbarDragToken] = createSignal<string | null>(null)
  const [ghostPos, setGhostPos] = createSignal<{ x: number; y: number } | null>(null)
  const [contextMenuId, setContextMenuId] = createSignal<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = createSignal<{ x: number; y: number } | null>(null)

  let previewEnd: { col: number; row: number } | null = null
  let draggingCorner: 'nw' | 'ne' | 'sw' | 'se' | null = null
  let isDragPreview = false

  // Reactively update WeatherSystem when the weather signal changes
  createEffect(on(weather, (w) => {
    props.managers.weatherSystem.setWeather(w as WeatherType)
  }, { defer: true }))

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
      direction: 's',
    }
    props.managers.spriteManager.place(
      { instanceId: id, spriteId: `tokens/${tokenType}`, col, row, placedBy: 'builder', facing: 's' },
      tokenDataUri(tokenType, tokenRole),
    )
    setTokens(prev => [...prev.filter(t => !(t.col === col && t.row === row)), token])
  }

  function handlePropClick(col: number, row: number) {
    const propId = selectedPropId()
    const { propManager, buildingManager } = props.managers
    const existing = placedProps().find(p => p.col === col && p.row === row)
    if (existing) {
      propManager.remove(existing.instanceId, buildingManager)
      setPlacedProps(prev => prev.filter(p => p.instanceId !== existing.instanceId))
    }
    const prop: BuilderProp = {
      instanceId: nanoid(),
      propId,
      col,
      row,
      state: {},
      layerIndex: activeLayerIndex(),
    }
    propManager.place(prop, getPropCategory(propId), buildingManager)
    setPlacedProps(prev => [...prev.filter(p => !(p.col === col && p.row === row)), prop])
  }

  function handleTokenMove(e: Event) {
    const { id, x, y } = (e as CustomEvent<{ id: string; x: number; y: number }>).detail
    if (isWallAt(x, y)) return
    props.managers.spriteManager.move(id, x, y)
    setTokens(prev => prev.map(t => t.id === id ? { ...t, col: x, row: y } : t))
  }

  function getMeshScreenPos(instanceId: string): { x: number; y: number } | null {
    const { bjsScene, bjsCamera, spriteManager } = props.managers
    const mesh = spriteManager.getMesh(instanceId)
    if (!mesh) return null
    const engine = bjsScene.getEngine()
    const canvas = engine.getRenderingCanvas()
    if (!canvas) return null
    const viewport = bjsCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    const transform = bjsScene.getTransformMatrix()
    const canvasBounds = canvas.getBoundingClientRect()
    const scaleX = canvasBounds.width / engine.getRenderWidth()
    const scaleY = canvasBounds.height / engine.getRenderHeight()
    const worldTop = new Vector3(mesh.position.x, 1.6, mesh.position.z)
    const s = Vector3.Project(worldTop, Matrix.Identity(), transform, viewport)
    return { x: s.x * scaleX + canvasBounds.left, y: s.y * scaleY + canvasBounds.top }
  }

  function dismissContextMenu() {
    setContextMenuId(null)
    setContextMenuPos(null)
  }

  function handleContextFacing(dir: FacingDir) {
    const id = contextMenuId()
    if (!id) return
    props.managers.spriteManager.setFacing(id, dir)
    setTokens(prev => prev.map(t => t.id === id ? { ...t, direction: dir } : t))
  }

  function handleContextDelete() {
    const id = contextMenuId()
    if (!id) return
    props.managers.spriteManager.remove(id)
    setTokens(prev => prev.filter(t => t.id !== id))
    dismissContextMenu()
  }

  function handleSave() {
    const sceneData: SceneData = {
      buildings: buildings().map(b => ({ col: b.col, row: b.row, tileId: b.tileId, instanceId: b.instanceId })),
      layers: props.scene.layers ?? [],
      props: placedProps().map(p => ({ id: p.instanceId, col: p.col, row: p.row, tileId: p.propId })),
      tokens: tokens(),
      weather: weather(),
    }
    props.host.dispatchEvent(new CustomEvent('scenechange', { bubbles: true, detail: { scene: sceneData } }))
  }

  onMount(() => {
    const { buildingManager, propManager, spriteManager, weatherSystem, bjsScene } = props.managers

    const initBuildings: BuildingTile[] = (props.scene.buildings ?? []).map(b => ({
      instanceId: b.instanceId ?? `${b.col},${b.row}`,
      tileId: b.tileId,
      col: b.col,
      row: b.row,
    }))
    buildingManager.loadSnapshot(initBuildings)
    setBuildings(initBuildings)

    // Load any existing props from the scene
    const initProps: BuilderProp[] = (props.scene.props ?? []).map(p => ({
      instanceId: p.id,
      propId: p.tileId,
      col: p.col,
      row: p.row,
      state: {},
    }))
    propManager.loadSnapshot(initProps, getPropCategory, buildingManager)
    setPlacedProps(initProps)

    for (const t of props.scene.tokens ?? []) {
      spriteManager.place(
        { instanceId: t.id, spriteId: `tokens/${t.type}`, col: t.col, row: t.row, placedBy: 'builder', facing: (t.direction ?? 's') as FacingDir },
        tokenDataUri(t.type, t.role),
      )
    }
    setTokens(props.scene.tokens ?? [])
    weatherSystem.setWeather(weather() as WeatherType)

    // Update screen-space corners every frame while a preview is active
    const renderObserver = bjsScene.onBeforeRenderObservable.add(() => {
      const next = (previewEnd && buildingManager.getPreviewStart())
        ? computeScreenCorners()
        : null
      setScreenCorners(next)
    })

    const isBuildMesh = (m: { name: string }) =>
      m.name === 'ground' || m.name.startsWith('btile-') || m.name.startsWith('_wa-') || m.name.startsWith('_wb-')

    const pointerObserver = bjsScene.onPointerObservable.add((info) => {
      const tab = selectedTab()
      const mode = buildMode()

      if (info.type === PointerEventTypes.POINTERDOWN) {
        if ((info.event as PointerEvent).button !== 0) return  // left button only
        // Ignore clicks that originate from a toolbar token drag — handled by window listeners
        if (toolbarDragToken()) return
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
        if (tab === 'token' && !toolbarDragToken()) {
          const pick = bjsScene.pick(bjsScene.pointerX, bjsScene.pointerY, isBuildMesh)
          if (pick.hit && pick.pickedPoint) {
            const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
            handleTokenClick(col, row)
          }
        } else if (tab === 'prop') {
          const pick = bjsScene.pick(bjsScene.pointerX, bjsScene.pointerY, isBuildMesh)
          if (pick.hit && pick.pickedPoint) {
            const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
            handlePropClick(col, row)
          }
        }
      }
    })

    // Corner drag via window-level pointer events
    const onWindowMove = (e: PointerEvent) => {
      if (draggingCorner && previewEnd) {
        const canvas = bjsScene.getEngine().getRenderingCanvas()
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const engine = bjsScene.getEngine()
        const scaleX = engine.getRenderWidth() / rect.width
        const scaleY = engine.getRenderHeight() / rect.height
        const pick = bjsScene.pick(
          (e.clientX - rect.left) * scaleX,
          (e.clientY - rect.top) * scaleY,
          isBuildMesh,
        )
        if (!pick.hit || !pick.pickedPoint) return
        const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
        buildingManager.updatePreview(col, row, tilePath(wallTileId()), tilePath(floorTileId()))
        previewEnd = { col, row }
      }

      // Token ghost drag position
      if (toolbarDragToken()) setGhostPos({ x: e.clientX, y: e.clientY })
    }

    const onWindowUp = (e: PointerEvent) => {
      // Finish corner drag
      if (draggingCorner) { draggingCorner = null; return }

      // Finish token toolbar drag — drop onto canvas
      const tokenId = toolbarDragToken()
      if (tokenId) {
        setToolbarDragToken(null)
        setGhostPos(null)
        const canvas = bjsScene.getEngine().getRenderingCanvas()
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        if (
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom
        ) {
          const engine = bjsScene.getEngine()
          const scaleX = engine.getRenderWidth() / rect.width
          const scaleY = engine.getRenderHeight() / rect.height
          const pick = bjsScene.pick(
            (e.clientX - rect.left) * scaleX,
            (e.clientY - rect.top) * scaleY,
            isBuildMesh,
          )
          if (pick.hit && pick.pickedPoint) {
            const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
            const savedId = selectedTokenId()
            setSelectedTokenId(tokenId)
            handleTokenClick(col, row)
            setSelectedTokenId(savedId)
          }
        }
      }
    }

    props.managers.dragCallbacks.onSpriteClick = (instanceId) => {
      const pos = getMeshScreenPos(instanceId)
      if (!pos) return
      setContextMenuId(instanceId)
      setContextMenuPos(pos)
    }

    const onDocClick = (e: MouseEvent) => {
      const menu = document.getElementById('token-ctx-menu')
      if (menu && !menu.contains(e.target as Node)) dismissContextMenu()
    }

    window.addEventListener('pointermove', onWindowMove)
    window.addEventListener('pointerup', onWindowUp)
    window.addEventListener('click', onDocClick, true)
    props.host.addEventListener('tokenmove', handleTokenMove)

    onCleanup(() => {
      props.managers.dragCallbacks.onSpriteClick = () => {}
      bjsScene.onPointerObservable.remove(pointerObserver)
      bjsScene.onBeforeRenderObservable.remove(renderObserver)
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('pointerup', onWindowUp)
      window.removeEventListener('click', onDocClick, true)
      props.host.removeEventListener('tokenmove', handleTokenMove)
    })
  })

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
        onTokenPointerDown={(tokenId, e) => {
          e.preventDefault()
          setToolbarDragToken(tokenId)
          setGhostPos({ x: e.clientX, y: e.clientY })
        }}
        selectedPropId={selectedPropId()}
        onPropSelect={setSelectedPropId}
        buildMode={buildMode()}
        onBuildModeChange={setBuildMode}
        weather={weather()}
        onWeatherChange={setWeather}
        onSave={handleSave}
      />

      <LayerPanel
        activeLayerIndex={activeLayerIndex()}
        onSelectLayer={setActiveLayerIndex}
        layerManager={props.managers.layerBackgroundManager}
      />

      {/* Token drag ghost */}
      {toolbarDragToken() !== null && ghostPos() !== null && (
        <div
          style={`position:fixed;pointer-events:none;z-index:50;width:28px;height:28px;border-radius:50%;border:2px solid #f0a84a;box-shadow:0 2px 8px rgba(0,0,0,0.6);transform:translate(-50%,-50%);left:${ghostPos()?.x ?? 0}px;top:${ghostPos()?.y ?? 0}px;background:${tokenColor(toolbarDragToken()!)};`}
        />
      )}

      {/* Token context menu */}
      <Show when={contextMenuId() !== null && contextMenuPos() !== null}>
        {() => {
          const token = () => tokens().find(t => t.id === contextMenuId())
          const facing = () => (tokens().find(t => t.id === contextMenuId())?.direction as FacingDir) ?? 's'
          const pos = contextMenuPos()!
          const label = () => { const t = token(); return t ? `${t.type}${t.role ? ` (${t.role})` : ''}` : contextMenuId()! }
          return (
            <div
              id="token-ctx-menu"
              style={`position:fixed;pointer-events:auto;z-index:60;left:${pos.x}px;top:${pos.y}px;transform:translate(-50%,-100%) translateY(-8px);background:rgba(10,14,10,0.94);border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:8px 10px;box-shadow:0 4px 18px rgba(0,0,0,0.6);display:flex;flex-direction:column;gap:6px;min-width:140px;font-family:monospace;`}
            >
              <div style="color:rgba(200,137,58,0.9);font-size:10px;font-weight:700;text-align:center;">{label()}</div>
              <div style="display:flex;justify-content:center;gap:4px;">
                {(['n','e','s','w'] as FacingDir[]).map(dir => (
                  <button
                    onClick={() => handleContextFacing(dir)}
                    style={`width:28px;height:28px;border-radius:5px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;font-size:11px;font-weight:700;color:#fff;background:${facing() === dir ? '#4a7a40' : 'rgba(40,50,40,0.9)'};`}
                  >
                    {dir.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                onClick={handleContextDelete}
                style="padding:4px 8px;border-radius:5px;background:#7a2020;color:#fff;font-size:10px;font-weight:700;cursor:pointer;border:none;"
              >
                Delete
              </button>
            </div>
          )
        }}
      </Show>

      {/* Corner handles + Place Room strip */}
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
