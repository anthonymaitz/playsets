import {
  Engine,
  Scene,
  ArcRotateCamera,
  Camera,
  HemisphericLight,
  Vector3,
  Color4,
  Color3,
  Animation,
  QuarticEase,
  EasingFunction,
  RenderingManager,
} from '@babylonjs/core'

// Groups 1-9 = layers 1-9 (each clears depth so higher layers always draw on top)
// Group 10 = roofs + weather + previews (always on top)
// Group 11 = builder anchor (renders after previews, always topmost)
RenderingManager.MAX_RENDERINGGROUPS = 12

export interface SceneContext {
  engine: Engine
  scene: Scene
  camera: ArcRotateCamera
  ambientLight: HemisphericLight
  dispose: () => void
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.22, 0.24, 0.32, 1)

  // Each layer group clears the depth buffer before rendering so higher layers
  // always composite on top of lower ones, regardless of actual Y position.
  for (let i = 1; i <= 11; i++) {
    scene.setRenderingAutoClearDepthStencil(i, true, true, false)
  }

  const camera = new ArcRotateCamera('camera', -Math.PI / 4, Math.PI / 3.5, 24, Vector3.Zero(), scene)
  camera.lowerBetaLimit = Math.PI / 3.5
  camera.upperBetaLimit = Math.PI / 3.5
  camera.lowerRadiusLimit = 8
  camera.upperRadiusLimit = 80
  // attachControl(noPreventDefault, useCtrlForPanning, panningMouseButton)
  // panningMouseButton=0 → left click pans, right click rotates
  camera.attachControl(true, false, 0)
  camera.inertia = 0
  camera.panningInertia = 0
  camera.angularSensibilityX = 400

  // Orthographic projection with ortho bounds tied to camera.radius so scroll-zoom works.
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA
  const syncOrtho = () => {
    const w = engine.getRenderWidth()
    const aspect = engine.getRenderHeight() / w
    const half = camera.radius * 0.5
    camera.orthoLeft = -half
    camera.orthoRight = half
    camera.orthoTop = half * aspect
    camera.orthoBottom = -half * aspect
    // 1 screen-pixel drag = 1 screen-pixel of world movement at any zoom level
    camera.panningSensibility = w / camera.radius
  }
  scene.registerBeforeRender(syncOrtho)

  const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
  light.intensity = 0.9
  light.diffuse = new Color3(1, 1, 1)
  light.groundColor = new Color3(0.3, 0.3, 0.4)

  engine.runRenderLoop(() => scene.render())

  // Snap alpha to nearest isometric corner-forward orientation after rotating.
  const SNAP = Math.PI / 2
  const OFFSET = Math.PI / 4
  const ease = new QuarticEase()
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)

  const snapToIsometric = () => {
    const current = camera.alpha
    const target = Math.round((current - OFFSET) / SNAP) * SNAP + OFFSET
    if (Math.abs(current - target) < 0.001) return
    scene.stopAnimation(camera)
    Animation.CreateAndStartAnimation(
      'cam-snap', camera, 'alpha',
      60, 36,
      current, target,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      ease,
    )
  }

  const cancelSnap = () => scene.stopAnimation(camera)

  // Snap whenever alpha actually changed (rotation), regardless of which button.
  // Panning moves the target point, not alpha, so this safely ignores pan gestures.
  let alphaOnDown = camera.alpha
  const onPointerUp = () => { if (Math.abs(camera.alpha - alphaOnDown) > 0.02) snapToIsometric() }
  const onPointerDown = () => { alphaOnDown = camera.alpha; cancelSnap() }

  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointerdown', onPointerDown)

  // Two-finger touch: horizontal swipe rotates, pinch zooms.
  // We intercept and prevent BabylonJS pointer events for 2-finger gestures.
  let prevMidX = 0
  let prevPinchDist = 0
  let twoFingerActive = false

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      twoFingerActive = true
      cancelSnap()
      prevMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      prevPinchDist = Math.sqrt(dx * dx + dy * dy)
    } else {
      twoFingerActive = false
    }
  }

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 2 || !twoFingerActive) return
    e.preventDefault()
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Horizontal midpoint movement → rotate (change alpha)
    camera.alpha -= (midX - prevMidX) * 0.01

    // Pinch spread/contract → zoom
    if (prevPinchDist > 0) {
      camera.radius = Math.max(
        camera.lowerRadiusLimit!,
        Math.min(camera.upperRadiusLimit!, camera.radius * (prevPinchDist / dist)),
      )
    }

    prevMidX = midX
    prevPinchDist = dist
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2 && twoFingerActive) {
      twoFingerActive = false
      snapToIsometric()
    }
  }

  canvas.addEventListener('touchstart', onTouchStart, { passive: false })
  canvas.addEventListener('touchmove', onTouchMove, { passive: false })
  canvas.addEventListener('touchend', onTouchEnd)

  const onResize = () => engine.resize()
  window.addEventListener('resize', onResize)

  return {
    engine,
    scene,
    camera,
    ambientLight: light,
    dispose: () => {
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('resize', onResize)
      scene.unregisterBeforeRender(syncOrtho)
      engine.dispose()
    },
  }
}
