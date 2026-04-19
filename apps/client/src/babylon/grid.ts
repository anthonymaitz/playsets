import { Scene, MeshBuilder, StandardMaterial, Color3, DynamicTexture, Texture, Mesh } from '@babylonjs/core'
import type { BackgroundType } from '../types'

export const CELL_SIZE = 1

const GROUND_SIZE = 1000

function drawGridCell(ctx: CanvasRenderingContext2D, size: number, type: BackgroundType): void {
  let lineColor = '#4a5558'

  switch (type) {
    case 'grass':
      ctx.fillStyle = '#2d5a1b'
      ctx.fillRect(0, 0, size, size)
      lineColor = '#4a7a40'
      break
    case 'stars':
      // Near-black space; star overlay is separate
      ctx.fillStyle = '#020008'
      ctx.fillRect(0, 0, size, size)
      lineColor = '#0a0a18'
      break
    case 'ocean':
      ctx.fillStyle = '#0c2e52'
      ctx.fillRect(0, 0, size, size)
      lineColor = '#1a4875'
      break
    case 'snow':
      ctx.fillStyle = '#d0dce8'
      ctx.fillRect(0, 0, size, size)
      lineColor = '#8aa0b8'
      break
    case 'lava': {
      ctx.fillStyle = '#120300'
      ctx.fillRect(0, 0, size, size)
      ctx.strokeStyle = 'rgba(255,100,0,0.45)'
      ctx.lineWidth = 1
      const cracks: [number, number, number, number][] = [
        [20, 30, 90, 80], [150, 10, 200, 60], [60, 140, 100, 190],
        [180, 160, 240, 210], [10, 200, 50, 240], [120, 220, 180, 256], [200, 90, 240, 130],
      ]
      for (const [x1, y1, x2, y2] of cracks) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      }
      lineColor = '#4a1200'
      break
    }
  }

  ctx.strokeStyle = lineColor
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, size - 2, size - 2)
}

export function createGrid(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround('ground', { width: GROUND_SIZE, height: GROUND_SIZE }, scene)

  const texSize = 256
  const tex = new DynamicTexture('grid-tex', { width: texSize, height: texSize }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  drawGridCell(ctx, texSize, 'grass')
  tex.update()
  tex.wrapU = Texture.WRAP_ADDRESSMODE
  tex.wrapV = Texture.WRAP_ADDRESSMODE
  tex.uScale = GROUND_SIZE / CELL_SIZE
  tex.vScale = GROUND_SIZE / CELL_SIZE

  const mat = new StandardMaterial('ground-mat', scene)
  mat.diffuseTexture = tex
  mat.specularColor = Color3.Black()
  ground.material = mat

  return ground
}

export function setGridBackground(ground: Mesh, type: BackgroundType, scene: Scene): () => void {
  const mat = ground.material as StandardMaterial
  const oldTex = mat.diffuseTexture

  const texSize = 256
  const tex = new DynamicTexture(`grid-tex-${type}`, { width: texSize, height: texSize }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  drawGridCell(ctx, texSize, type)
  tex.update()
  tex.wrapU = Texture.WRAP_ADDRESSMODE
  tex.wrapV = Texture.WRAP_ADDRESSMODE
  tex.uScale = GROUND_SIZE / CELL_SIZE
  tex.vScale = GROUND_SIZE / CELL_SIZE
  mat.diffuseTexture = tex
  if (oldTex) oldTex.dispose()

  if (type === 'stars') return _setupStarOverlay(scene)
  if (type === 'ocean') return _setupOceanOverlay(scene)
  return () => {}
}

function _setupStarOverlay(scene: Scene): () => void {
  const SIZE = 512
  const starTex = new DynamicTexture('star-field', { width: SIZE, height: SIZE }, scene, false)
  starTex.hasAlpha = true
  const ctx = starTex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, SIZE, SIZE)

  // Small r values (0.8–2.0px) at uScale=80 → stars appear 2–6px on screen
  const stars = [
    { x: 52,  y: 78,  r: 1.8, b: 1.0  }, { x: 234, y: 128, r: 2.0, b: 0.95 },
    { x: 405, y: 142, r: 1.7, b: 0.9  }, { x: 356, y: 420, r: 1.9, b: 1.0  },
    { x: 502, y: 88,  r: 1.6, b: 0.85 }, { x: 490, y: 490, r: 1.8, b: 0.95 },
    { x: 100, y: 145, r: 1.7, b: 0.9  }, { x: 480, y: 170, r: 1.6, b: 0.8  },
    { x: 148, y: 33,  r: 1.2, b: 0.75 }, { x: 310, y: 67,  r: 1.3, b: 0.8  },
    { x: 177, y: 310, r: 1.1, b: 0.7  }, { x: 468, y: 258, r: 1.4, b: 0.85 },
    { x: 128, y: 455, r: 1.2, b: 0.7  }, { x: 445, y: 395, r: 1.3, b: 0.75 },
    { x: 370, y: 290, r: 1.1, b: 0.65 }, { x: 162, y: 168, r: 1.2, b: 0.7  },
    { x: 430, y: 330, r: 1.0, b: 0.65 }, { x: 320, y: 480, r: 1.3, b: 0.7  },
    { x: 460, y: 55,  r: 1.4, b: 0.85 }, { x: 210, y: 480, r: 1.2, b: 0.8  },
    { x: 340, y: 160, r: 1.0, b: 0.6  }, { x: 380, y: 45,  r: 1.0, b: 0.7  },
    { x: 415, y: 220, r: 1.1, b: 0.75 }, { x: 500, y: 340, r: 1.0, b: 0.7  },
    { x: 440, y: 460, r: 1.2, b: 0.75 }, { x: 55,  y: 440, r: 1.0, b: 0.7  },
    { x: 135, y: 118, r: 1.1, b: 0.72 }, { x: 245, y: 285, r: 1.0, b: 0.68 },
    { x: 195, y: 155, r: 0.9, b: 0.62 }, { x: 38,  y: 500, r: 1.0, b: 0.68 },
    { x: 499, y: 415, r: 0.8, b: 0.58 }, { x: 89,  y: 205, r: 0.8, b: 0.55 },
    { x: 23,  y: 390, r: 0.8, b: 0.5  }, { x: 280, y: 230, r: 0.8, b: 0.5  },
    { x: 64,  y: 510, r: 0.8, b: 0.65 }, { x: 258, y: 350, r: 0.8, b: 0.5  },
    { x: 12,  y: 255, r: 0.8, b: 0.55 }, { x: 200, y: 30,  r: 0.8, b: 0.5  },
    { x: 156, y: 380, r: 0.8, b: 0.6  }, { x: 295, y: 195, r: 0.8, b: 0.55 },
    { x: 76,  y: 330, r: 0.9, b: 0.6  }, { x: 240, y: 60,  r: 0.8, b: 0.5  },
    { x: 35,  y: 165, r: 0.8, b: 0.55 }, { x: 178, y: 240, r: 0.8, b: 0.5  },
    { x: 305, y: 380, r: 0.8, b: 0.55 }, { x: 110, y: 495, r: 0.8, b: 0.6  },
    { x: 470, y: 510, r: 0.8, b: 0.5  }, { x: 350, y: 115, r: 0.8, b: 0.6  },
    { x: 220, y: 425, r: 0.8, b: 0.55 }, { x: 475, y: 125, r: 0.8, b: 0.5  },
    { x: 17,  y: 88,  r: 0.9, b: 0.6  }, { x: 390, y: 205, r: 0.8, b: 0.52 },
    { x: 68,  y: 195, r: 0.8, b: 0.55 }, { x: 326, y: 340, r: 0.8, b: 0.48 },
    { x: 434, y: 75,  r: 0.8, b: 0.52 },
  ]

  for (const { x, y, r, b } of stars) {
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2)
    grd.addColorStop(0,    `rgba(255,255,255,${b})`)
    grd.addColorStop(0.35, `rgba(210,230,255,${(b * 0.5).toFixed(2)})`)
    grd.addColorStop(1,    'rgba(180,210,255,0)')
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(x, y, r * 2, 0, Math.PI * 2)
    ctx.fill()
  }
  starTex.update()

  starTex.wrapU = Texture.WRAP_ADDRESSMODE
  starTex.wrapV = Texture.WRAP_ADDRESSMODE
  starTex.uScale = 80
  starTex.vScale = 80

  const starMat = new StandardMaterial('star-field-mat', scene)
  starMat.emissiveColor = new Color3(1, 1, 1)
  starMat.emissiveTexture = starTex
  starMat.opacityTexture = starTex
  starMat.diffuseColor = Color3.Black()
  starMat.backFaceCulling = false

  const starMesh = MeshBuilder.CreateGround('star-overlay', { width: GROUND_SIZE, height: GROUND_SIZE }, scene)
  starMesh.position.y = 0.03
  starMesh.material = starMat
  starMesh.isPickable = false

  return () => {
    starMesh.dispose()
    starMat.dispose()
    starTex.dispose()
  }
}

function _setupOceanOverlay(scene: Scene): () => void {
  const W = 256, H = 256
  const waveTex = new DynamicTexture('ocean-overlay', { width: W, height: H }, scene, false)
  waveTex.hasAlpha = true
  const ctx = waveTex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, W, H)

  const waves = [
    { crestY: 28,  amp: 5, phase: 0   },
    { crestY: 92,  amp: 6, phase: 0.5 },
    { crestY: 156, amp: 5, phase: 1.0 },
    { crestY: 220, amp: 6, phase: 1.5 },
  ]
  const bandH = 22

  const traceCrest = (crestY: number, amp: number, phase: number, dy = 0) => {
    ctx.beginPath()
    for (let x = 0; x <= W; x++) {
      const wy = crestY
        + Math.sin((x / W) * Math.PI * 2 + phase) * amp
        + Math.sin((x / W) * Math.PI * 4 + phase * 1.7) * (amp * 0.35)
        + dy
      if (x === 0) ctx.moveTo(x, wy)
      else ctx.lineTo(x, wy)
    }
  }

  for (const { crestY, amp, phase } of waves) {
    // Subtle body fill below crest
    traceCrest(crestY, amp, phase)
    ctx.lineTo(W, crestY + bandH)
    ctx.lineTo(0, crestY + bandH)
    ctx.closePath()
    ctx.fillStyle = 'rgba(30,100,190,0.20)'
    ctx.fill()

    // Bright crest stroke — highlight follows exact wave shape
    ctx.shadowColor = 'rgba(195,235,255,0.50)'
    ctx.shadowBlur = 5
    traceCrest(crestY, amp, phase)
    ctx.strokeStyle = 'rgba(225,245,255,0.60)'
    ctx.lineWidth = 1.8
    ctx.stroke()
    ctx.shadowBlur = 0

    // Secondary shimmer just below crest
    traceCrest(crestY, amp, phase, 2.5)
    ctx.strokeStyle = 'rgba(80,170,240,0.32)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  waveTex.update()

  waveTex.wrapU = Texture.WRAP_ADDRESSMODE
  waveTex.wrapV = Texture.WRAP_ADDRESSMODE
  waveTex.uScale = 30
  waveTex.vScale = 30

  const waveMat = new StandardMaterial('ocean-mat', scene)
  waveMat.emissiveColor = new Color3(1, 1, 1)
  waveMat.emissiveTexture = waveTex
  waveMat.opacityTexture = waveTex
  waveMat.diffuseColor = Color3.Black()
  waveMat.backFaceCulling = false

  const waveMesh = MeshBuilder.CreateGround('ocean-overlay', { width: GROUND_SIZE, height: GROUND_SIZE }, scene)
  waveMesh.position.y = 0.04
  waveMesh.material = waveMat
  waveMesh.isPickable = false

  const animateFn = () => {
    waveTex.vOffset -= 0.0008
    waveTex.uOffset -= 0.0003
  }
  scene.registerBeforeRender(animateFn)

  return () => {
    scene.unregisterBeforeRender(animateFn)
    waveMesh.dispose()
    waveMat.dispose()
    waveTex.dispose()
  }
}

export function cellToWorld(col: number, row: number): { x: number; z: number } {
  return {
    x: col * CELL_SIZE + CELL_SIZE / 2,
    z: row * CELL_SIZE + CELL_SIZE / 2,
  }
}

export function worldToCell(worldX: number, worldZ: number): { col: number; row: number } {
  return {
    col: Math.floor(worldX / CELL_SIZE),
    row: Math.floor(worldZ / CELL_SIZE),
  }
}
