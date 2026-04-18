import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color4,
  Color3,
} from '@babylonjs/core'

export interface SceneContext {
  engine: Engine
  scene: Scene
  camera: ArcRotateCamera
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.12, 0.12, 0.16, 1)

  // Isometric-style camera: locked elevation, free horizontal rotation
  const camera = new ArcRotateCamera('camera', -Math.PI / 4, Math.PI / 3.5, 24, Vector3.Zero(), scene)
  camera.lowerBetaLimit = Math.PI / 3.5   // lock tilt at isometric angle
  camera.upperBetaLimit = Math.PI / 3.5
  camera.lowerRadiusLimit = 8
  camera.upperRadiusLimit = 40
  camera.attachControl(canvas, true)
  camera.panningSensibility = 0  // disable right-click pan; rotation only

  const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
  light.intensity = 0.9
  light.diffuse = new Color3(1, 1, 1)
  light.groundColor = new Color3(0.3, 0.3, 0.4)

  engine.runRenderLoop(() => scene.render())
  window.addEventListener('resize', () => engine.resize())

  return { engine, scene, camera }
}
