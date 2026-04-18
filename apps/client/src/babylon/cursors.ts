import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, DynamicTexture, Mesh } from '@babylonjs/core'

interface CursorEntry {
  dot: Mesh
  label: Mesh
  labelTexture: DynamicTexture
  labelMat: StandardMaterial
  dotMat: StandardMaterial
}

export class CursorManager {
  private cursors = new Map<string, CursorEntry>()

  constructor(private scene: Scene) {}

  upsert(playerId: string, displayName: string, color: string, worldX: number, worldZ: number): void {
    let entry = this.cursors.get(playerId)

    if (!entry) {
      const dot = MeshBuilder.CreateSphere(`cursor-${playerId}`, { diameter: 0.3 }, this.scene)
      const dotMat = new StandardMaterial(`cursor-mat-${playerId}`, this.scene)
      dotMat.diffuseColor = Color3.FromHexString(color)
      dotMat.emissiveColor = Color3.FromHexString(color)
      dot.material = dotMat

      const texture = new DynamicTexture(`label-tex-${playerId}`, { width: 256, height: 64 }, this.scene, false)
      texture.hasAlpha = true
      const ctx = texture.getContext()
      ctx.font = 'bold 28px sans-serif'
      ctx.fillStyle = color
      ctx.fillText(displayName, 4, 48)
      texture.update()

      const label = MeshBuilder.CreatePlane(`label-${playerId}`, { width: 2, height: 0.5 }, this.scene)
      const labelMat = new StandardMaterial(`label-mat-${playerId}`, this.scene)
      labelMat.diffuseTexture = texture
      labelMat.useAlphaFromDiffuseTexture = true
      labelMat.backFaceCulling = false
      label.material = labelMat
      label.billboardMode = Mesh.BILLBOARDMODE_ALL

      entry = { dot, label, labelTexture: texture, labelMat, dotMat }
      this.cursors.set(playerId, entry)
    }

    entry.dot.position = new Vector3(worldX, 0.2, worldZ)
    entry.label.position = new Vector3(worldX, 0.8, worldZ)
  }

  remove(playerId: string): void {
    const entry = this.cursors.get(playerId)
    if (!entry) return
    entry.labelTexture.dispose()
    entry.labelMat.dispose()
    entry.dotMat.dispose()
    entry.dot.dispose()
    entry.label.dispose()
    this.cursors.delete(playerId)
  }

  clear(): void {
    for (const id of [...this.cursors.keys()]) this.remove(id)
  }
}
