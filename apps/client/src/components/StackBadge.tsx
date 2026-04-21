import { useEffect, useRef, useState } from 'react'
import { Vector3, Matrix } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'
import { useRoomStore } from '../store/room'
import { cellToWorld, CELL_SIZE } from '../babylon/grid'

const SPRITE_HEIGHT = CELL_SIZE * 1.6

interface Props {
  instanceId: string
  scene: Scene
  canvasLeft: number
  canvasTop: number
  onAdvance: () => void
}

export function StackBadge({ instanceId, scene, canvasLeft, canvasTop, onAdvance }: Props) {
  const [overlay, setOverlay] = useState<{ screenX: number; screenY: number; pos: number; total: number } | null>(null)
  const rafRef = useRef<number>(0)
  const onAdvanceRef = useRef(onAdvance)

  useEffect(() => {
    const update = () => {
      const { sprites } = useRoomStore.getState()
      const sprite = sprites[instanceId]
      if (!sprite) {
        setOverlay(null)
        rafRef.current = requestAnimationFrame(update)
        return
      }

      const stack = Object.values(sprites)
        .filter((s) => s.col === sprite.col && s.row === sprite.row)
        .sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0))
      const total = stack.length

      if (total <= 1) {
        setOverlay(null)
        rafRef.current = requestAnimationFrame(update)
        return
      }

      const pos = stack.findIndex((s) => s.instanceId === instanceId) + 1
      const { x, z } = cellToWorld(sprite.col, sprite.row)
      const camera = scene.activeCamera
      if (!camera) { rafRef.current = requestAnimationFrame(update); return }

      const viewport = camera.viewport.toGlobal(scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight())
      const transform = scene.getTransformMatrix()
      const projected = Vector3.Project(new Vector3(x, SPRITE_HEIGHT / 2, z), Matrix.Identity(), transform, viewport)

      setOverlay({
        screenX: canvasLeft + projected.x,
        screenY: canvasTop + projected.y + 60, // offset below sprite center
        pos,
        total,
      })
      rafRef.current = requestAnimationFrame(update)
    }

    rafRef.current = requestAnimationFrame(update)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [instanceId, scene, canvasLeft, canvasTop])

  useEffect(() => {
    onAdvanceRef.current = onAdvance
  }, [onAdvance])

  if (!overlay) return null

  return (
    <button
      onPointerDown={(e) => { e.stopPropagation(); onAdvanceRef.current() }}
      style={{
        position: 'fixed',
        left: overlay.screenX - 26,
        top: overlay.screenY - 18,
        width: 52,
        height: 36,
        zIndex: 70,
        background: 'rgba(15,15,20,0.88)',
        border: '1px solid rgba(255,210,50,0.7)',
        borderRadius: 6,
        color: '#ffe033',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        letterSpacing: '0.03em',
        boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
      }}
    >
      {overlay.pos} / {overlay.total}
    </button>
  )
}
