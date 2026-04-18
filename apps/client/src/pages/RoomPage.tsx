import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { PointerEventTypes } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'
import { createScene } from '../babylon/scene'
import { createGrid, worldToCell, GRID_COLS, GRID_ROWS } from '../babylon/grid'
import { SpriteManager } from '../babylon/sprites'
import { DragController } from '../babylon/drag'
import { CursorManager } from '../babylon/cursors'
import { showEmote } from '../babylon/emotes'
import { HostSession } from '../networking/host'
import { GuestSession } from '../networking/guest'
import { TopBar } from '../components/TopBar'
import { SpritePicker } from '../components/SpritePicker'
import { EmoteMenu } from '../components/EmoteMenu'
import { DirectionPicker } from '../components/DirectionPicker'
import { JoinDialog } from '../components/JoinDialog'
import { usePlayersStore } from '../store/players'
import { useRoomStore } from '../store/room'
import type { SpriteManifestEntry, FacingDir } from '../types'
import { nanoid } from 'nanoid'

const GRASS_PATH = '/assets/sprites/terrain/grass.svg'

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams] = useSearchParams()
  const isHost = searchParams.get('host') === '1'

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const sessionRef = useRef<HostSession | GuestSession | null>(null)
  const selectedSpriteRef = useRef<SpriteManifestEntry | null>(null)
  const spriteManagerRef = useRef<SpriteManager | null>(null)
  const dragControllerRef = useRef<DragController | null>(null)

  const [needsName, setNeedsName] = useState(true)
  const [selectedSprite, setSelectedSprite] = useState<SpriteManifestEntry | null>(null)
  const [emoteMenu, setEmoteMenu] = useState<{ instanceId: string; x: number; y: number } | null>(null)
  const [directionPicker, setDirectionPicker] = useState<{ instanceId: string; x: number; y: number } | null>(null)
  const [connected, setConnected] = useState(isHost)

  const handleSelectSprite = (s: SpriteManifestEntry) => {
    setSelectedSprite(s)
    selectedSpriteRef.current = s
  }

  const handleDeselectSprite = () => {
    setSelectedSprite(null)
    selectedSpriteRef.current = null
    spriteManagerRef.current?.hidePlacementGhost()
  }

  // Set roomId in store for guests (host sets it after createRoom resolves)
  useEffect(() => {
    if (!isHost && roomId && roomId !== 'new') {
      useRoomStore.getState().setRoomId(roomId)
    }
  }, [isHost, roomId])

  useEffect(() => {
    if (needsName || !canvasRef.current) return

    const { engine, scene, camera } = createScene(canvasRef.current)
    sceneRef.current = scene
    createGrid(scene)
    const spriteManager = new SpriteManager(scene)
    spriteManagerRef.current = spriteManager
    const cursorManager = new CursorManager(scene)

    // Pre-fill every grid cell with a grass tile for the host's initial state
    if (isHost) {
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const instanceId = `grass-${col}-${row}`
          const instance = { instanceId, spriteId: 'terrain/grass', col, row, placedBy: 'system' }
          useRoomStore.getState().placeSprite(instance)
          spriteManager.place(instance, GRASS_PATH)
        }
      }
    }

    const showDirPickerAtPointer = (instanceId: string) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      setDirectionPicker({ instanceId, x: (rect?.left ?? 0) + scene.pointerX, y: (rect?.top ?? 0) + scene.pointerY })
    }

    const dragController = new DragController(scene, spriteManager, camera, {
      onDragMove: (instanceId, col, row) => {
        const msg = { type: 'sprite:drag' as const, instanceId, col, row }
        if (sessionRef.current instanceof HostSession) sessionRef.current.localAction(msg)
        else (sessionRef.current as GuestSession | null)?.send(msg)
      },
      onDragDrop: (instanceId, col, row) => {
        const msg = { type: 'sprite:move' as const, instanceId, col, row }
        useRoomStore.getState().moveSprite(instanceId, col, row)
        if (sessionRef.current instanceof HostSession) sessionRef.current.localAction(msg)
        else (sessionRef.current as GuestSession | null)?.send(msg)
        if (spriteManager.getMesh(instanceId)?.metadata?.hasDirections) showDirPickerAtPointer(instanceId)
      },
      onSpriteClick: (instanceId) => {
        if (spriteManager.getMesh(instanceId)?.metadata?.hasDirections) {
          showDirPickerAtPointer(instanceId)
        } else {
          const rect = canvasRef.current?.getBoundingClientRect()
          setEmoteMenu({ instanceId, x: (rect?.left ?? 0) + scene.pointerX, y: (rect?.top ?? 0) + scene.pointerY })
        }
      },
    })
    dragControllerRef.current = dragController

    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERMOVE) return

      const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.name === 'ground')

      // Ghost preview while dragging from sidebar
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

      // Broadcast cursor position to other players
      if (pick?.hit && pick.pickedPoint) {
        const { playerId } = usePlayersStore.getState().localPlayer
        const msg = { type: 'cursor:move' as const, playerId, worldX: pick.pickedPoint.x, worldZ: pick.pickedPoint.z }
        if (sessionRef.current instanceof HostSession) sessionRef.current.localAction(msg)
        else (sessionRef.current as GuestSession | null)?.send(msg)
      }
    })

    const handlePointerUp = (e: PointerEvent) => {
      if (dragController.consumeJustDropped()) return

      // Sprite clicks are handled entirely by DragController.onSpriteClick.
      // This handler is only responsible for sidebar drag-and-drop placement.
      const sprite = selectedSpriteRef.current
      if (!sprite) return

      // Use a ground-only predicate so grass/prop sprites never block placement.
      const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.name === 'ground')
      if (!pick?.hit || !pick.pickedPoint) return

      const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
      const newInstanceId = nanoid()
      const { localPlayer: lp } = usePlayersStore.getState()
      const instance = { instanceId: newInstanceId, spriteId: sprite.id, col, row, placedBy: lp.playerId }
      const msg = { type: 'sprite:place' as const, ...instance }
      useRoomStore.getState().placeSprite(instance)
      spriteManager.place(instance, sprite.path)
      if (sessionRef.current instanceof HostSession) sessionRef.current.localAction(msg)
      else (sessionRef.current as GuestSession | null)?.send(msg)
      setSelectedSprite(null)
      selectedSpriteRef.current = null
      spriteManager.hidePlacementGhost()
      if (sprite.hasDirections) {
        setDirectionPicker({ instanceId: newInstanceId, x: e.clientX, y: e.clientY })
      }
    }

    // Cancel sidebar drag if pointer released outside the canvas
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

    if (isHost) {
      sessionRef.current = new HostSession(scene, spriteManager, cursorManager, (newRoomId) => {
        window.history.replaceState(null, '', `/room/${newRoomId}`)
        useRoomStore.getState().setRoomId(newRoomId)
      })
    } else if (roomId && roomId !== 'new') {
      sessionRef.current = new GuestSession(
        roomId,
        scene,
        spriteManager,
        cursorManager,
        () => setConnected(true),
        () => alert('Host disconnected'),
      )
    }

    return () => {
      canvas.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointerup', handleDocPointerUp)
      window.removeEventListener('keydown', handleKeyDown)
      spriteManagerRef.current = null
      dragControllerRef.current = null
      sessionRef.current?.dispose()
      engine.dispose()
    }
  }, [needsName, roomId, isHost])

  if (needsName) return <JoinDialog onDone={() => setNeedsName(false)} />

  return (
    <>
      <TopBar />
      <SpritePicker
        selectedSpriteId={selectedSprite?.id ?? null}
        onSelect={handleSelectSprite}
        onDeselect={handleDeselectSprite}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', top: 48, left: 200, right: 0, bottom: 0, width: 'calc(100vw - 200px)', height: 'calc(100vh - 48px)' }}
      />
      {emoteMenu && (
        <EmoteMenu
          instanceId={emoteMenu.instanceId}
          position={{ x: emoteMenu.x, y: emoteMenu.y }}
          onEmote={(instanceId, emote) => {
            const { sprites } = useRoomStore.getState()
            const instance = sprites[instanceId]
            if (instance && sceneRef.current) showEmote(sceneRef.current, instance.col, instance.row, emote)
            const msg = { type: 'sprite:emote' as const, instanceId, emote }
            if (sessionRef.current instanceof HostSession) sessionRef.current.localAction(msg)
            else (sessionRef.current as GuestSession | null)?.send(msg)
          }}
          onClose={() => setEmoteMenu(null)}
        />
      )}
      {directionPicker && (
        <DirectionPicker
          screenX={directionPicker.x}
          screenY={directionPicker.y}
          onPick={(facing: FacingDir) => {
            const { instanceId } = directionPicker
            useRoomStore.getState().faceSprite(instanceId, facing)
            spriteManagerRef.current?.setFacing(instanceId, facing)
            const msg = { type: 'sprite:face' as const, instanceId, facing }
            if (sessionRef.current instanceof HostSession) sessionRef.current.localAction(msg)
            else (sessionRef.current as GuestSession | null)?.send(msg)
            setDirectionPicker(null)
          }}
          onDismiss={() => setDirectionPicker(null)}
        />
      )}
      {!connected && !isHost && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
          <p style={{ color: '#fff', fontSize: 20 }}>Connecting to host...</p>
        </div>
      )}
    </>
  )
}
