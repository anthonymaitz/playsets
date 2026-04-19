import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { PointerEventTypes } from '@babylonjs/core'
import type { Scene, ArcRotateCamera } from '@babylonjs/core'
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

  const [needsName, setNeedsName] = useState(true)
  const [selectedSprite, setSelectedSprite] = useState<SpriteManifestEntry | null>(null)
  const [tokenMenu, setTokenMenu] = useState<TokenMenuState | null>(null)
  const [directionPicker, setDirectionPicker] = useState<{ instanceId: string; x: number; y: number } | null>(null)
  const [connected, setConnected] = useState(isHost)
  const [canvasRect, setCanvasRect] = useState({ left: 200, top: 48 })
  const [currentWeather, setCurrentWeather] = useState<WeatherType>('sunny')
  const [currentBackground, setCurrentBackground] = useState<BackgroundType>('grass')
  const [cameraAlpha, setCameraAlpha] = useState(-Math.PI / 4)

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

  useEffect(() => {
    if (needsName || !canvasRef.current) return

    bgCleanupRef.current = () => {}
    const { engine, scene, camera, ambientLight } = createScene(canvasRef.current)
    sceneRef.current = scene
    const ground = createGrid(scene)
    groundRef.current = ground
    const spriteManager = new SpriteManager(scene, camera)
    spriteManagerRef.current = spriteManager
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

    const dragController = setupDragController(scene, spriteManager, camera, sessionRef, canvasRef, showDirPickerAtPointer, setTokenMenu)
    dragControllerRef.current = dragController

    setupScenePointerObservable(scene, spriteManager, dragController, selectedSpriteRef, sessionRef, setTokenMenu, setDirectionPicker)

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

    sessionRef.current = createSession(isHost, roomId, scene, spriteManager, cursorManager, setConnected)

    return () => {
      canvas.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointerup', handleDocPointerUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updateCanvasRect)
      camera.onViewMatrixChangedObservable.remove(cameraObserver)
      bgCleanupRef.current()
      bgCleanupRef.current = () => {}
      weatherSystemRef.current?.dispose()
      weatherSystemRef.current = null
      spriteManagerRef.current = null
      dragControllerRef.current = null
      groundRef.current = null
      sessionRef.current?.dispose()
      engine.dispose()
    }
  }, [needsName, roomId, isHost])

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
): DragController {
  return new DragController(scene, spriteManager, camera, {
    onDragMove: (instanceId, col, row) => {
      sendMsg(sessionRef.current, { type: 'sprite:drag', instanceId, col, row })
    },
    onDragDrop: (instanceId, col, row) => {
      useRoomStore.getState().moveSprite(instanceId, col, row)
      sendMsg(sessionRef.current, { type: 'sprite:move', instanceId, col, row })
      if (spriteManager.getMesh(instanceId)?.metadata?.hasDirections) showDirPickerAtPointer(instanceId)
    },
    onSpriteClick: (instanceId) => {
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
): void {
  scene.onPointerObservable.add((info) => {
    if (info.type === PointerEventTypes.POINTERDOWN) {
      setDirectionPicker(null)
      setTokenMenu(null)
    }

    if (info.type !== PointerEventTypes.POINTERMOVE) return

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
  cursorManager: CursorManager,
  setConnected: (v: boolean) => void,
): HostSession | GuestSession | null {
  if (isHost) {
    return new HostSession(scene, spriteManager, cursorManager, (newRoomId) => {
      window.history.replaceState(null, '', `/room/${newRoomId}`)
      useRoomStore.getState().setRoomId(newRoomId)
    })
  }
  if (roomId && roomId !== 'new') {
    return new GuestSession(
      roomId,
      scene,
      spriteManager,
      cursorManager,
      () => setConnected(true),
      () => alert('Host disconnected'),
    )
  }
  return null
}
