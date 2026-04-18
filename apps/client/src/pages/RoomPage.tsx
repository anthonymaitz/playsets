import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Scene } from '@babylonjs/core'
import { createScene } from '../babylon/scene'
import { createGrid, worldToCell } from '../babylon/grid'
import { SpriteManager } from '../babylon/sprites'
import { DragController } from '../babylon/drag'
import { CursorManager } from '../babylon/cursors'
import { showEmote } from '../babylon/emotes'
import { HostSession } from '../networking/host'
import { GuestSession } from '../networking/guest'
import { TopBar } from '../components/TopBar'
import { SpritePicker } from '../components/SpritePicker'
import { EmoteMenu } from '../components/EmoteMenu'
import { JoinDialog } from '../components/JoinDialog'
import { usePlayersStore } from '../store/players'
import { useRoomStore } from '../store/room'
import type { SpriteManifestEntry } from '../types'
import { nanoid } from 'nanoid'

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams] = useSearchParams()
  const isHost = searchParams.get('host') === '1'

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const sessionRef = useRef<HostSession | GuestSession | null>(null)
  const selectedSpriteRef = useRef<SpriteManifestEntry | null>(null)

  const [needsName, setNeedsName] = useState(true)
  const [selectedSprite, setSelectedSprite] = useState<SpriteManifestEntry | null>(null)
  const [emoteMenu, setEmoteMenu] = useState<{ instanceId: string; x: number; y: number } | null>(null)
  const [connected, setConnected] = useState(isHost)

  const handleSelectSprite = (s: SpriteManifestEntry) => {
    setSelectedSprite(s)
    selectedSpriteRef.current = s
  }

  useEffect(() => {
    if (needsName || !canvasRef.current) return

    const { engine, scene } = createScene(canvasRef.current)
    sceneRef.current = scene
    createGrid(scene)
    const spriteManager = new SpriteManager(scene)
    const cursorManager = new CursorManager(scene)

    new DragController(scene, spriteManager, {
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
      },
      onSpriteClick: () => {},
    })

    const handlePointerUp = (e: PointerEvent) => {
      const pick = scene.pick(scene.pointerX, scene.pointerY)
      const instanceId = pick?.pickedMesh?.metadata?.instanceId as string | undefined
      if (instanceId) {
        setEmoteMenu({ instanceId, x: e.clientX, y: e.clientY })
        return
      }
      const sprite = selectedSpriteRef.current
      if (sprite && pick?.hit && pick.pickedMesh?.name === 'ground' && pick.pickedPoint) {
        const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
        const newInstanceId = nanoid()
        const { localPlayer: lp } = usePlayersStore.getState()
        const instance = { instanceId: newInstanceId, spriteId: sprite.id, col, row, placedBy: lp.playerId }
        const msg = { type: 'sprite:place' as const, ...instance }
        useRoomStore.getState().placeSprite(instance)
        spriteManager.place(instance, sprite.path)
        if (sessionRef.current instanceof HostSession) sessionRef.current.localAction(msg)
        else (sessionRef.current as GuestSession | null)?.send(msg)
      }
    }

    const canvas = canvasRef.current
    canvas.addEventListener('pointerup', handlePointerUp)

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
      sessionRef.current?.dispose()
      engine.dispose()
    }
  }, [needsName, roomId, isHost])

  if (needsName) return <JoinDialog onDone={() => setNeedsName(false)} />

  return (
    <>
      <TopBar />
      <SpritePicker selectedSpriteId={selectedSprite?.id ?? null} onSelect={handleSelectSprite} />
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
      {!connected && !isHost && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
          <p style={{ color: '#fff', fontSize: 20 }}>Connecting to host...</p>
        </div>
      )}
    </>
  )
}
