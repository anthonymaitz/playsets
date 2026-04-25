import { createEffect, on, onMount, onCleanup, createSignal, Show } from 'solid-js'
import type { HighlightCell } from './board-element'
import { PointerEventTypes } from '@babylonjs/core'
import type { Scene, ArcRotateCamera, Mesh } from '@babylonjs/core'
import { MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core'
import { createScene } from './babylon/scene'
import { createGrid, worldToCell } from './babylon/grid'
import { BuildingManager } from './babylon/buildings'
import type { BuildingTile } from './types'
import { PropManager } from './babylon/props'
import { SpriteManager } from './babylon/sprites'
import { DragController } from './babylon/drag'
import type { DragCallbacks } from './babylon/drag'
import { WeatherSystem } from './babylon/weather'
import { LayerBackgroundManager } from './babylon/layers'
import type { WeatherType } from './types'
import { BuilderRoot } from './builder/BuilderRoot'

// Local SceneToken — structurally matches shared-types SceneToken
export interface SceneToken {
  id: string
  type: 'npc' | 'door' | 'enemy' | 'spawn-point'
  col: number
  row: number
  role?: string
  name?: string
  biomeId?: string
  label?: string
  level?: number
  spawnRadius?: number
}

export interface SceneData {
  buildings?: Array<{ col: number; row: number; tileId: string; instanceId?: string }>
  layers?: Array<{ id: number; background: string }>
  props?: Array<{ id: string; col: number; row: number; tileId: string }>
  tokens?: SceneToken[]
  weather?: string
}

export interface EntityData {
  id: string
  type: 'player' | 'npc' | 'enemy' | 'door'
  x: number
  y: number
  isMe?: boolean
  isGhost?: boolean
  label?: string
  direction?: string
}

export interface BuildManagers {
  buildingManager: BuildingManager
  propManager: PropManager
  spriteManager: SpriteManager
  dragController: DragController
  weatherSystem: WeatherSystem
  layerBackgroundManager: LayerBackgroundManager
  dragCallbacks: DragCallbacks
  bjsScene: Scene
  bjsCamera: ArcRotateCamera
}

interface Props {
  host: HTMLElement
  canvas: HTMLCanvasElement
  scene: SceneData
  entities: EntityData[]
  mode: string
  highlights?: HighlightCell[]
}

const ENTITY_COLORS: Record<string, Color3> = {
  player_me: new Color3(1.0, 0.60, 0.0),
  player:    new Color3(0.29, 0.50, 0.76),
  npc:       new Color3(0.29, 0.50, 0.76),
  enemy:     new Color3(0.88, 0.33, 0.33),
  door:      new Color3(0.30, 0.69, 0.31),
}

function sceneBuildings(sceneData: SceneData): BuildingTile[] {
  return (sceneData.buildings ?? []).map(b => ({
    instanceId: b.instanceId ?? `${b.col},${b.row}`,
    tileId: b.tileId,
    col: b.col,
    row: b.row,
  }))
}

export function PlaysetsBoardRoot(props: Props) {
  let bjsScene: Scene | null = null
  let bjsCamera: ArcRotateCamera | null = null
  let buildingManager: BuildingManager | null = null
  let weatherSystem: WeatherSystem | null = null
  const entityMeshes = new Map<string, Mesh>()
  const highlightMeshes: Mesh[] = []
  const [buildManagers, setBuildManagers] = createSignal<BuildManagers | null>(null)

  let dragging: { entityId: string; lastCol: number; lastRow: number } | null = null
  let ghostMesh: Mesh | null = null

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
        if (e.isGhost) mat.alpha = 0.35
        mesh.material = mat
        mesh.renderingGroupId = 6
        mesh.metadata = { entityId: e.id, draggable: e.type === 'player' && e.isMe }
        entityMeshes.set(e.id, mesh)
      }
      mesh.position = new Vector3(e.x + 0.5, 0.45, e.y + 0.5)
      // Rotate to face direction (isometric: Y is Z in world space)
      const dirAngles: Record<string, number> = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 }
      mesh.rotation.y = dirAngles[e.direction ?? 's'] ?? 0
    }
    for (const [id, mesh] of entityMeshes) {
      if (!seen.has(id)) { mesh.material?.dispose(); mesh.dispose(); entityMeshes.delete(id) }
    }
  }

  function syncHighlights(cells: HighlightCell[]) {
    if (!bjsScene) return
    for (const m of highlightMeshes) { m.material?.dispose(); m.dispose() }
    highlightMeshes.length = 0

    const colorMap: Record<string, [number, number, number]> = {
      move:      [0.2, 0.8, 0.2],
      ability:   [0.9, 0.5, 0.1],
      target:    [0.9, 0.2, 0.2],
      drop:      [0.75, 0.75, 0.75],
      dialog:    [0.2, 0.5, 1.0],
      encounter: [0.9, 0.2, 0.2],
    }

    for (const cell of cells) {
      const mesh = MeshBuilder.CreateGround(
        `hl-${cell.x}-${cell.y}`,
        { width: 0.9, height: 0.9 },
        bjsScene,
      )
      mesh.position = new Vector3(cell.x + 0.5, 0.01, cell.y + 0.5)
      mesh.renderingGroupId = 6
      mesh.isPickable = false
      const mat = new StandardMaterial(`hlmat-${cell.x}-${cell.y}`, bjsScene)
      const [r, g, b] = colorMap[cell.kind] ?? [1, 1, 1]
      mat.diffuseColor = new Color3(r, g, b)
      mat.alpha = 0.4
      mesh.material = mat
      highlightMeshes.push(mesh)
    }
  }

  onMount(() => {
    try {
      const ctx = createScene(props.canvas)
      bjsScene = ctx.scene
      bjsCamera = ctx.camera
      const ground = createGrid(bjsScene)

      // Always use BuildingManager for proper isometric tile rendering
      buildingManager = new BuildingManager(bjsScene)
      buildingManager.loadSnapshot(sceneBuildings(props.scene))

      // Weather applies to both modes
      weatherSystem = new WeatherSystem(bjsScene, ground, ctx.ambientLight, bjsCamera!)
      weatherSystem.setWeather((props.scene.weather ?? 'sunny') as WeatherType)

      if (props.mode === 'build') {
        const pm = new PropManager(bjsScene)
        const sm = new SpriteManager(bjsScene, bjsCamera ?? undefined)
        const lm = new LayerBackgroundManager(bjsScene, {})

        const dragCbs: DragCallbacks = {
          onDragMove: () => {},
          onDragDrop: (instanceId, col, row) => {
            props.host.dispatchEvent(
              new CustomEvent('tokenmove', { bubbles: true, detail: { id: instanceId, x: col, y: row } }),
            )
          },
          onSpriteClick: () => {},
          canDrop: () => true,
        }
        // IMPORTANT: DragController adds its observer here — must be BEFORE the general observer below
        const dc = new DragController(bjsScene, sm, bjsCamera!, dragCbs)

        setBuildManagers({
          buildingManager: buildingManager!,
          propManager: pm,
          spriteManager: sm,
          dragController: dc,
          weatherSystem: weatherSystem!,
          layerBackgroundManager: lm,
          dragCallbacks: dragCbs,
          bjsScene: bjsScene!,
          bjsCamera: bjsCamera!,
        })

        onCleanup(() => {
          dc.dispose()
          buildingManager?.dispose()
          buildingManager = null
          pm.dispose()
          sm.clear()
          weatherSystem?.dispose()
          weatherSystem = null
          lm.dispose()
        })
      } else {
        // Explore mode: entity cylinders for players/NPCs
        syncEntities(props.entities)

        onCleanup(() => {
          for (const m of entityMeshes.values()) { m.material?.dispose(); m.dispose() }
          entityMeshes.clear()
          for (const m of highlightMeshes) { m.material?.dispose(); m.dispose() }
          highlightMeshes.length = 0
          buildingManager?.dispose()
          buildingManager = null
          weatherSystem?.dispose()
          weatherSystem = null
        })
      }

      // General pointer observer — fires AFTER DragController's observer (added above)
      bjsScene.onPointerObservable.add((info) => {
        if (props.mode === 'build') {
          if (info.type === PointerEventTypes.POINTERUP) {
            buildManagers()?.dragController.consumeJustDropped()
          }
          return
        }

        // Explore mode pointer logic
        if (info.type === PointerEventTypes.POINTERUP) {
          if (dragging) {
            bjsCamera?.attachControl(true, false, 0)
            const pick = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => m.name === 'ground')
            if (pick?.hit && pick.pickedPoint) {
              const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
              props.host.dispatchEvent(new CustomEvent('tokenmove', { bubbles: true, detail: { id: dragging.entityId, x: col, y: row } }))
            }
            // Dispose ghost
            if (ghostMesh) {
              ghostMesh.material?.dispose()
              ghostMesh.dispose()
              ghostMesh = null
            }
            dragging = null
          } else {
            // Prioritize entity mesh pick so clicking an NPC/door cylinder fires the
            // correct cell even when the isometric ray misses the ground cell beneath it.
            const entityPick = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => !!(m.metadata?.entityId))
            if (entityPick?.hit && entityPick.pickedMesh) {
              const pos = entityPick.pickedMesh.position
              const { col, row } = worldToCell(pos.x, pos.z)
              props.host.dispatchEvent(new CustomEvent('cellclick', { bubbles: true, detail: { x: col, y: row } }))
            } else {
              const pick = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => m.name === 'ground')
              if (pick?.hit && pick.pickedPoint) {
                const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
                props.host.dispatchEvent(new CustomEvent('cellclick', { bubbles: true, detail: { x: col, y: row } }))
              }
            }
          }
          return
        }
        if (info.type === PointerEventTypes.POINTERDOWN) {
          const pickResult = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => !!(m.metadata?.draggable))
          if (pickResult?.pickedMesh?.metadata?.entityId) {
            const entityId = pickResult.pickedMesh.metadata.entityId as string
            const mesh = entityMeshes.get(entityId)
            if (mesh) {
              const { col, row } = worldToCell(mesh.position.x, mesh.position.z)
              dragging = { entityId, lastCol: col, lastRow: row }
              bjsCamera?.detachControl()

              // Create translucent ghost at the token's current position
              ghostMesh = MeshBuilder.CreateCylinder(
                `ghost-${entityId}`,
                { diameter: 0.6, height: 0.7, tessellation: 12 },
                bjsScene!,
              )
              ghostMesh.position = mesh.position.clone()
              ghostMesh.isPickable = false
              ghostMesh.renderingGroupId = 6
              const ghostMat = new StandardMaterial(`ghostmat-${entityId}`, bjsScene!)
              ghostMat.diffuseColor = (mesh.material as StandardMaterial).diffuseColor.clone()
              ghostMat.alpha = 0.45
              ghostMesh.material = ghostMat
            }
          }
          return
        }
        if (info.type === PointerEventTypes.POINTERMOVE && dragging) {
          const pick = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => m.name === 'ground')
          if (pick?.hit && pick.pickedPoint) {
            // Move ghost to world-space cursor position
            if (ghostMesh) {
              ghostMesh.position = new Vector3(pick.pickedPoint.x, 0.45, pick.pickedPoint.z)
            }
            const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
            if (col !== dragging.lastCol || row !== dragging.lastRow) {
              dragging.lastCol = col
              dragging.lastRow = row
              props.host.dispatchEvent(new CustomEvent('tokendrag', { bubbles: true, detail: { id: dragging.entityId, x: col, y: row } }))
            }
          }
        }
      })

      onCleanup(() => ctx.dispose())
    } catch (err) {
      console.error('[playsets-board] onMount error:', err)
      props.host.dispatchEvent(new CustomEvent('error', { bubbles: true, detail: { reason: 'webgl-unavailable' } }))
    }
  })

  // Reactive scene update — replace buildings + weather when scene data changes (explore mode)
  createEffect(on(() => props.scene, (sceneData) => {
    if (props.mode !== 'build') {
      if (buildingManager) buildingManager.loadSnapshot(sceneBuildings(sceneData))
      if (weatherSystem) weatherSystem.setWeather((sceneData.weather ?? 'sunny') as WeatherType)
    }
  }, { defer: true }))

  createEffect(on(() => props.entities, (entities) => {
    if (props.mode !== 'build') syncEntities(entities)
  }, { defer: true }))

  createEffect(on(() => props.highlights, (cells) => {
    syncHighlights(cells ?? [])
  }, { defer: false }))

  return (
    <>
      {/* @ts-ignore — tsconfig uses react-jsx but lib build uses vite-plugin-solid */}
      <Show when={buildManagers()}>
        {/* @ts-ignore */}
        {(managers: () => BuildManagers) => (
          // @ts-ignore
          <BuilderRoot host={props.host} scene={props.scene} managers={managers()} />
        )}
      </Show>
    </>
  )
}
