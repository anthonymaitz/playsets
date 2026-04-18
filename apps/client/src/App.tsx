import { useEffect, useRef } from 'react'
import { createScene } from './babylon/scene'
import { createGrid } from './babylon/grid'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = createScene(canvasRef.current)
    createGrid(ctx.scene)
    return () => ctx.dispose()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    />
  )
}
