import { useEffect, useRef } from 'react'
import { createScene } from './babylon/scene'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = createScene(canvasRef.current)
    return () => ctx.dispose()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    />
  )
}
