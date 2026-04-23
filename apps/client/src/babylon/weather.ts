import {
  Scene, DirectionalLight, ShadowGenerator, Mesh, MeshBuilder,
  StandardMaterial, DynamicTexture, Texture, Color3, Color4, Vector3,
  HemisphericLight, ParticleSystem, ArcRotateCamera,
} from '@babylonjs/core'
import type { WeatherType } from '../types'

export class WeatherSystem {
  private cleanups: Array<() => void> = []
  private shadowGen: ShadowGenerator | null = null

  constructor(
    private scene: Scene,
    private ground: Mesh,
    private ambientLight: HemisphericLight,
    private camera: ArcRotateCamera,
  ) {}

  getShadowGenerator(): ShadowGenerator | null { return this.shadowGen }

  setWeather(type: WeatherType): void {
    for (const fn of this.cleanups) fn()
    this.cleanups = []
    this.shadowGen = null
    this._resetAmbient()

    if (type === 'sunny')  { this._applySunny() }
    if (type === 'cloudy') { this._applySunny(); this._applyClouds() }
    if (type === 'night')  { this._applyNight() }
    if (type === 'rain')   { this._applyRain() }
  }

  private _resetAmbient(): void {
    this.ambientLight.intensity = 1.0
    this.ambientLight.diffuse.set(1, 1, 1)
    this.ambientLight.groundColor.set(0.4, 0.4, 0.5)
    this.scene.clearColor.set(0.22, 0.24, 0.32, 1)
    this.scene.fogMode = Scene.FOGMODE_EXP2
    this.scene.fogDensity = 0.004
    this.scene.fogColor = new Color3(0.70, 0.80, 0.92)
  }

  private _applySunny(): void {
    // Reduce ambient so the sun-vs-shadow-side contrast is visible on billboards
    this.ambientLight.intensity = 0.55
    this.scene.fogColor = new Color3(0.70, 0.80, 0.92)
    this.scene.fogDensity = 0.004

    // Key light: low-angle sun from upper-left-back, casts shadows
    const sun = new DirectionalLight('sun', new Vector3(0.5, -0.8, 0.5), this.scene)
    sun.position.set(-40, 64, -40)
    sun.intensity = 1.3

    const gen = new ShadowGenerator(2048, sun)
    gen.usePoissonSampling = true
    gen.transparencyShadow = true
    gen.bias = 0.005
    this.ground.receiveShadows = true
    this.shadowGen = gen

    // Two fill lights, each perpendicular to the sun's XZ direction (±90°).
    // Math: sun XZ = (0.707, 0.707). Perp vectors: (0.707, -0.707) and (-0.707, 0.707).
    // These fill exactly the side-facing camera angles while giving zero to sun-facing
    // and zero to shadow-facing — creating a visible sun > perpendicular > shadow hierarchy.
    const fill1 = new DirectionalLight('sun-fill-1', new Vector3(0.707, -0.8, -0.707), this.scene)
    fill1.intensity = 0.25
    const fill2 = new DirectionalLight('sun-fill-2', new Vector3(-0.707, -0.8, 0.707), this.scene)
    fill2.intensity = 0.25

    this.cleanups.push(() => {
      gen.dispose()
      sun.dispose()
      fill1.dispose()
      fill2.dispose()
      this.ground.receiveShadows = false
      this.shadowGen = null
    })
  }

  private _applyClouds(): void {
    // Cloudy overrides sunny's fog — denser grey-blue haze
    this.scene.fogColor = new Color3(0.50, 0.56, 0.64)
    this.scene.fogDensity = 0.007
    // Mesh is 240 units to cover max zoom (radius=80 → 160 visible units).
    // uScale=4 → one texture tile = 60 world units.
    // Camera at default zoom sees 24 units = 40% of a tile — several distinct cloud blobs visible.
    // Blobs sized ~22px radius in 512px texture → 22/512 * 60 ≈ 2.6 world units across per cloud.
    const size = 512
    const tex = new DynamicTexture('cloud-tex', { width: size, height: size }, this.scene, false)
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
    ctx.clearRect(0, 0, size, size)
    ctx.filter = 'blur(28px)'
    // Organic cloud clusters: varied sizes, clumped with gaps, no lanes
    // Cluster A — dense upper-left
    const blobs = [
      { x: 68,  y: 55,  rx: 68, ry: 38 },
      { x: 102, y: 44,  rx: 52, ry: 30 },
      { x: 44,  y: 68,  rx: 44, ry: 26 },
      { x: 88,  y: 32,  rx: 36, ry: 20 },
      { x: 120, y: 60,  rx: 40, ry: 24 },
      // Cluster B — sparse right-center, lower y
      { x: 385, y: 88,  rx: 72, ry: 40 },
      { x: 418, y: 76,  rx: 56, ry: 32 },
      { x: 356, y: 100, rx: 44, ry: 26 },
      { x: 438, y: 102, rx: 36, ry: 20 },
      // Cluster C — medium, lower-left, offset from A
      { x: 115, y: 305, rx: 60, ry: 34 },
      { x: 148, y: 292, rx: 48, ry: 28 },
      { x: 88,  y: 318, rx: 52, ry: 30 },
      { x: 168, y: 314, rx: 40, ry: 22 },
      { x: 188, y: 298, rx: 32, ry: 18 },
      // Cluster D — small isolated patch, upper-right area
      { x: 316, y: 52,  rx: 56, ry: 32 },
      { x: 348, y: 42,  rx: 40, ry: 24 },
      { x: 292, y: 62,  rx: 32, ry: 18 },
      // Cluster E — large spread, lower-right
      { x: 448, y: 285, rx: 76, ry: 42 },
      { x: 478, y: 270, rx: 52, ry: 30 },
      { x: 420, y: 298, rx: 44, ry: 26 },
      { x: 460, y: 308, rx: 36, ry: 20 },
      // Small wisp, mid-canvas — breaks up monotony
      { x: 192, y: 178, rx: 48, ry: 28 },
      { x: 216, y: 168, rx: 32, ry: 18 },
      // Edge blobs for seamless tiling continuity
      { x: 502, y: 178, rx: 44, ry: 26 },
      { x: 8,   y: 178, rx: 36, ry: 20 },
      { x: 260, y: 498, rx: 48, ry: 28 },
      { x: 285, y: 8,   rx: 36, ry: 20 },
    ]
    ctx.fillStyle = 'rgba(255,255,255,1)'
    for (const b of blobs) {
      ctx.beginPath()
      ctx.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.filter = 'none'
    tex.update()
    tex.hasAlpha = true
    tex.wrapU = Texture.WRAP_ADDRESSMODE
    tex.wrapV = Texture.WRAP_ADDRESSMODE
    tex.uScale = 4
    tex.vScale = 4

    const mat = new StandardMaterial('cloud-mat', this.scene)
    mat.opacityTexture = tex
    mat.diffuseColor = Color3.Black()
    mat.emissiveColor = Color3.Black()
    mat.specularColor = Color3.Black()
    mat.alpha = 0.42
    mat.backFaceCulling = false

    const mesh = MeshBuilder.CreateGround('cloud-shadows', { width: 240, height: 240 }, this.scene)
    mesh.position.y = 0.06
    mesh.material = mat
    mesh.isPickable = false
    mesh.renderingGroupId = 10

    // Tile size in world units: mesh width (240) / uScale (4) = 60
    const TILE = 240 / 4
    let prevTX = this.camera.target.x
    let prevTZ = this.camera.target.z
    let uAccum = 0
    let vAccum = 0

    const scrollFn = () => {
      const dx = this.camera.target.x - prevTX
      const dz = this.camera.target.z - prevTZ
      prevTX = this.camera.target.x
      prevTZ = this.camera.target.z
      // Pan compensation: shift UV by the same world distance so the pattern
      // stays fixed over world positions. Zero delta during rotation = no effect.
      uAccum += dx / TILE - 0.0003  // + wind drift
      vAccum += dz / TILE
      tex.uOffset = uAccum
      tex.vOffset = vAccum
      mesh.position.x = this.camera.target.x
      mesh.position.z = this.camera.target.z
    }
    this.scene.registerBeforeRender(scrollFn)

    this.cleanups.push(() => {
      this.scene.unregisterBeforeRender(scrollFn)
      mesh.dispose()
      mat.dispose()
      tex.dispose()
    })
  }

  private _applyNight(): void {
    this.ambientLight.intensity = 0.62
    this.ambientLight.diffuse.set(0.52, 0.62, 0.95)
    this.ambientLight.groundColor.set(0.14, 0.16, 0.42)
    this.scene.clearColor.set(0.08, 0.10, 0.28, 1)
    this.scene.fogColor = new Color3(0.08, 0.10, 0.28)
    this.scene.fogDensity = 0.005
  }

  private _applyRain(): void {
    this.ambientLight.intensity = 0.72
    this.ambientLight.diffuse.set(0.72, 0.78, 0.90)
    this.ambientLight.groundColor.set(0.22, 0.22, 0.30)
    this.scene.clearColor.set(0.14, 0.16, 0.24, 1)
    this.scene.fogColor = new Color3(0.22, 0.26, 0.34)
    this.scene.fogDensity = 0.004

    // Rain-drop texture: thin vertical line with fade at ends
    const rainTex = new DynamicTexture('rain-drop', { width: 4, height: 32 }, this.scene, false)
    rainTex.hasAlpha = true
    const rctx = rainTex.getContext() as unknown as CanvasRenderingContext2D
    rctx.clearRect(0, 0, 4, 32)
    const g = rctx.createLinearGradient(0, 0, 0, 32)
    g.addColorStop(0,    'rgba(210,230,255,0)')
    g.addColorStop(0.15, 'rgba(230,242,255,1)')
    g.addColorStop(0.85, 'rgba(230,242,255,1)')
    g.addColorStop(1,    'rgba(210,230,255,0)')
    rctx.fillStyle = g
    rctx.fillRect(0, 0, 4, 32)
    rainTex.update()

    const rain = new ParticleSystem('rain', 3000, this.scene)
    rain.particleTexture = rainTex
    rain.renderingGroupId = 10

    const emitPos = new Vector3(this.camera.target.x, 26, this.camera.target.z)
    rain.emitter = emitPos
    rain.minEmitBox = new Vector3(-26, 0, -26)
    rain.maxEmitBox = new Vector3(26, 0, 26)

    rain.color1 = new Color4(0.88, 0.95, 1, 0.9)
    rain.color2 = new Color4(0.78, 0.88, 1, 0.75)
    rain.colorDead = new Color4(0.7, 0.85, 1, 0)

    rain.minSize = 0.32
    rain.maxSize = 0.46
    rain.minScaleX = 0.12
    rain.maxScaleX = 0.18
    rain.minScaleY = 1.6
    rain.maxScaleY = 2.2

    rain.minLifeTime = 0.65
    rain.maxLifeTime = 1.0
    rain.emitRate = 1800

    rain.direction1 = new Vector3(-0.1, -1, 0.03)
    rain.direction2 = new Vector3(0.1, -1, -0.03)
    rain.minEmitPower = 20
    rain.maxEmitPower = 26
    rain.gravity = Vector3.Zero()
    rain.blendMode = ParticleSystem.BLENDMODE_ADD
    rain.updateSpeed = 0.016
    rain.start()

    // Splash texture: small circle for ground impact bursts
    const splashTex = new DynamicTexture('rain-splash-tex', { width: 8, height: 8 }, this.scene, false)
    splashTex.hasAlpha = true
    const sctx = splashTex.getContext() as unknown as CanvasRenderingContext2D
    sctx.clearRect(0, 0, 8, 8)
    sctx.beginPath()
    sctx.arc(4, 4, 3, 0, Math.PI * 2)
    sctx.fillStyle = 'rgba(180,210,255,0.85)'
    sctx.fill()
    splashTex.update()

    const splash = new ParticleSystem('rain-splash', 600, this.scene)
    splash.particleTexture = splashTex
    splash.renderingGroupId = 1

    const splashEmitPos = new Vector3(emitPos.x, 0.02, emitPos.z)
    splash.emitter = splashEmitPos
    splash.minEmitBox = new Vector3(-26, 0, -26)
    splash.maxEmitBox = new Vector3(26, 0, 26)

    splash.color1 = new Color4(0.7, 0.85, 1, 0.7)
    splash.color2 = new Color4(0.6, 0.8, 1, 0.5)
    splash.colorDead = new Color4(0.6, 0.8, 1, 0)

    splash.minSize = 0.06
    splash.maxSize = 0.12
    splash.minScaleX = 2.5
    splash.maxScaleX = 4.0
    splash.minScaleY = 0.25
    splash.maxScaleY = 0.5

    splash.minLifeTime = 0.15
    splash.maxLifeTime = 0.35
    splash.emitRate = 500

    splash.direction1 = new Vector3(-0.4, 0.8, -0.4)
    splash.direction2 = new Vector3(0.4, 1.5, 0.4)
    splash.minEmitPower = 0.8
    splash.maxEmitPower = 2.0
    splash.gravity = new Vector3(0, -5, 0)
    splash.blendMode = ParticleSystem.BLENDMODE_ADD
    splash.updateSpeed = 0.016
    splash.start()

    // Lightning flicker: random strikes with multi-step intensity pattern
    let frame = 0
    let nextStrikeFrame = 180 + Math.floor(Math.random() * 480)
    let flickerStep = -1
    let flickerSubFrame = 0
    const FLICKER = [2.5, 0.6, 2.8, 0.6, 2.2, 0.6, 0.72]
    const FLICKER_HOLD = 3
    const baseIntensity = this.ambientLight.intensity

    const lightningFn = () => {
      frame++
      if (flickerStep >= 0) {
        flickerSubFrame++
        if (flickerSubFrame >= FLICKER_HOLD) {
          flickerSubFrame = 0
          flickerStep++
          if (flickerStep >= FLICKER.length) {
            flickerStep = -1
            this.ambientLight.intensity = baseIntensity
            nextStrikeFrame = frame + 180 + Math.floor(Math.random() * 480)
          } else {
            this.ambientLight.intensity = FLICKER[flickerStep]!
          }
        }
      } else if (frame >= nextStrikeFrame) {
        flickerStep = 0
        flickerSubFrame = 0
        this.ambientLight.intensity = FLICKER[0]!
      }
    }
    this.scene.registerBeforeRender(lightningFn)

    const followFn = () => {
      emitPos.x = this.camera.target.x
      emitPos.z = this.camera.target.z
      splashEmitPos.x = this.camera.target.x
      splashEmitPos.z = this.camera.target.z
      // Keep emit box covering the full orthographic viewport at any zoom level.
      // ortho half-width = radius/2; isometric 45° diagonal adds √2 factor → use radius*0.75
      const half = this.camera.radius * 0.75
      rain.minEmitBox.x = -half;  rain.maxEmitBox.x = half
      rain.minEmitBox.z = -half;  rain.maxEmitBox.z = half
      splash.minEmitBox.x = -half; splash.maxEmitBox.x = half
      splash.minEmitBox.z = -half; splash.maxEmitBox.z = half
      // Scale emitRate with area so density stays consistent across zoom levels
      const scale = half / 18  // 18 is the base half at default radius=24
      rain.emitRate = Math.min(5000, Math.round(1800 * scale * scale))
      splash.emitRate = Math.min(1200, Math.round(500 * scale * scale))
    }
    this.scene.registerBeforeRender(followFn)

    this.cleanups.push(() => {
      this.scene.unregisterBeforeRender(followFn)
      this.scene.unregisterBeforeRender(lightningFn)
      this.ambientLight.intensity = baseIntensity
      rain.stop()
      rain.dispose()
      splash.stop()
      splash.dispose()
      rainTex.dispose()
      splashTex.dispose()
    })
  }

  dispose(): void {
    for (const fn of this.cleanups) fn()
    this.cleanups = []
  }
}
