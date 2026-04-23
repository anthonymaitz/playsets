import { createEffect, on, onMount, onCleanup } from 'solid-js'
import { PointerEventTypes } from '@babylonjs/core'
import type { Scene, Engine, ArcRotateCamera, Mesh } from '@babylonjs/core'
import { MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core'
import { createScene } from './babylon/scene'
import { createGrid, worldToCell } from './babylon/grid'
import { BuildingManager } from './babylon/buildings'

export interface SceneData {
  buildings?: Array<{ col: number; row: number; tileId: string; instanceId?: string }>
  layers?: Array<{ id: number; background: string }>
  props?: Array<{ id: string; col: number; row: number; tileId: string }>
  weather?: string
}

export interface EntityData {
  id: string
  type: 'player' | 'npc' | 'enemy' | 'door'
  x: number
  y: number
  isMe?: boolean
  label?: string
}

interface Props {
  host: HTMLElement
  canvas: HTMLCanvasElement
  scene: SceneData
  entities: EntityData[]
  mode: string
}

const ENTITY_COLORS: Record<string, Color3> = {
  player_me: new Color3(1.0, 0.60, 0.0),
  player:    new Color3(0.29, 0.50, 0.76),
  npc:       new Color3(0.29, 0.50, 0.76),
  enemy:     new Color3(0.88, 0.33, 0.33),
  door:      new Color3(0.30, 0.69, 0.31),
}

const WALL_COLOR = new Color3(0.5, 0.42, 0.35)
const FLOOR_COLOR = new Color3(0.72, 0.65, 0.52)

export function PlaysetsBoardRoot(props: Props) {
  let bjsEngine: Engine | null = null
  let bjsScene: Scene | null = null
  let buildingMeshes = new Map<string, Mesh>()
  const entityMeshes = new Map<string, Mesh>()

  // -- drag state --
  let dragging: { entityId: string; lastCol: number; lastRow: number } | null = null

  function syncBuildings(sceneData: SceneData) {
    if (!bjsScene) return
    for (const m of buildingMeshes.values()) {
      m.material?.dispose()
      m.dispose()
    }
    buildingMeshes.clear()

    for (const b of sceneData.buildings ?? []) {
      const key = b.instanceId ?? `${b.col},${b.row}`
      const isWall = !b.tileId.includes('floor')
      const mesh = MeshBuilder.CreateBox(
        `building-${key}`,
        { width: 1, height: isWall ? 2 : 0.1, depth: 1 },
        bjsScene,
      )
      mesh.position = new Vector3(b.col, isWall ? 1 : 0, b.row)
      mesh.isPickable = false
      const mat = new StandardMaterial(`bmat-${key}`, bjsScene)
      mat.diffuseColor = isWall ? WALL_COLOR : FLOOR_COLOR
      mesh.material = mat
      buildingMeshes.set(key, mesh)
    }
  }

  function syncEntities(entities: EntityData[]) {
    if (!bjsScene) return
    const seen = new Set<string>()
    for (const e of entities) {
      seen.add(e.id)
      let mesh = entityMeshes.get(e.id)
      if (!mesh) {
        mesh = MeshBuilder.CreateCylinder(
          `entity-${e.id}`,
          { diameter: 0.6, height: 0.7, tessellation: 12 },
          bjsScene,
        )
        const mat = new StandardMaterial(`emat-${e.id}`, bjsScene)
        const colorKey = e.type === 'player' && e.isMe ? 'player_me' : e.type
        mat.diffuseColor = ENTITY_COLORS[colorKey] ?? ENTITY_COLORS.npc
        mesh.material = mat
        mesh.metadata = { entityId: e.id, draggable: e.type === 'player' && e.isMe }
        entityMeshes.set(e.id, mesh)
      }
      mesh.position = new Vector3(e.x, 0.45, e.y)
    }
    for (const [id, mesh] of entityMeshes) {
      if (!seen.has(id)) {
        mesh.material?.dispose()
        mesh.dispose()
        entityMeshes.delete(id)
      }
    }
  }

  onMount(() => {
    try {
      const ctx = createScene(props.canvas)
      bjsEngine = ctx.engine
      bjsScene = ctx.scene

      createGrid(bjsScene)

      syncBuildings(props.scene)
      syncEntities(props.entities)

      // Cellclick: ground pick on pointer up (when not dragging)
      bjsScene.onPointerObservable.add((info) => {
        if (info.type === PointerEventTypes.POINTERUP) {
          if (dragging) {
            const pick = bjsScene!.pick(
              bjsScene!.pointerX,
              bjsScene!.pointerY,
              (m) => m.name === 'ground',
            )
            if (pick?.hit && pick.pickedPoint) {
              const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
              props.host.dispatchEvent(
                new CustomEvent('tokenmove', { bubbles: true, detail: { id: dragging.entityId, x: col, y: row } }),
              )
            }
            dragging = null
          } else {
            const pick = bjsScene!.pick(
              bjsScene!.pointerX,
              bjsScene!.pointerY,
              (m) => m.name === 'ground',
            )
            if (pick?.hit && pick.pickedPoint) {
              const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
              props.host.dispatchEvent(
                new CustomEvent('cellclick', { bubbles: true, detail: { x: col, y: row } }),
              )
            }
          }
          return
        }

        if (info.type === PointerEventTypes.POINTERDOWN) {
          const pickResult = bjsScene!.pick(
            bjsScene!.pointerX,
            bjsScene!.pointerY,
            (m) => !!(m.metadata?.draggable),
          )
          if (pickResult?.pickedMesh?.metadata?.entityId) {
            const entityId = pickResult.pickedMesh.metadata.entityId as string
            const mesh = entityMeshes.get(entityId)
            if (mesh) {
              const { col, row } = worldToCell(mesh.position.x, mesh.position.z)
              dragging = { entityId, lastCol: col, lastRow: row }
            }
          }
          return
        }

        if (info.type === PointerEventTypes.POINTERMOVE && dragging) {
          const pick = bjsScene!.pick(
            bjsScene!.pointerX,
            bjsScene!.pointerY,
            (m) => m.name === 'ground',
          )
          if (pick?.hit && pick.pickedPoint) {
            const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
            if (col !== dragging.lastCol || row !== dragging.lastRow) {
              dragging.lastCol = col
              dragging.lastRow = row
              props.host.dispatchEvent(
                new CustomEvent('tokendrag', {
                  bubbles: true,
                  detail: { id: dragging.entityId, x: col, y: row },
                }),
              )
            }
          }
        }
      })

      const handleResize = () => bjsEngine?.resize()
      window.addEventListener('resize', handleResize)
      onCleanup(() => {
        window.removeEventListener('resize', handleResize)
        for (const m of buildingMeshes.values()) { m.material?.dispose(); m.dispose() }
        buildingMeshes.clear()
        for (const m of entityMeshes.values()) { m.material?.dispose(); m.dispose() }
        entityMeshes.clear()
        bjsEngine?.dispose()
        bjsEngine = null
        bjsScene = null
      })
    } catch {
      props.host.dispatchEvent(
        new CustomEvent('error', { bubbles: true, detail: { reason: 'webgl-unavailable' } }),
      )
    }
  })

  createEffect(on(() => props.scene, (sceneData) => {
    syncBuildings(sceneData)
  }, { defer: true }))

  createEffect(on(() => props.entities, (entities) => {
    syncEntities(entities)
  }, { defer: true }))

  return <>{/* canvas is passed in from board-element.ts, babylon renders directly into it */}</>
}
