import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { PointerEventTypes, Vector3, Matrix } from '@babylonjs/core'
import type { Scene, ArcRotateCamera } from '@babylonjs/core'
import { BuildingManager } from '../babylon/buildings'
import { PropManager, getPropCategory } from '../babylon/props'
import { RoofManager } from '../babylon/roofs'
import { LayerBackgroundManager } from '../babylon/layers'
import { LayerPanel } from '../components/LayerPanel'
import { TokenLayerMover } from '../components/TokenLayerMover'
import type { LayerBackground } from '../types'
import { BuildingControls } from '../components/BuildingControls'
import { Sidebar } from '../components/Sidebar'
import type { ScreenCorners } from '../components/BuildingControls'
import { normalizeRect } from '../babylon/buildingUtils'
import { createScene } from '../babylon/scene'
import { createGrid, setGridBackground, worldToCell, cellToWorld } from '../babylon/grid'
import { SpriteManager } from '../babylon/sprites'
import { WeatherSystem } from '../babylon/weather'
import { DragController } from '../babylon/drag'
import { CursorManager } from '../babylon/cursors'
import { showEmote } from '../babylon/emotes'
import { HostSession } from '../networking/host'
import { GuestSession } from '../networking/guest'
import { TopBar } from '../components/TopBar'
import { DirectionPicker } from '../components/DirectionPicker'
import { JoinDialog } from '../components/JoinDialog'
import { TokenMenu } from '../components/token-menu/TokenMenu'
import { TokenHUD } from '../components/TokenHUD'
import { RoofMenu } from '../components/RoofMenu'
import { StackBadge } from '../components/StackBadge'
import { PropMirrorPicker } from '../components/PropMirrorPicker'
import { PropStackBadge } from '../components/PropStackBadge'
import { TokenBuilder } from '../components/TokenBuilder'
import { compositeToDataUrl } from '../babylon/tokenCompositor'
import { usePlayersStore } from '../store/players'
import { useTokenStore } from '../store/tokens'
import { useRoomStore } from '../store/room'
import type { SpriteManifestEntry, FacingDir, WeatherType, BackgroundType, Roof, TokenDefinition } from '../types'
import type { PropManifestEntry, TileManifestEntry } from '../types'
import type { Mesh } from '@babylonjs/core'
import { nanoid } from 'nanoid'

interface TokenMenuState {
  instanceId: string
  x: number
  y: number
}

type SessionMsg = Parameters<HostSession['localAction']>[0]

function sendMsg(session: HostSession | GuestSession | null, msg: SessionMsg): void {
  if (session instanceof HostSession) session.localAction(msg)
  else session?.send(msg)
}

function isWallCell(col: number, row: number): boolean {
  return Object.values(useRoomStore.getState().buildingTiles).some(
    (t) => t.col === col && t.row === row && t.tileId.includes('wall'),
  )
}

function getWallFacing(col: number, row: number): 'x' | 'west' | 'east' {
  const tiles = Object.values(useRoomStore.getState().buildingTiles)
  const hasZNeighborWalls = tiles.some(
    (t) => t.col === col && (t.row === row - 1 || t.row === row + 1) && t.tileId.includes('wall'),
  )
  if (!hasZNeighborWalls) return 'x'
  // z-axis wall: determine east vs west by which side has the room interior
  const hasEastTile = tiles.some((t) => t.col === col + 1 && t.row === row)
  return hasEastTile ? 'west' : 'east'
}

function getConnectedBuildingCells(startCol: number, startRow: number): Array<{ col: number; row: number }> {
  const tiles = useRoomStore.getState().buildingTiles
  const tileSet = new Set(Object.values(tiles).map((t) => `${t.col},${t.row}`))
  if (!tileSet.has(`${startCol},${startRow}`)) return []
  const visited = new Set<string>()
  const result: Array<{ col: number; row: number }> = []
  const queue = [{ col: startCol, row: startRow }]
  while (queue.length) {
    const { col, row } = queue.shift()!
    const key = `${col},${row}`
    if (visited.has(key) || !tileSet.has(key)) continue
    visited.add(key)
    result.push({ col, row })
    queue.push({ col: col - 1, row }, { col: col + 1, row }, { col, row: row - 1 }, { col, row: row + 1 })
  }
  return result
}

function getRoofAtCell(col: number, row: number): Roof | null {
  const { roofs } = useRoomStore.getState()
  for (const roof of Object.values(roofs)) {
    if (roof.cells.some((c) => c.col === col && c.row === row)) return roof
  }
  return null
}

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams] = useSearchParams()
  const isHost = searchParams.get('host') === '1'

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const groundRef = useRef<Mesh | null>(null)
  const bgCleanupRef = useRef<() => void>(() => {})
  const sessionRef = useRef<HostSession | GuestSession | null>(null)
  const selectedSpriteRef = useRef<SpriteManifestEntry | null>(null)
  const spriteManagerRef = useRef<SpriteManager | null>(null)
  const dragControllerRef = useRef<DragController | null>(null)
  const weatherSystemRef = useRef<WeatherSystem | null>(null)
  const cameraAlphaRef = useRef(-Math.PI / 4)
  const buildingManagerRef = useRef<BuildingManager | null>(null)
  const buildingModeRef = useRef(false)
  const buildModeRef = useRef<'build' | 'erase'>('build')
  const wallTileIdRef = useRef('wall-wood')
  const floorTileIdRef = useRef('floor-dirt')
  const mergeModeRef = useRef<'open' | 'walled'>('open')
  const previewEndRef = useRef<{ col: number; row: number } | null>(null)
  const draggingCornerRef = useRef<'nw' | 'ne' | 'sw' | 'se' | null>(null)
  const draggingRoomRef = useRef<{ lastCol: number; lastRow: number } | null>(null)
  const isPreviewDraggingRef = useRef(false)

  const [needsName, setNeedsName] = useState(() => {
    const saved = localStorage.getItem('playsets-display-name')
    if (saved) {
      usePlayersStore.getState().setDisplayName(saved)
      return false
    }
    return true
  })
  const [selectedSprite, setSelectedSprite] = useState<SpriteManifestEntry | null>(null)
  const [tokenMenu, setTokenMenu] = useState<TokenMenuState | null>(null)
  const [directionPicker, setDirectionPicker] = useState<{ instanceId: string; x: number; y: number } | null>(null)
  const [connected, setConnected] = useState(isHost)
  const [canvasRect, setCanvasRect] = useState({ left: 268, top: 48 })
  const [currentWeather, setCurrentWeather] = useState<WeatherType>('sunny')
  const [currentBackground, setCurrentBackground] = useState<BackgroundType>('grass')
  const [cameraAlpha, setCameraAlpha] = useState(-Math.PI / 4)
  const [buildingMode, setBuildingMode] = useState(false)
  const [buildMode, setBuildMode] = useState<'build' | 'erase'>('build')
  const [wallTileId, setWallTileId] = useState('wall-wood')
  const [floorTileId, setFloorTileId] = useState('floor-dirt')
  const [mergeMode, setMergeMode] = useState<'open' | 'walled'>('open')
  const [screenCorners, setScreenCorners] = useState<ScreenCorners | null>(null)
  const [selectedProp, setSelectedProp] = useState<PropManifestEntry | null>(null)
  const [tiles, setTiles] = useState<TileManifestEntry[]>([])
  const [roofMenu, setRoofMenu] = useState<{ instanceId: string; x: number; y: number } | null>(null)
  const [stackBadge, setStackBadge] = useState<{ instanceId: string } | null>(null)
  const [propMirrorPicker, setPropMirrorPicker] = useState<{ instanceId: string; x: number; y: number } | null>(null)
  const [propStackBadge, setPropStackBadge] = useState<{ instanceId: string } | null>(null)
  const selectedPropRef = useRef<PropManifestEntry | null>(null)
  const propManagerRef = useRef<PropManager | null>(null)
  const propModeRef = useRef(false)
  const propDragRef = useRef<{ instanceId: string; startCol: number; startRow: number; lastCol: number; lastRow: number } | null>(null)
  const roofManagerRef = useRef<RoofManager | null>(null)
  const roofModeRef = useRef(false)
  const cameraRef = useRef<ArcRotateCamera | null>(null)
  const layerBackgroundManagerRef = useRef<LayerBackgroundManager | null>(null)
  const builderIsNewTokenRef = useRef(false)
  const cameraPreOpenStateRef = useRef<{ target: { x: number; y: number; z: number }; radius: number } | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [builderInstanceId, setBuilderInstanceId] = useState<string | null>(null)
  const [builderDefinition, setBuilderDefinition] = useState<TokenDefinition | null>(null)
  const [builderOriginalDef, setBuilderOriginalDef] = useState<TokenDefinition | null>(null)
  const [activeLayerIndex, setActiveLayerIndex] = useState(5)
  const [tokenLayerMover, setTokenLayerMover] = useState<{ instanceId: string; x: number; y: number; layerIndex: number } | null>(null)

  const sprites = useRoomStore((s) => s.sprites)
  const roofs = useRoomStore((s) => s.roofs)
  const layers = useRoomStore((s) => s.layers)

  const handleSelectSprite = (s: SpriteManifestEntry) => {
    setSelectedSprite(s)
    selectedSpriteRef.current = s
  }

  const handleDeselectSprite = () => {
    setSelectedSprite(null)
    selectedSpriteRef.current = null
    spriteManagerRef.current?.hidePlacementGhost()
  }

  const handleWeatherChange = (type: WeatherType) => {
    weatherSystemRef.current?.setWeather(type)
    spriteManagerRef.current?.setShadowGenerator(weatherSystemRef.current?.getShadowGenerator() ?? null)
    setCurrentWeather(type)
  }

  const handleBackgroundChange = (type: BackgroundType) => {
    bgCleanupRef.current()
    if (groundRef.current && sceneRef.current) {
      bgCleanupRef.current = setGridBackground(groundRef.current, type, sceneRef.current)
    }
    setCurrentBackground(type)
  }

  useEffect(() => {
    if (!isHost && roomId && roomId !== 'new') {
      useRoomStore.getState().setRoomId(roomId)
    }
  }, [isHost, roomId])

  useEffect(() => { buildingModeRef.current = buildingMode }, [buildingMode])
  useEffect(() => { buildModeRef.current = buildMode }, [buildMode])
  useEffect(() => { wallTileIdRef.current = wallTileId }, [wallTileId])
  useEffect(() => { floorTileIdRef.current = floorTileId }, [floorTileId])
  useEffect(() => { mergeModeRef.current = mergeMode }, [mergeMode])
  useEffect(() => { propModeRef.current = selectedProp !== null }, [selectedProp])

  useEffect(() => {
    fetch('/assets/tiles/manifest.json')
      .then((r) => r.json())
      .then((data: { tiles: TileManifestEntry[] }) => setTiles(data.tiles))
      .catch(() => { console.warn('Failed to load tile manifest') })
  }, [])

  useEffect(() => {
    if (needsName || !canvasRef.current) return

    useRoomStore.getState().reset()

    bgCleanupRef.current = () => {}
    const { engine, scene, camera, ambientLight } = createScene(canvasRef.current)
    cameraRef.current = camera
    sceneRef.current = scene
    const ground = createGrid(scene)
    groundRef.current = ground
    const spriteManager = new SpriteManager(scene, camera, isHost)
    spriteManagerRef.current = spriteManager
    buildingManagerRef.current = new BuildingManager(scene)
    propManagerRef.current = new PropManager(scene)
    roofManagerRef.current = new RoofManager(scene, isHost)
    const layerBgManager = new LayerBackgroundManager(scene, useRoomStore.getState().layers)
    layerBackgroundManagerRef.current = layerBgManager
    const weatherSystem = new WeatherSystem(scene, ground, ambientLight, camera)
    weatherSystemRef.current = weatherSystem
    weatherSystem.setWeather('sunny')
    spriteManager.setShadowGenerator(weatherSystem.getShadowGenerator())
    const cursorManager = new CursorManager(scene)

    const updateCanvasRect = () => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) setCanvasRect({ left: rect.left, top: rect.top })
    }
    updateCanvasRect()
    window.addEventListener('resize', updateCanvasRect)

    const cameraObserver = camera.onViewMatrixChangedObservable.add(() => {
      cameraAlphaRef.current = camera.alpha
      setCameraAlpha(camera.alpha)
    })

    const showDirPickerAtPointer = (instanceId: string) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      setDirectionPicker({ instanceId, x: (rect?.left ?? 0) + scene.pointerX, y: (rect?.top ?? 0) + scene.pointerY })
    }

    const dragController = setupDragController(scene, spriteManager, camera, sessionRef, canvasRef, showDirPickerAtPointer, setTokenMenu, setStackBadge, buildingModeRef, setTokenLayerMover)
    dragControllerRef.current = dragController

    setupScenePointerObservable(scene, spriteManager, dragController, selectedSpriteRef, sessionRef, setTokenMenu, setDirectionPicker, setRoofMenu, setStackBadge, buildingModeRef, setTokenLayerMover)

    scene.onPointerObservable.add((info) => {
      // Prop drag preview (move meshes live as host drags a placed prop)
      if (info.type === PointerEventTypes.POINTERMOVE && propDragRef.current) {
        const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.name === 'ground')
        if (pick?.hit && pick.pickedPoint) {
          const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
          const drag = propDragRef.current
          if (col !== drag.lastCol || row !== drag.lastRow) {
            const propData = useRoomStore.getState().builderProps[drag.instanceId]
            if (propData) {
              const cat = getPropCategory(propData.propId)
              const isWall = buildingManagerRef.current?.isWallAt(col, row) ?? false
              const valid =
                (cat === 'punch-through' && isWall) ||
                (cat === 'wall-decor' && isWall) ||
                cat === 'floor-decor' ||
                cat === 'floor-object'
              if (valid) {
                propManagerRef.current?.move(drag.instanceId, col, row, buildingManagerRef.current!)
                propDragRef.current = { ...drag, lastCol: col, lastRow: row }
              }
            }
          }
        }
        return
      }

      if (!buildingModeRef.current) return
      const bm = buildingManagerRef.current
      if (!bm) return

      if (info.type === PointerEventTypes.POINTERDOWN) {
        const pick = scene.pick(scene.pointerX, scene.pointerY)
        if (!pick.hit || !pick.pickedPoint) return
        const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
        if (buildModeRef.current === 'build') {
          isPreviewDraggingRef.current = true
          bm.beginPreview(col, row)
          bm.updatePreview(col, row, `/assets/tiles/${wallTileIdRef.current}.svg`, `/assets/tiles/${floorTileIdRef.current}.svg`)
          previewEndRef.current = { col, row }
        } else {
          const { buildingTiles } = useRoomStore.getState()
          for (const [id, tile] of Object.entries(buildingTiles)) {
            if (tile.col === col && tile.row === row) {
              sendMsg(sessionRef.current, { type: 'building:remove', instanceId: id })
              break
            }
          }
        }
      }

      if (info.type === PointerEventTypes.POINTERMOVE && buildModeRef.current === 'build' && bm.getPreviewStart()) {
        if (draggingCornerRef.current) return
        if (!isPreviewDraggingRef.current) return
        const pick = scene.pick(scene.pointerX, scene.pointerY)
        if (!pick.hit || !pick.pickedPoint) return
        const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
        bm.updatePreview(col, row, `/assets/tiles/${wallTileIdRef.current}.svg`, `/assets/tiles/${floorTileIdRef.current}.svg`)
        previewEndRef.current = { col, row }
      }

      if (info.type === PointerEventTypes.POINTERUP) {
        isPreviewDraggingRef.current = false
      }
    })

    const handlePointerUp = (e: PointerEvent) => {
      if (dragController.consumeJustDropped()) { propDragRef.current = null; return }

      // Prop drag commit or tap-to-remove (host releases prop)
      if (propDragRef.current) {
        const { instanceId, startCol, startRow, lastCol, lastRow } = propDragRef.current
        propDragRef.current = null
        const moved = lastCol !== startCol || lastRow !== startRow
        if (moved) {
          useRoomStore.getState().moveProp(instanceId, lastCol, lastRow)
          sendMsg(sessionRef.current, { type: 'prop:move', instanceId, col: lastCol, row: lastRow })
        } else {
          const existing = useRoomStore.getState().builderProps[instanceId]
          if (existing && (existing.propId === 'door-wood' || existing.propId === 'window-wood')) {
            // Tap on interactive prop → toggle open/close
            const newState = { ...existing.state, open: !existing.state.open }
            useRoomStore.getState().setPropState(instanceId, newState)
            propManagerRef.current?.setState(instanceId, newState)
            sendMsg(sessionRef.current, { type: 'prop:interact', instanceId, state: newState })
          } else if (existing) {
            const cat = getPropCategory(existing.propId)
            if (cat === 'floor-decor' || cat === 'floor-object') {
              const rect = canvasRef.current?.getBoundingClientRect()
              const x = (rect?.left ?? 0) + scene.pointerX
              const y = (rect?.top ?? 0) + scene.pointerY
              setPropMirrorPicker({ instanceId, x, y })
              const stackCount = propManagerRef.current?.getInstanceIdsAt(existing.col, existing.row).length ?? 0
              if (stackCount > 1) setPropStackBadge({ instanceId })
            } else {
              useRoomStore.getState().removeProp(instanceId)
              propManagerRef.current?.remove(instanceId, buildingManagerRef.current!)
              sendMsg(sessionRef.current, { type: 'prop:remove', instanceId })
            }
          }
        }
        return
      }

      // Roof token tap → open RoofMenu
      if (isHost) {
        const roofTokenPick = scene.pick(scene.pointerX, scene.pointerY, (m) => !!m.metadata?.roofInstanceId)
        if (roofTokenPick?.hit && roofTokenPick.pickedMesh?.metadata?.roofInstanceId) {
          const roofInstanceId = roofTokenPick.pickedMesh.metadata.roofInstanceId as string
          const rect = canvasRef.current?.getBoundingClientRect()
          setRoofMenu({ instanceId: roofInstanceId, x: (rect?.left ?? 0) + scene.pointerX, y: (rect?.top ?? 0) + scene.pointerY })
          return
        }
      }

      // Roof placement (host in roof mode clicks building tile)
      if (isHost && roofModeRef.current) {
        const pick = scene.pick(scene.pointerX, scene.pointerY)
        if (pick?.hit && pick.pickedPoint) {
          const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
          const existingRoof = getRoofAtCell(col, row)
          if (existingRoof) {
            useRoomStore.getState().removeRoof(existingRoof.instanceId)
            roofManagerRef.current?.remove(existingRoof.instanceId)
            sendMsg(sessionRef.current, { type: 'roof:remove', instanceId: existingRoof.instanceId })
          } else {
            const cells = getConnectedBuildingCells(col, row)
            if (cells.length > 0) {
              const newId = nanoid()
              const { localPlayer: lp } = usePlayersStore.getState()
              const roof: Roof = { instanceId: newId, tileId: 'roof-thatch', cells, tokenCol: col, tokenRow: row, visible: true, createdBy: lp.playerId }
              useRoomStore.getState().placeRoof(roof)
              roofManagerRef.current?.place(roof)
              sendMsg(sessionRef.current, { type: 'roof:place', roof })
            }
          }
        }
        return
      }

      // Prop placement (host placing a selected prop on a valid cell)
      if (isHost && propModeRef.current) {
        const selectedP = selectedPropRef.current
        if (selectedP) {
          // Favor the mesh the cursor is actually over (wall face, floor tile, ground)
          // rather than the ground plane, which gives wrong cells for elevated wall meshes
          const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => !m.metadata?.propInstanceId)
          if (pick?.hit && pick.pickedPoint) {
            const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
            const isWall = buildingManagerRef.current?.isWallAt(col, row) ?? false
            const cat = selectedP.category
            const canPlace =
              (cat === 'punch-through' && isWall) ||
              (cat === 'wall-decor' && isWall) ||
              cat === 'floor-decor' ||
              cat === 'floor-object'
            const isFloorProp = cat === 'floor-decor' || cat === 'floor-object'
            const occupied = !isFloorProp && !!propManagerRef.current?.getInstanceIdAt(col, row)
            const duplicateProp = isFloorProp && (propManagerRef.current?.getInstanceIdsAt(col, row) ?? [])
              .some((id) => useRoomStore.getState().builderProps[id]?.propId === selectedP.id)
            if (canPlace && !occupied && !duplicateProp) {
              const newId = nanoid()
              const facing = (cat === 'punch-through' || cat === 'wall-decor') ? getWallFacing(col, row) : 'x'
              const existingPropCount = isFloorProp ? (propManagerRef.current?.getInstanceIdsAt(col, row).length ?? 0) : 0
              const prop = { instanceId: newId, propId: selectedP.id, col, row, state: { open: false, facing }, zOrder: existingPropCount }
              useRoomStore.getState().placeProp(prop)
              propManagerRef.current?.place(prop, selectedP.category, buildingManagerRef.current!)
              sendMsg(sessionRef.current, { type: 'prop:place', prop })
            }
          }
          return
        }
      }

      // Prop interaction (any player taps a prop mesh directly)
      if (!buildingModeRef.current) {
        const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => !!m.metadata?.propInstanceId)
        if (pick?.hit && pick.pickedMesh?.metadata?.propInstanceId) {
          const propId = pick.pickedMesh.metadata.propInstanceId as string
          const existing = useRoomStore.getState().builderProps[propId]
          if (existing && 'open' in existing.state) {
            const newState = { ...existing.state, open: !existing.state.open }
            useRoomStore.getState().setPropState(propId, newState)
            propManagerRef.current?.setState(propId, newState)
            sendMsg(sessionRef.current, { type: 'prop:interact', instanceId: propId, state: newState })
            return
          }
        }
      }

      const sprite = selectedSpriteRef.current
      if (!sprite) return

      const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.name === 'ground')
      if (!pick?.hit || !pick.pickedPoint) return

      const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
      if (isWallCell(col, row)) return
      const newInstanceId = nanoid()
      const { localPlayer: lp } = usePlayersStore.getState()
      const existingCount = Object.values(useRoomStore.getState().sprites)
        .filter((s) => s.col === col && s.row === row).length
      const instance = { instanceId: newInstanceId, spriteId: sprite.id, col, row, placedBy: lp.playerId, zOrder: existingCount, layerIndex: activeLayerIndex }
      useRoomStore.getState().placeSprite(instance)
      spriteManager.place(instance, sprite.path)
      sendMsg(sessionRef.current, { type: 'sprite:place', ...instance })
      setSelectedSprite(null)
      selectedSpriteRef.current = null
      spriteManager.hidePlacementGhost()
      if (sprite.hasDirections) {
        setDirectionPicker({ instanceId: newInstanceId, x: e.clientX, y: e.clientY })
      }
      if (existingCount > 0) setStackBadge({ instanceId: newInstanceId })
    }

    const handleDocPointerUp = (e: PointerEvent) => {
      if (!selectedSpriteRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        setSelectedSprite(null)
        selectedSpriteRef.current = null
        spriteManagerRef.current?.hidePlacementGhost()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSprite(null)
        selectedSpriteRef.current = null
        spriteManager.hidePlacementGhost()
      }
    }

    const handlePointerDown = (_e: PointerEvent) => {
      propDragRef.current = null
      setPropMirrorPicker(null)
      setPropStackBadge(null)
      if (!isHost || propModeRef.current || buildingModeRef.current || roofModeRef.current) return
      if (selectedSpriteRef.current) return  // sprite placement takes priority
      // Don't start prop drag when tapping roof token
      const roofTokenPick = scene.pick(scene.pointerX, scene.pointerY, (m) => !!m.metadata?.roofInstanceId)
      if (roofTokenPick?.hit) return
      const propPick = scene.pick(scene.pointerX, scene.pointerY, (m) => !!m.metadata?.propInstanceId)
      if (propPick?.hit && propPick.pickedMesh?.metadata?.propInstanceId) {
        const propInstanceId = propPick.pickedMesh.metadata.propInstanceId as string
        const prop = useRoomStore.getState().builderProps[propInstanceId]
        if (prop) {
          propDragRef.current = { instanceId: propInstanceId, startCol: prop.col, startRow: prop.row, lastCol: prop.col, lastRow: prop.row }
        }
      }
    }
    const canvas = canvasRef.current
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointerup', handleDocPointerUp)
    window.addEventListener('keydown', handleKeyDown)

    sessionRef.current = createSession(isHost, roomId, scene, spriteManager, buildingManagerRef.current!, propManagerRef.current!, roofManagerRef.current!, layerBackgroundManagerRef.current!, cursorManager, setConnected)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointerup', handleDocPointerUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updateCanvasRect)
      camera.onViewMatrixChangedObservable.remove(cameraObserver)
      bgCleanupRef.current()
      bgCleanupRef.current = () => {}
      buildingManagerRef.current?.dispose()
      buildingManagerRef.current = null
      propManagerRef.current?.dispose()
      propManagerRef.current = null
      roofManagerRef.current?.dispose()
      roofManagerRef.current = null
      layerBackgroundManagerRef.current?.dispose()
      layerBackgroundManagerRef.current = null
      weatherSystemRef.current?.dispose()
      weatherSystemRef.current = null
      spriteManagerRef.current = null
      dragControllerRef.current = null
      groundRef.current = null
      sessionRef.current?.dispose()
      engine.dispose()
    }
  }, [needsName, roomId, isHost])

  useEffect(() => {
    const scene = sceneRef.current
    const canvas = canvasRef.current
    if (!buildingMode || !scene || !canvas) return

    const observer = scene.onBeforeRenderObservable.add(() => {
      const bm = buildingManagerRef.current
      const end = previewEndRef.current
      if (!bm || !end) { setScreenCorners(null); return }

      const worldCorners = bm.getPreviewWorldCorners(end.col, end.row)
      if (!worldCorners) { setScreenCorners(null); return }

      const engine = scene.getEngine()
      const camera = scene.activeCamera
      if (!camera) { setScreenCorners(null); return }
      const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
      const transform = scene.getTransformMatrix()

      // Fix: scale canvas-relative pixels to page-absolute coordinates
      const cvs = canvasRef.current
      if (!cvs) { setScreenCorners(null); return }
      const canvasBounds = cvs.getBoundingClientRect()
      const scaleX = canvasBounds.width / engine.getRenderWidth()
      const scaleY = canvasBounds.height / engine.getRenderHeight()

      const project = (v: Vector3) => {
        const s = Vector3.Project(v, Matrix.Identity(), transform, viewport)
        return { x: s.x * scaleX + canvasBounds.left, y: s.y * scaleY + canvasBounds.top }
      }

      const rect = bm.getPreviewStart()
      if (!rect) { setScreenCorners(null); return }
      const { minCol, minRow, maxCol, maxRow } = normalizeRect({ startCol: rect.startCol, startRow: rect.startRow, endCol: end.col, endRow: end.row })

      setScreenCorners({
        nw: project(worldCorners.nw),
        ne: project(worldCorners.ne),
        sw: project(worldCorners.sw),
        se: project(worldCorners.se),
        center: project(worldCorners.center),
        width: maxCol - minCol + 1,
        height: maxRow - minRow + 1,
      })
    })

    return () => { scene.onBeforeRenderObservable.remove(observer) }
  }, [buildingMode])

  useEffect(() => {
    if (!buildingMode) return

    const onMove = (e: PointerEvent) => {
      const bm = buildingManagerRef.current
      const scene = sceneRef.current
      if (!bm || !scene) return

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const pick = scene.pick(e.clientX - rect.left, e.clientY - rect.top)
      if (!pick.hit || !pick.pickedPoint) return
      const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)

      const roomDrag = draggingRoomRef.current
      if (roomDrag !== null) {
        const dc = col - roomDrag.lastCol
        const dr = row - roomDrag.lastRow
        if (dc !== 0 || dr !== 0) {
          const previewRect = bm.getPreviewStart()
          const end = previewEndRef.current
          if (previewRect && end) {
            bm.setPreviewStart(previewRect.startCol + dc, previewRect.startRow + dr)
            const newEnd = { col: end.col + dc, row: end.row + dr }
            previewEndRef.current = newEnd
            bm.updatePreview(newEnd.col, newEnd.row, `/assets/tiles/${wallTileIdRef.current}.svg`, `/assets/tiles/${floorTileIdRef.current}.svg`)
            draggingRoomRef.current = { lastCol: col, lastRow: row }
          }
        }
        return
      }

      const corner = draggingCornerRef.current
      if (!corner) return
      // Removed: reanchor logic (was oscillating — reanchor now happens once in onCornerDragStart)
      bm.updatePreview(col, row, `/assets/tiles/${wallTileIdRef.current}.svg`, `/assets/tiles/${floorTileIdRef.current}.svg`)
      previewEndRef.current = { col, row }
    }

    const onUp = () => {
      draggingCornerRef.current = null
      draggingRoomRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [buildingMode])

  const handleRoomDragStart = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const scene = sceneRef.current
    if (!rect || !scene) return
    const pick = scene.pick(e.clientX - rect.left, e.clientY - rect.top)
    if (!pick.hit || !pick.pickedPoint) return
    const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
    draggingRoomRef.current = { lastCol: col, lastRow: row }
  }

  const handlePlaceRoom = () => {
    const bm = buildingManagerRef.current
    const end = previewEndRef.current
    const session = sessionRef.current
    if (!bm || !end || !(session instanceof HostSession)) return
    const { buildingTiles } = useRoomStore.getState()
    const { tiles, removedIds } = bm.commitPreview(end.col, end.row, wallTileId, floorTileId, buildingTiles, mergeMode)
    for (const instanceId of removedIds) {
      session.localAction({ type: 'building:remove', instanceId })
    }
    for (const tile of tiles) {
      session.localAction({ type: 'building:place', tile })
    }
    previewEndRef.current = null
    setScreenCorners(null)
  }

  const dispatchMsg = (msg: SessionMsg) => sendMsg(sessionRef.current, msg)

  const zoomToCell = (col: number, row: number) => {
    const camera = cameraRef.current
    if (!camera) return
    const { x, z } = cellToWorld(col, row)
    camera.target.set(x, 0, z)
    camera.radius = 10
  }

  const resetCameraZoom = () => {
    const camera = cameraRef.current
    if (!camera) return
    const saved = cameraPreOpenStateRef.current
    if (saved) {
      camera.target.set(saved.target.x, saved.target.y, saved.target.z)
      camera.radius = saved.radius
      cameraPreOpenStateRef.current = null
    } else {
      camera.target.set(0, 0, 0)
      camera.radius = 24
    }
  }

  const openBuilder = (instanceId: string, definition: TokenDefinition) => {
    const sprite = useRoomStore.getState().sprites[instanceId]
    const camera = cameraRef.current
    if (camera) {
      cameraPreOpenStateRef.current = {
        target: { x: camera.target.x, y: camera.target.y, z: camera.target.z },
        radius: camera.radius,
      }
    }
    setBuilderInstanceId(instanceId)
    setBuilderDefinition(definition)
    setBuilderOriginalDef(definition)
    setBuilderOpen(true)
    if (sprite) zoomToCell(sprite.col, sprite.row)
  }

  const handleNewToken = () => {
    const { localPlayer } = usePlayersStore.getState()
    const definitionId = nanoid()
    const definition: TokenDefinition = { definitionId, ownedBy: localPlayer.playerId, layers: {} }
    const instanceId = nanoid()
    const { sprites } = useRoomStore.getState()
    const col = 0, row = 0
    const zOrder = Object.values(sprites).filter((s) => s.col === col && s.row === row).length
    const instance = { instanceId, spriteId: 'custom', col, row, placedBy: localPlayer.playerId, zOrder, definitionId, layerIndex: activeLayerIndex }
    const url = compositeToDataUrl(definition)
    const backUrl = compositeToDataUrl(definition, false)
    useRoomStore.getState().placeSprite(instance)
    spriteManagerRef.current?.place(instance, url)
    spriteManagerRef.current?.setTokenDataUrls(instanceId, url, backUrl)
    useTokenStore.getState().addOrUpdate(definition)
    // Do NOT broadcast yet — wait until Save
    builderIsNewTokenRef.current = true
    openBuilder(instanceId, definition)
  }

  const handleBuilderChange = (newDef: TokenDefinition) => {
    setBuilderDefinition(newDef)
    if (!builderInstanceId) return
    const url = compositeToDataUrl(newDef)
    const backUrl = compositeToDataUrl(newDef, false)
    spriteManagerRef.current?.updateTexture(builderInstanceId, url)
    spriteManagerRef.current?.setTokenDataUrls(builderInstanceId, url, backUrl)
  }

  const handleBuilderSave = () => {
    if (!builderDefinition || !builderInstanceId) return
    useTokenStore.getState().addOrUpdate(builderDefinition)
    dispatchMsg({ type: 'token:define', definition: builderDefinition })
    const savedInstanceId = builderInstanceId
    const wasNew = builderIsNewTokenRef.current
    if (wasNew) {
      const sprite = useRoomStore.getState().sprites[builderInstanceId]
      if (sprite) dispatchMsg({ type: 'sprite:place', ...sprite, layerIndex: sprite.layerIndex ?? activeLayerIndex })
    }
    builderIsNewTokenRef.current = false
    setBuilderOpen(false)
    setBuilderInstanceId(null)
    setBuilderDefinition(null)
    setBuilderOriginalDef(null)
    resetCameraZoom()
    if (wasNew) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) setDirectionPicker({ instanceId: savedInstanceId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    }
  }

  const handleBuilderCancel = () => {
    if (builderIsNewTokenRef.current && builderInstanceId) {
      // Remove the ghost token — it was never broadcast, so no need to send remove
      useRoomStore.getState().removeSprite(builderInstanceId)
      spriteManagerRef.current?.remove(builderInstanceId)
      useTokenStore.getState().remove(builderDefinition?.definitionId ?? '')
    } else if (builderOriginalDef && builderInstanceId) {
      const url = compositeToDataUrl(builderOriginalDef)
      const backUrl = compositeToDataUrl(builderOriginalDef, false)
      spriteManagerRef.current?.updateTexture(builderInstanceId, url)
      spriteManagerRef.current?.setTokenDataUrls(builderInstanceId, url, backUrl)
    }
    builderIsNewTokenRef.current = false
    setBuilderOpen(false)
    setBuilderInstanceId(null)
    setBuilderDefinition(null)
    setBuilderOriginalDef(null)
    resetCameraZoom()
  }

  const handleLayerSelect = (layerIndex: number) => {
    setActiveLayerIndex(layerIndex)
  }

  const handleLayerToggleVisible = (layerIndex: number) => {
    if (!isHost) return
    const newVisible = !(layers[layerIndex]?.visible ?? true)
    dispatchMsg({ type: 'layer:config', layerIndex, visible: newVisible })
  }

  const handleLayerSetBackground = (layerIndex: number, bg: LayerBackground) => {
    if (!isHost) return
    dispatchMsg({ type: 'layer:config', layerIndex, background: bg })
  }

  const handleMoveTokenLayer = (instanceId: string, newLayerIndex: number) => {
    const sprite = useRoomStore.getState().sprites[instanceId]
    if (!sprite) return
    useRoomStore.getState().moveSprite(instanceId, sprite.col, sprite.row, newLayerIndex)
    spriteManagerRef.current?.setLayer(instanceId, newLayerIndex)
    sendMsg(sessionRef.current, { type: 'sprite:move', instanceId, col: sprite.col, row: sprite.row, layerIndex: newLayerIndex })
    setTokenLayerMover((prev: { instanceId: string; x: number; y: number; layerIndex: number } | null) => prev ? { ...prev, layerIndex: newLayerIndex } : null)
  }

  const handleAdvanceStack = () => {
    if (!stackBadge) return
    const { sprites } = useRoomStore.getState()
    const sprite = sprites[stackBadge.instanceId]
    if (!sprite) return

    const stack = Object.values(sprites)
      .filter((s) => s.col === sprite.col && s.row === sprite.row)
      .sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0))

    if (stack.length <= 1) return

    const idx = stack.findIndex((s) => s.instanceId === stackBadge.instanceId)
    if (idx < 0) return
    const nextIdx = (idx + 1) % stack.length

    // Normalize to sequential zOrders so swap always produces a visible change
    stack.forEach((s, i) => {
      if ((s.zOrder ?? -1) !== i) {
        useRoomStore.getState().setZOrder(s.instanceId, i)
        spriteManagerRef.current?.setZOrder(s.instanceId, i)
        dispatchMsg({ type: 'sprite:zorder', instanceId: s.instanceId, zOrder: i })
      }
    })

    // After normalization, sprite at position idx has zOrder=idx, next has zOrder=nextIdx
    useRoomStore.getState().setZOrder(stack[idx].instanceId, nextIdx)
    useRoomStore.getState().setZOrder(stack[nextIdx].instanceId, idx)
    spriteManagerRef.current?.setZOrder(stack[idx].instanceId, nextIdx)
    spriteManagerRef.current?.setZOrder(stack[nextIdx].instanceId, idx)
    dispatchMsg({ type: 'sprite:zorder', instanceId: stack[idx].instanceId, zOrder: nextIdx })
    dispatchMsg({ type: 'sprite:zorder', instanceId: stack[nextIdx].instanceId, zOrder: idx })
  }

  const handleAdvancePropStack = () => {
    if (!propStackBadge) return
    const { builderProps } = useRoomStore.getState()
    const prop = builderProps[propStackBadge.instanceId]
    if (!prop) return
    const stack = Object.values(builderProps)
      .filter((p) => p.col === prop.col && p.row === prop.row)
      .sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0))
    if (stack.length <= 1) return
    const idx = stack.findIndex((p) => p.instanceId === propStackBadge.instanceId)
    if (idx < 0) return
    const nextIdx = (idx + 1) % stack.length
    stack.forEach((p, i) => {
      if ((p.zOrder ?? -1) !== i) {
        useRoomStore.getState().setPropZOrder(p.instanceId, i)
        propManagerRef.current?.setPropZOrder(p.instanceId, i)
        dispatchMsg({ type: 'prop:zorder', instanceId: p.instanceId, zOrder: i })
      }
    })
    useRoomStore.getState().setPropZOrder(stack[idx].instanceId, nextIdx)
    useRoomStore.getState().setPropZOrder(stack[nextIdx].instanceId, idx)
    propManagerRef.current?.setPropZOrder(stack[idx].instanceId, nextIdx)
    propManagerRef.current?.setPropZOrder(stack[nextIdx].instanceId, idx)
    dispatchMsg({ type: 'prop:zorder', instanceId: stack[idx].instanceId, zOrder: nextIdx })
    dispatchMsg({ type: 'prop:zorder', instanceId: stack[nextIdx].instanceId, zOrder: idx })
  }

  const handleMirrorProp = (instanceId: string, mirrored: boolean) => {
    const existing = useRoomStore.getState().builderProps[instanceId]
    if (!existing) return
    const newState = { ...existing.state, mirrored }
    useRoomStore.getState().setPropState(instanceId, newState)
    propManagerRef.current?.setState(instanceId, newState)
    dispatchMsg({ type: 'prop:interact', instanceId, state: newState })
    setPropMirrorPicker(null)
  }

  const handleRemovePropFromPicker = (instanceId: string) => {
    useRoomStore.getState().removeProp(instanceId)
    propManagerRef.current?.remove(instanceId, buildingManagerRef.current!)
    dispatchMsg({ type: 'prop:remove', instanceId })
    setPropMirrorPicker(null)
    setPropStackBadge(null)
  }

  if (needsName) return <JoinDialog onDone={() => setNeedsName(false)} />

  const activeSprite = tokenMenu ? sprites[tokenMenu.instanceId] : null

  return (
    <>
      <TopBar />
      <Sidebar
        isHost={isHost}
        selectedSpriteId={selectedSprite?.id ?? null}
        onSpriteSelect={handleSelectSprite}
        onSpriteDeselect={handleDeselectSprite}
        activeWeather={currentWeather}
        onWeatherChange={handleWeatherChange}
        activeBackground={currentBackground}
        onBackgroundChange={handleBackgroundChange}
        onNewToken={handleNewToken}
        onBuildingModeChange={(active) => {
          setBuildingMode(active)
          if (!active) {
            buildingManagerRef.current?.cancelPreview()
            previewEndRef.current = null
          }
        }}
        onRoofModeChange={(active) => { roofModeRef.current = active }}
        buildPanel={{
          wallTileId,
          floorTileId,
          buildMode,
          mergeMode,
          tiles,
          onWallSelect: (id) => { setWallTileId(id); wallTileIdRef.current = id },
          onFloorSelect: (id) => { setFloorTileId(id); floorTileIdRef.current = id },
          onBuildModeChange: (m) => { setBuildMode(m); buildModeRef.current = m },
          onMergeModeChange: (m) => { setMergeMode(m); mergeModeRef.current = m },
        }}
        selectedPropId={selectedProp?.id ?? null}
        onPropSelect={(entry) => { setSelectedProp(entry); selectedPropRef.current = entry }}
        onPropDeselect={() => { setSelectedProp(null); selectedPropRef.current = null }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', top: 48, left: 268, right: 0, bottom: 0, width: 'calc(100vw - 268px)', height: 'calc(100vh - 48px)' }}
      />
      <TokenHUD scene={sceneRef.current} canvasLeft={canvasRect.left} canvasTop={canvasRect.top} />
      {tokenMenu && activeSprite && (
        <TokenMenu
          instanceId={tokenMenu.instanceId}
          activeStatuses={activeSprite.statuses ?? []}
          activeAnimation={activeSprite.animation ?? ''}
          currentSpeech={activeSprite.speech ?? ''}
          isHidden={activeSprite.hidden ?? false}
          onEmote={(instanceId, emote) => {
            if (sceneRef.current) showEmote(sceneRef.current, activeSprite.col, activeSprite.row, emote)
            dispatchMsg({ type: 'sprite:emote', instanceId, emote })
          }}
          onToggleStatus={(instanceId, statuses) => {
            useRoomStore.getState().setStatuses(instanceId, statuses)
            spriteManagerRef.current?.setStatuses(instanceId, statuses)
            dispatchMsg({ type: 'sprite:status', instanceId, statuses })
          }}
          onAnimate={(instanceId, animation) => {
            useRoomStore.getState().setAnimation(instanceId, animation)
            spriteManagerRef.current?.setAnimation(instanceId, animation)
            dispatchMsg({ type: 'sprite:animate', instanceId, animation })
          }}
          onSpeech={(instanceId, speech) => {
            useRoomStore.getState().setSpeech(instanceId, speech)
            dispatchMsg({ type: 'sprite:speech', instanceId, speech })
          }}
          onToggleHide={(instanceId, hidden) => {
            useRoomStore.getState().setHidden(instanceId, hidden)
            spriteManagerRef.current?.setHidden(instanceId, hidden)
            dispatchMsg({ type: 'sprite:hide', instanceId, hidden })
          }}
          onRemove={(instanceId) => {
            dispatchMsg({ type: 'sprite:remove', instanceId })
            setTokenMenu(null)
            setStackBadge(null)
          }}
          onEditToken={
            activeSprite?.definitionId
              ? () => {
                  const def = useTokenStore.getState().definitions[activeSprite.definitionId!]
                  if (def) { setTokenMenu(null); openBuilder(tokenMenu!.instanceId, def) }
                }
              : undefined
          }
        />
      )}
      {directionPicker && (
        <DirectionPicker
          screenX={directionPicker.x}
          screenY={directionPicker.y}
          cameraAlpha={cameraAlpha}
          onPick={(facing: FacingDir) => {
            const { instanceId } = directionPicker
            useRoomStore.getState().faceSprite(instanceId, facing)
            spriteManagerRef.current?.setFacing(instanceId, facing)
            dispatchMsg({ type: 'sprite:face', instanceId, facing })
            setDirectionPicker(null)
          }}
          onDismiss={() => setDirectionPicker(null)}
        />
      )}
      {tokenLayerMover && (
        <TokenLayerMover
          instanceId={tokenLayerMover.instanceId}
          layerIndex={tokenLayerMover.layerIndex}
          x={tokenLayerMover.x}
          y={tokenLayerMover.y}
          canInteract={
            !!usePlayersStore.getState().localPlayer &&
            (isHost || useRoomStore.getState().sprites[tokenLayerMover.instanceId]?.placedBy === usePlayersStore.getState().localPlayer.playerId)
          }
          onMoveLayer={handleMoveTokenLayer}
        />
      )}
      {roofMenu && roofs[roofMenu.instanceId] && (
        <RoofMenu
          instanceId={roofMenu.instanceId}
          visible={roofs[roofMenu.instanceId].visible}
          tileId={roofs[roofMenu.instanceId].tileId}
          x={roofMenu.x}
          y={roofMenu.y}
          onToggleVisible={(instanceId, visible) => {
            useRoomStore.getState().setRoofVisible(instanceId, visible)
            roofManagerRef.current?.setVisible(instanceId, visible)
            sendMsg(sessionRef.current, { type: 'roof:visible', instanceId, visible })
          }}
          onChangeTile={(instanceId, tileId) => {
            useRoomStore.getState().setRoofTile(instanceId, tileId)
            roofManagerRef.current?.setTile(instanceId, tileId)
            sendMsg(sessionRef.current, { type: 'roof:tile', instanceId, tileId })
          }}
          onRemove={(instanceId) => {
            useRoomStore.getState().removeRoof(instanceId)
            roofManagerRef.current?.remove(instanceId)
            sendMsg(sessionRef.current, { type: 'roof:remove', instanceId })
          }}
          onClose={() => setRoofMenu(null)}
        />
      )}
      {stackBadge && sceneRef.current && (
        <StackBadge
          instanceId={stackBadge.instanceId}
          scene={sceneRef.current}
          canvasLeft={canvasRect.left}
          canvasTop={canvasRect.top}
          onAdvance={handleAdvanceStack}
        />
      )}
      {propMirrorPicker && (
        <PropMirrorPicker
          instanceId={propMirrorPicker.instanceId}
          screenX={propMirrorPicker.x}
          screenY={propMirrorPicker.y}
          isHost={isHost}
          onMirror={handleMirrorProp}
          onRemove={handleRemovePropFromPicker}
        />
      )}
      {propStackBadge && sceneRef.current && (
        <PropStackBadge
          instanceId={propStackBadge.instanceId}
          scene={sceneRef.current}
          canvasLeft={canvasRect.left}
          canvasTop={canvasRect.top}
          onAdvance={handleAdvancePropStack}
        />
      )}
      {builderOpen && builderDefinition && (
        <TokenBuilder
          definition={builderDefinition}
          onChange={handleBuilderChange}
          onSave={handleBuilderSave}
          onCancel={handleBuilderCancel}
        />
      )}
      {buildingMode && (
        <>
          <BuildingControls
            corners={screenCorners}
            mergeMode={mergeMode}
            onMergeModeChange={setMergeMode}
            onPlace={handlePlaceRoom}
            onRoomDragStart={handleRoomDragStart}
            onCornerDragStart={(corner) => {
              const bm = buildingManagerRef.current
              const previewRect = bm?.getPreviewStart()
              const end = previewEndRef.current
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
              draggingCornerRef.current = corner
            }}
          />
        </>
      )}
      {!connected && !isHost && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
          <p style={{ color: '#fff', fontSize: 20 }}>Connecting to host…</p>
        </div>
      )}
      <LayerPanel
        isHost={isHost}
        layers={layers}
        activeLayerIndex={activeLayerIndex}
        onSelectLayer={handleLayerSelect}
        onToggleVisible={handleLayerToggleVisible}
        onSetBackground={handleLayerSetBackground}
      />
    </>
  )
}

function setupDragController(
  scene: Scene,
  spriteManager: SpriteManager,
  camera: ArcRotateCamera,
  sessionRef: React.MutableRefObject<HostSession | GuestSession | null>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  showDirPickerAtPointer: (instanceId: string) => void,
  setTokenMenu: (m: TokenMenuState | null) => void,
  setStackBadge: (b: { instanceId: string } | null) => void,
  buildingModeRef: React.MutableRefObject<boolean>,
  setTokenLayerMover: (m: { instanceId: string; x: number; y: number; layerIndex: number } | null) => void,
): DragController {
  return new DragController(scene, spriteManager, camera, {
    onDragMove: (instanceId, col, row) => {
      if (buildingModeRef.current) return
      sendMsg(sessionRef.current, { type: 'sprite:drag', instanceId, col, row })
    },
    canDrop: (col, row) => !isWallCell(col, row),
    onDragDrop: (instanceId, col, row) => {
      if (buildingModeRef.current) return

      const { builderProps, sprites } = useRoomStore.getState()
      const staircase = Object.values(builderProps).find(
        (p) => p.col === col && p.row === row && (p.propId === 'stair-up' || p.propId === 'stair-down'),
      )

      const currentSprite = sprites[instanceId]
      const currentLayer = currentSprite?.layerIndex ?? 5

      if (staircase && currentSprite) {
        const delta = staircase.propId === 'stair-up' ? 1 : -1
        const newLayer = Math.max(1, Math.min(9, currentLayer + delta))
        useRoomStore.getState().moveSprite(instanceId, col, row, newLayer)
        spriteManager.move(instanceId, col, row)
        spriteManager.setLayer(instanceId, newLayer)
        sendMsg(sessionRef.current, { type: 'sprite:move', instanceId, col, row, layerIndex: newLayer })
        setTokenLayerMover(null)
      } else {
        useRoomStore.getState().moveSprite(instanceId, col, row)
        sendMsg(sessionRef.current, { type: 'sprite:move', instanceId, col, row })
      }

      if (spriteManager.getMesh(instanceId)?.metadata?.hasDirections) showDirPickerAtPointer(instanceId)
      const updatedSprites = useRoomStore.getState().sprites
      const count = Object.values(updatedSprites).filter((s) => s.col === col && s.row === row).length
      setStackBadge(count > 1 ? { instanceId } : null)
    },
    onSpriteClick: (instanceId) => {
      if (buildingModeRef.current) return
      const rect = canvasRef.current?.getBoundingClientRect()
      const sx = (rect?.left ?? 0) + scene.pointerX
      const sy = (rect?.top ?? 0) + scene.pointerY
      setTokenMenu({ instanceId, x: sx, y: sy })
      const spriteData = useRoomStore.getState().sprites[instanceId]
      if (spriteData) {
        setTokenLayerMover({ instanceId, x: sx, y: sy, layerIndex: spriteData.layerIndex ?? 5 })
      }
      if (spriteManager.getMesh(instanceId)?.metadata?.hasDirections) showDirPickerAtPointer(instanceId)
      const { sprites } = useRoomStore.getState()
      const tapped = sprites[instanceId]
      if (tapped) {
        const count = Object.values(sprites).filter((s) => s.col === tapped.col && s.row === tapped.row).length
        setStackBadge(count > 1 ? { instanceId } : null)
      }
    },
  })
}

function setupScenePointerObservable(
  scene: Scene,
  spriteManager: SpriteManager,
  dragController: DragController,
  selectedSpriteRef: React.MutableRefObject<SpriteManifestEntry | null>,
  sessionRef: React.MutableRefObject<HostSession | GuestSession | null>,
  setTokenMenu: (m: TokenMenuState | null) => void,
  setDirectionPicker: (d: { instanceId: string; x: number; y: number } | null) => void,
  setRoofMenu: (m: { instanceId: string; x: number; y: number } | null) => void,
  setStackBadge: (b: { instanceId: string } | null) => void,
  buildingModeRef: React.MutableRefObject<boolean>,
  setTokenLayerMover: (m: { instanceId: string; x: number; y: number; layerIndex: number } | null) => void,
): void {
  scene.onPointerObservable.add((info) => {
    if (info.type === PointerEventTypes.POINTERDOWN) {
      setDirectionPicker(null)
      setTokenMenu(null)
      setRoofMenu(null)
      setStackBadge(null)
      setTokenLayerMover(null)
    }

    if (info.type !== PointerEventTypes.POINTERMOVE) return
    if (buildingModeRef.current) return

    const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.name === 'ground')

    const sprite = selectedSpriteRef.current
    if (sprite && !dragController.isDragging()) {
      if (pick?.hit && pick.pickedPoint) {
        const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
        spriteManager.showPlacementGhost(sprite.id, sprite.path, col, row)
      } else {
        spriteManager.hidePlacementGhost()
      }
    } else if (!sprite) {
      spriteManager.hidePlacementGhost()
    }

    if (pick?.hit && pick.pickedPoint) {
      const { playerId } = usePlayersStore.getState().localPlayer
      sendMsg(sessionRef.current, { type: 'cursor:move', playerId, worldX: pick.pickedPoint.x, worldZ: pick.pickedPoint.z })
    }
  })
}

function createSession(
  isHost: boolean,
  roomId: string | undefined,
  scene: Scene,
  spriteManager: SpriteManager,
  buildingManager: BuildingManager,
  propManager: PropManager,
  roofManager: RoofManager,
  layerBackgroundManager: LayerBackgroundManager,
  cursorManager: CursorManager,
  setConnected: (v: boolean) => void,
): HostSession | GuestSession | null {
  if (isHost) {
    return new HostSession(scene, spriteManager, buildingManager, propManager, roofManager, layerBackgroundManager, cursorManager, (newRoomId) => {
      window.history.replaceState(null, '', `/room/${newRoomId}`)
      useRoomStore.getState().setRoomId(newRoomId)
    })
  }
  if (roomId && roomId !== 'new') {
    return new GuestSession(
      roomId,
      scene,
      spriteManager,
      buildingManager,
      propManager,
      roofManager,
      layerBackgroundManager,
      cursorManager,
      () => setConnected(true),
      () => alert('Host disconnected'),
    )
  }
  return null
}
