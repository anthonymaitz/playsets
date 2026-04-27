import { createEffect, on, onMount, onCleanup, createSignal, Show } from 'solid-js'
import type { HighlightCell } from './board-element'
import { PointerEventTypes } from '@babylonjs/core'
import type { Scene, ArcRotateCamera, Mesh } from '@babylonjs/core'
import { MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core'
import { createScene } from './babylon/scene'
import { createGrid, worldToCell } from './babylon/grid'
import { BuildingManager } from './babylon/buildings'
import type { BuildingTile, FacingDir, SpriteInstance, WeatherType } from './types'
import { PropManager } from './babylon/props'
import { SpriteManager } from './babylon/sprites'
import { DragController } from './babylon/drag'
import type { DragCallbacks } from './babylon/drag'
import { WeatherSystem } from './babylon/weather'
import { LayerBackgroundManager } from './babylon/layers'
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
  direction?: string
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
  spriteId?: string
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

// Colored token fallback — PNG canvas data-URI (SVG data-URIs don't decode alpha reliably in BabylonJS)
const ENTITY_SPRITE_COLORS: Record<string, string> = {
  player_me: '#e07020',
  player:    '#4a7fc1',
  npc:       '#2d9a5a',
  enemy:     '#e05555',
  door:      '#cc8844',
}
const _entityDataUriCache = new Map<string, string>()

function entityDataUri(typeKey: string): string {
  const cached = _entityDataUriCache.get(typeKey)
  if (cached) return cached
  const color = ENTITY_SPRITE_COLORS[typeKey] ?? '#4488cc'
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 96
  const ctx = canvas.getContext('2d')!
  const r = 8, w = 64, h = 96
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.arcTo(w, 0, w, r, r)
  ctx.lineTo(w, h - r); ctx.arcTo(w, h, w - r, h, r)
  ctx.lineTo(r, h); ctx.arcTo(0, h, 0, h - r, r)
  ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r)
  ctx.closePath(); ctx.fill()
  const uri = canvas.toDataURL('image/png')
  _entityDataUriCache.set(typeKey, uri)
  return uri
}

function dragFacing(fromCol: number, fromRow: number, toCol: number, toRow: number): FacingDir {
  const dc = toCol - fromCol
  const dr = toRow - fromRow
  if (Math.abs(dc) >= Math.abs(dr)) return dc >= 0 ? 'e' : 'w'
  return dr >= 0 ? 's' : 'n'
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
  let exploreSpriteManager: SpriteManager | null = null
  const trackedEntityIds = new Set<string>()
  const highlightMeshes: Mesh[] = []
  const [buildManagers, setBuildManagers] = createSignal<BuildManagers | null>(null)

  let dragging: { entityId: string; startCol: number; startRow: number; lastCol: number; lastRow: number; moved: boolean } | null = null

  function syncEntities(entities: EntityData[]) {
    const sm = exploreSpriteManager
    if (!sm) return

    const seen = new Set<string>()
    for (const e of entities) {
      seen.add(e.id)
      const typeKey = e.type === 'player' && e.isMe ? 'player_me' : e.type
      const facing = (e.direction ?? 's') as FacingDir
      // Doors don't face a direction; all other entity types get a direction indicator
      const wantsIndicator = e.type !== 'door'

      const basePath = e.spriteId ?? entityDataUri(typeKey)
      const existingMesh = sm.getMesh(e.id)
      if (existingMesh && existingMesh.metadata?.basePath !== basePath) {
        // Sprite changed (e.g. heroState arrived after initial placement) — re-place
        sm.remove(e.id)
        trackedEntityIds.delete(e.id)
      }
      if (!sm.getMesh(e.id)) {
        const instance: SpriteInstance = {
          instanceId: e.id,
          // spriteId prefix 'tokens/' triggers hasDirections in SpriteManager.place()
          spriteId: wantsIndicator ? 'tokens/entity' : 'entity',
          col: e.x,
          row: e.y,
          placedBy: 'system',
          facing,
          // definitionId also enables hasDirections — belt-and-suspenders for non-tokens/ ids
          definitionId: wantsIndicator ? e.type : undefined,
        }
        sm.place(instance, basePath)
        const mesh = sm.getMesh(e.id)
        if (mesh) {
          // Only the local player's token is draggable; override SpriteManager's default
          mesh.metadata.draggable = e.type === 'player' && !!e.isMe
          if (e.isGhost) mesh.visibility = 0.35
        }
        trackedEntityIds.add(e.id)
      } else {
        sm.move(e.id, e.x, e.y)
        if (wantsIndicator) sm.setFacing(e.id, facing)
      }
    }

    for (const id of trackedEntityIds) {
      if (!seen.has(id)) {
        sm.remove(id)
        trackedEntityIds.delete(id)
      }
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
      mesh.renderingGroupId = 4
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
      // Clear depth before rendering group 5 (sprites) so wall/building geometry (group 0) can't occlude tokens
      bjsScene.setRenderingAutoClearDepthStencil(5, true)
      const ground = createGrid(bjsScene)

      buildingManager = new BuildingManager(bjsScene)
      buildingManager.loadSnapshot(sceneBuildings(props.scene))

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
        // Explore / combat mode — SpriteManager handles all entity rendering
        exploreSpriteManager = new SpriteManager(bjsScene, bjsCamera ?? undefined)
        syncEntities(props.entities)

        onCleanup(() => {
          exploreSpriteManager?.clear()
          exploreSpriteManager = null
          trackedEntityIds.clear()
          for (const m of highlightMeshes) { m.material?.dispose(); m.dispose() }
          highlightMeshes.length = 0
          buildingManager?.dispose()
          buildingManager = null
          weatherSystem?.dispose()
          weatherSystem = null
        })
      }

      // General pointer observer — fires AFTER DragController's observer (added above in build mode)
      bjsScene.onPointerObservable.add((info) => {
        if (props.mode === 'build') {
          if (info.type === PointerEventTypes.POINTERUP) {
            buildManagers()?.dragController.consumeJustDropped()
          }
          return
        }

        // Explore / combat pointer logic
        if (info.type === PointerEventTypes.POINTERUP) {
          if (dragging) {
            bjsCamera?.attachControl(true, false, 0)
            if (dragging.moved) {
              const pick = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => m.name === 'ground')
              if (pick?.hit && pick.pickedPoint) {
                const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
                props.host.dispatchEvent(new CustomEvent('tokenmove', { bubbles: true, detail: { id: dragging.entityId, x: col, y: row } }))
              }
            }
            const mesh = exploreSpriteManager?.getMesh(dragging.entityId)
            if (mesh) mesh.visibility = 1
            exploreSpriteManager?.hidePlacementGhost()
            dragging = null
          } else {
            // Prioritize sprite pick — the billboard plane is the correct hit target for entity clicks
            const entityPick = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => !!(m.metadata?.instanceId))
            if (entityPick?.hit && entityPick.pickedMesh) {
              const instanceId = entityPick.pickedMesh.metadata?.instanceId as string
              const pos = entityPick.pickedMesh.position
              const { col, row } = worldToCell(pos.x, pos.z)
              // spriteclick: let host show context menu (facing, stats, etc.)
              props.host.dispatchEvent(new CustomEvent('spriteclick', { bubbles: true, detail: { id: instanceId, x: col, y: row } }))
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
          if (pickResult?.pickedMesh?.metadata?.instanceId) {
            const entityId = pickResult.pickedMesh.metadata.instanceId as string
            const mesh = exploreSpriteManager?.getMesh(entityId)
            if (mesh) {
              const { col, row } = worldToCell(mesh.position.x, mesh.position.z)
              dragging = { entityId, startCol: col, startRow: row, lastCol: col, lastRow: row, moved: false }
              bjsCamera?.detachControl()
              mesh.visibility = 0.4
              const basePath = (mesh.metadata?.basePath as string) ?? ''
              exploreSpriteManager?.showPlacementGhost('tokens/ghost', basePath, col, row)
            }
          }
          return
        }

        if (info.type === PointerEventTypes.POINTERMOVE && dragging) {
          const pick = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => m.name === 'ground')
          if (pick?.hit && pick.pickedPoint) {
            const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
            if (col !== dragging.lastCol || row !== dragging.lastRow) {
              dragging.lastCol = col
              dragging.lastRow = row
              dragging.moved = true
              const mesh = exploreSpriteManager?.getMesh(dragging.entityId)
              const basePath = (mesh?.metadata?.basePath as string) ?? ''
              const facing = dragFacing(dragging.startCol, dragging.startRow, col, row)
              exploreSpriteManager?.showPlacementGhost('tokens/ghost', basePath, col, row, facing)
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
