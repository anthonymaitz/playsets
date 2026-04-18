import { Scene, MeshBuilder, DynamicTexture, StandardMaterial, Vector3, Mesh } from '@babylonjs/core'
import { cellToWorld, CELL_SIZE } from './grid'

const EMOTE_DURATION_MS = 3000

export function showEmote(scene: Scene, col: number, row: number, emote: string): void {
  const { x, z } = cellToWorld(col, row)

  const texture = new DynamicTexture('emote-tex', { width: 128, height: 128 }, scene, false)
  texture.hasAlpha = true
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 128, 128)
  ctx.font = '80px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emote, 64, 64)
  texture.update()

  const plane = MeshBuilder.CreatePlane('emote', { width: CELL_SIZE, height: CELL_SIZE }, scene)
  plane.position = new Vector3(x, CELL_SIZE * 2.5, z)
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL

  const mat = new StandardMaterial('emote-mat', scene)
  mat.diffuseTexture = texture
  mat.useAlphaFromDiffuseTexture = true
  mat.backFaceCulling = false
  plane.material = mat

  let elapsed = 0
  const obs = scene.onBeforeRenderObservable.add(() => {
    elapsed += scene.getEngine().getDeltaTime()
    const t = elapsed / EMOTE_DURATION_MS
    plane.position.y = CELL_SIZE * 2.5 + t * CELL_SIZE
    plane.visibility = Math.max(0, 1 - t)
    if (elapsed >= EMOTE_DURATION_MS) {
      plane.dispose()
      texture.dispose()
      scene.onBeforeRenderObservable.remove(obs)
    }
  })
}
