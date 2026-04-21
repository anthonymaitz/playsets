import { useEffect, useRef, useState } from 'react'
import { Vector3, Matrix } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'
import { useRoomStore } from '../store/room'
import { cellToWorld } from '../babylon/grid'

interface Props {
  instanceId: string
  scene: Scene
  canvasLeft: number
  canvasTop: number
  onAdvance: () => void
}

export function PropStackBadge({ instanceId, scene, canvasLeft, canvasTop, onAdvance }: Props) {
  const [overlay, setOverlay] = useState<{ screenX: number; screenY: number; pos: number; total: number } | null>(null)
  const rafRef = useRef<number>(0)
  const onAdvanceRef = useRef(onAdvance)

  useEffect(() => {
    const update = () => {
      const { builderProps } = useRoomStore.getState()
      const prop = builderProps[instanceId]
      if (!prop) {
        setOverlay(null)
        rafRef.current = requestAnimationFrame(update)
        return
      }

      const stack = Object.values(builderProps)
        .filter((p) => p.col === prop.col && p.row === prop.row)
        .sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0))
      const total = stack.length

      if (total <= 1) {
        setOverlay(null)
        rafRef.current = requestAnimationFrame(update)
        return
      }

      const pos = stack.findIndex((p) => p.instanceId === instanceId) + 1
      const { x, z } = cellToWorld(prop.col, prop.row)
      const camera = scene.activeCamera
      if (!camera) { rafRef.current = requestAnimationFrame(update); return }

      const viewport = camera.viewport.toGlobal(scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight())
      const transform = scene.getTransformMatrix()
      const projected = Vector3.Project(new Vector3(x, 0.5, z), Matrix.Identity(), transform, viewport)

      setOverlay({
        screenX: canvasLeft + projected.x,
        screenY: canvasTop + projected.y + 40,
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
        border: '1px solid rgba(130,210,255,0.7)',
        borderRadius: 6,
        color: '#7cdaff',
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
