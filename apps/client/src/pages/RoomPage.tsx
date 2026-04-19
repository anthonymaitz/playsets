import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { PointerEventTypes, Vector3, Matrix } from '@babylonjs/core'
import type { Scene, ArcRotateCamera } from '@babylonjs/core'
import { BuildingManager } from '../babylon/buildings'
import { BuildingPalette } from '../components/BuildingPalette'
import { BuildingControls } from '../components/BuildingControls'
import type { ScreenCorners } from '../components/BuildingControls'
import { normalizeRect } from '../babylon/buildingUtils'
import { createScene } from '../babylon/scene'
import { createGrid, setGridBackground, worldToCell } from '../babylon/grid'
import { SpriteManager } from '../babylon/sprites'
import { WeatherSystem } from '../babylon/weather'
import { DragController } from '../babylon/drag'
import { CursorManager } from '../babylon/cursors'
import { showEmote } from '../babylon/emotes'
import { HostSession } from '../networking/host'
import { GuestSession } from '../networking/guest'
import { TopBar } from '../components/TopBar'
import { SpritePicker } from '../components/SpritePicker'
import { DirectionPicker } from '../components/DirectionPicker'
import { JoinDialog } from '../components/JoinDialog'
import { TokenMenu } from '../components/token-menu/TokenMenu'
import { TokenHUD } from '../components/TokenHUD'
import { usePlayersStore } from '../store/players'
import { useRoomStore } from '../store/room'
import type { SpriteManifestEntry, FacingDir, WeatherType, BackgroundType } from '../types'
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

  const [needsName, setNeedsName] = useState(true)
  const [selectedSprite, setSelectedSprite] = useState<SpriteManifestEntry | null>(null)
  const [tokenMenu, setTokenMenu] = useState<TokenMenuState | null>(null)
  const [directionPicker, setDirectionPicker] = useState<{ instanceId: string; x: number; y: number } | null>(null)
  const [connected, setConnected] = useState(isHost)
  const [canvasRect, setCanvasRect] = useState({ left: 200, top: 48 })
  const [currentWeather, setCurrentWeather] = useState<WeatherType>('sunny')
  const [currentBackground, setCurrentBackground] = useState<BackgroundType>('grass')
  const [cameraAlpha, setCameraAlpha] = useState(-Math.PI / 4)
  const [buildingMode, setBuildingMode] = useState(false)
  const [buildMode, setBuildMode] = useState<'build' | 'erase'>('build')
  const [wallTileId, setWallTileId] = useState('wall-wood')
  const [floorTileId, setFloorTileId] = useState('floor-dirt')
  const [mergeMode, setMergeMode] = useState<'open' | 'walled'>('open')
  const [screenCorners, setScreenCorners] = useState<ScreenCorners | null>(null)

  const sprites = useRoomStore((s) => s.sprites)

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

  useEffect(() => {
    if (needsName || !canvasRef.current) return

    bgCleanupRef.current = () => {}
    const { engine, scene, camera, ambientLight } = createScene(canvasRef.current)
    sceneRef.current = scene
    const ground = createGrid(scene)
    groundRef.current = ground
    const spriteManager = new SpriteManager(scene, camera, isHost)
    spriteManagerRef.current = spriteManager
    buildingManagerRef.current = new BuildingManager(scene)
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

    const dragController = setupDragController(scene, spriteManager, camera, sessionRef, canvasRef, showDirPickerAtPointer, setTokenMenu, buildingModeRef)
    dragControllerRef.current = dragController

    setupScenePointerObservable(scene, spriteManager, dragController, selectedSpriteRef, sessionRef, setTokenMenu, setDirectionPicker, buildingModeRef)

    scene.onPointerObservable.add((info) => {
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
      if (dragController.consumeJustDropped()) return

      const sprite = selectedSpriteRef.current
      if (!sprite) return

      const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.name === 'ground')
      if (!pick?.hit || !pick.pickedPoint) return

      const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
      const newInstanceId = nanoid()
      const { localPlayer: lp } = usePlayersStore.getState()
      const instance = { instanceId: newInstanceId, spriteId: sprite.id, col, row, placedBy: lp.playerId }
      useRoomStore.getState().placeSprite(instance)
      spriteManager.place(instance, sprite.path)
      sendMsg(sessionRef.current, { type: 'sprite:place', ...instance })
      setSelectedSprite(null)
      selectedSpriteRef.current = null
      spriteManager.hidePlacementGhost()
      if (sprite.hasDirections) {
        setDirectionPicker({ instanceId: newInstanceId, x: e.clientX, y: e.clientY })
      }
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

    const canvas = canvasRef.current
    canvas.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointerup', handleDocPointerUp)
    window.addEventListener('keydown', handleKeyDown)

    sessionRef.current = createSession(isHost, roomId, scene, spriteManager, buildingManagerRef.current!, cursorManager, setConnected)

    return () => {
      canvas.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointerup', handleDocPointerUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updateCanvasRect)
      camera.onViewMatrixChangedObservable.remove(cameraObserver)
      bgCleanupRef.current()
      bgCleanupRef.current = () => {}
      buildingManagerRef.current?.dispose()
      buildingManagerRef.current = null
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

  if (needsName) return <JoinDialog onDone={() => setNeedsName(false)} />

  const activeSprite = tokenMenu ? sprites[tokenMenu.instanceId] : null

  return (
    <>
      <TopBar />
      <SpritePicker
        selectedSpriteId={selectedSprite?.id ?? null}
        onSelect={handleSelectSprite}
        onDeselect={handleDeselectSprite}
        activeWeather={currentWeather}
        onWeatherChange={handleWeatherChange}
        activeBackground={currentBackground}
        onBackgroundChange={handleBackgroundChange}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', top: 48, left: 200, right: 0, bottom: 0, width: 'calc(100vw - 200px)', height: 'calc(100vh - 48px)' }}
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
      {isHost && (
        <button
          onClick={() => {
            setBuildingMode((prev) => {
              if (prev) {
                buildingManagerRef.current?.cancelPreview()
                previewEndRef.current = null
              }
              return !prev
            })
          }}
          style={{
            position: 'fixed',
            left: 8,
            bottom: 8,
            width: 36,
            height: 36,
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: buildingMode ? '#c8893a' : 'rgba(255,255,255,0.08)',
            boxShadow: buildingMode ? '0 0 8px rgba(200,137,58,0.5)' : 'none',
            fontSize: 16,
            zIndex: 50,
          }}
          title="Building Tools"
        >
          🏠
        </button>
      )}
      {buildingMode && (
        <>
          <BuildingPalette
            wallTileId={wallTileId}
            floorTileId={floorTileId}
            mode={buildMode}
            onWallSelect={setWallTileId}
            onFloorSelect={setFloorTileId}
            onModeChange={setBuildMode}
          />
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
  buildingModeRef: React.MutableRefObject<boolean>,
): DragController {
  return new DragController(scene, spriteManager, camera, {
    onDragMove: (instanceId, col, row) => {
      if (buildingModeRef.current) return
      sendMsg(sessionRef.current, { type: 'sprite:drag', instanceId, col, row })
    },
    onDragDrop: (instanceId, col, row) => {
      if (buildingModeRef.current) return
      useRoomStore.getState().moveSprite(instanceId, col, row)
      sendMsg(sessionRef.current, { type: 'sprite:move', instanceId, col, row })
      if (spriteManager.getMesh(instanceId)?.metadata?.hasDirections) showDirPickerAtPointer(instanceId)
    },
    onSpriteClick: (instanceId) => {
      if (buildingModeRef.current) return
      const rect = canvasRef.current?.getBoundingClientRect()
      const sx = (rect?.left ?? 0) + scene.pointerX
      const sy = (rect?.top ?? 0) + scene.pointerY
      setTokenMenu({ instanceId, x: sx, y: sy })
      if (spriteManager.getMesh(instanceId)?.metadata?.hasDirections) showDirPickerAtPointer(instanceId)
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
  buildingModeRef: React.MutableRefObject<boolean>,
): void {
  scene.onPointerObservable.add((info) => {
    if (info.type === PointerEventTypes.POINTERDOWN) {
      setDirectionPicker(null)
      setTokenMenu(null)
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
  cursorManager: CursorManager,
  setConnected: (v: boolean) => void,
): HostSession | GuestSession | null {
  if (isHost) {
    return new HostSession(scene, spriteManager, buildingManager, cursorManager, (newRoomId) => {
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
      cursorManager,
      () => setConnected(true),
      () => alert('Host disconnected'),
    )
  }
  return null
}
