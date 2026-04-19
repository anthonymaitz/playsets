import { useEffect, useRef, useState } from 'react'
import { Vector3, Matrix } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'
import { useRoomStore } from '../store/room'
import { cellToWorld } from '../babylon/grid'
import { CELL_SIZE } from '../babylon/grid'

interface Props {
  scene: Scene | null
  canvasLeft: number
  canvasTop: number
}

interface TokenOverlay {
  instanceId: string
  screenX: number
  screenY: number
  statuses: string[]
  speech: string
}

const SPRITE_HEIGHT = CELL_SIZE * 1.6

export function TokenHUD({ scene, canvasLeft, canvasTop }: Props) {
  const [overlays, setOverlays] = useState<TokenOverlay[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!scene) return

    const update = () => {
      const { sprites } = useRoomStore.getState()
      const camera = scene.activeCamera
      if (!camera) { rafRef.current = requestAnimationFrame(update); return }

      const viewport = camera.viewport.toGlobal(scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight())
      const transform = scene.getTransformMatrix()

      const next: TokenOverlay[] = []
      for (const s of Object.values(sprites)) {
        if (s.hidden) continue
        const hasOverlay = (s.statuses && s.statuses.length > 0) || (s.speech && s.speech.length > 0)
        if (!hasOverlay) continue

        const { x, z } = cellToWorld(s.col, s.row)
        const world = new Vector3(x, SPRITE_HEIGHT + 0.3, z)
        const projected = Vector3.Project(world, Matrix.Identity(), transform, viewport)

        next.push({
          instanceId: s.instanceId,
          screenX: canvasLeft + projected.x,
          screenY: canvasTop + projected.y,
          statuses: s.statuses ?? [],
          speech: s.speech ?? '',
        })
      }
      setOverlays(next)
      rafRef.current = requestAnimationFrame(update)
    }

    rafRef.current = requestAnimationFrame(update)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [scene, canvasLeft, canvasTop])

  return (
    <>
      {overlays.map((o) => (
        <div key={o.instanceId} style={{ position: 'fixed', left: o.screenX, top: o.screenY, transform: 'translateX(-50%)', zIndex: 50, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          {o.speech && (
            <div style={{
              background: 'rgba(255,255,255,0.92)', color: '#111', fontSize: 11, fontWeight: 500,
              padding: '3px 8px', borderRadius: 10, maxWidth: 140, textAlign: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              border: '1px solid rgba(0,0,0,0.15)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {o.speech}
            </div>
          )}
          {o.statuses.length > 0 && (
            <div style={{ display: 'flex', gap: 2 }}>
              {o.statuses.map((s) => (
                <span key={s} style={{ fontSize: 14 }}>{s}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  )
}
