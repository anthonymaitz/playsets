import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color4,
  Color3,
  Animation,
  QuarticEase,
  EasingFunction,
} from '@babylonjs/core'

export interface SceneContext {
  engine: Engine
  scene: Scene
  camera: ArcRotateCamera
  dispose: () => void
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.12, 0.12, 0.16, 1)

  const camera = new ArcRotateCamera('camera', -Math.PI / 4, Math.PI / 3.5, 24, Vector3.Zero(), scene)
  camera.lowerBetaLimit = Math.PI / 3.5
  camera.upperBetaLimit = Math.PI / 3.5
  camera.lowerRadiusLimit = 8
  camera.upperRadiusLimit = 40
  camera.attachControl(canvas, true)
  camera.panningSensibility = 0
  camera.inertia = 0  // disable built-in inertia; snap animation provides the deceleration

  const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
  light.intensity = 0.9
  light.diffuse = new Color3(1, 1, 1)
  light.groundColor = new Color3(0.3, 0.3, 0.4)

  engine.runRenderLoop(() => scene.render())

  // Snap camera alpha to the nearest isometric orientation (multiples of π/2)
  // when the user releases after rotating.
  const SNAP = Math.PI / 2
  const ease = new QuarticEase()
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)

  const snapToIsometric = () => {
    const current = camera.alpha
    const OFFSET = Math.PI / 4  // corners face viewer, not flat edges
    const target = Math.round((current - OFFSET) / SNAP) * SNAP + OFFSET
    if (Math.abs(current - target) < 0.001) return
    scene.stopAnimation(camera)
    Animation.CreateAndStartAnimation(
      'cam-snap', camera, 'alpha',
      60, 36,  // 36 frames at 60 fps = 600 ms
      current, target,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      ease,
    )
  }

  const cancelSnap = () => scene.stopAnimation(camera)

  canvas.addEventListener('pointerup', snapToIsometric)
  canvas.addEventListener('pointerdown', cancelSnap)

  const onResize = () => engine.resize()
  window.addEventListener('resize', onResize)

  return {
    engine,
    scene,
    camera,
    dispose: () => {
      canvas.removeEventListener('pointerup', snapToIsometric)
      canvas.removeEventListener('pointerdown', cancelSnap)
      window.removeEventListener('resize', onResize)
      engine.dispose()
    },
  }
}
