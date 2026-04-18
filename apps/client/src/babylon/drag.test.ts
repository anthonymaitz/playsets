import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// BabylonJS mock — we only need the pieces DragController uses
// ---------------------------------------------------------------------------
vi.mock('@babylonjs/core', () => {
  const Vector3 = class {
    constructor(
      public x = 0,
      public y = 0,
      public z = 0,
    ) {}
  }

  const Color3 = class {
    constructor(
      public r = 0,
      public g = 0,
      public b = 0,
    ) {}
  }

  const ghostMat = { diffuseColor: null, alpha: 1 }
  const ghostMesh = {
    position: new Vector3(),
    material: null as unknown,
    dispose: vi.fn(),
  }

  const StandardMaterial = vi.fn(() => ghostMat)
  const MeshBuilder = {
    CreateBox: vi.fn(() => ghostMesh),
  }

  const PointerEventTypes = {
    POINTERDOWN: 1,
    POINTERMOVE: 2,
    POINTERUP: 4,
  }

  return { Vector3, Color3, StandardMaterial, MeshBuilder, PointerEventTypes }
})

// ---------------------------------------------------------------------------
// grid mock — return simple deterministic values
// ---------------------------------------------------------------------------
vi.mock('./grid', () => ({
  GRID_COLS: 20,
  GRID_ROWS: 20,
  cellToWorld: (col: number, row: number) => ({ x: col * 1, z: row * 1 }),
  worldToCell: (x: number, z: number) => ({ col: Math.floor(x), row: Math.floor(z) }),
}))

// ---------------------------------------------------------------------------
// Helpers to build mocks
// ---------------------------------------------------------------------------

type PointerHandler = (info: { type: number; pickInfo?: { pickedMesh?: object } }) => void

type PickResult = { hit: boolean; pickedPoint: { x: number; z: number } | null } | null

function makeScene(pickResult: PickResult) {
  let handler: PointerHandler | null = null
  return {
    onPointerObservable: {
      add: vi.fn((h: PointerHandler) => {
        handler = h
      }),
    },
    pointerX: 0,
    pointerY: 0,
    pick: vi.fn((): PickResult => pickResult),
    _fireEvent(type: number, pickedMesh?: object) {
      handler?.({ type, pickInfo: { pickedMesh } })
    },
  }
}

function makeSpriteManager(instanceId: string, meshPos = { x: 2, y: 0, z: 3 }) {
  const mesh = { position: meshPos }
  return {
    getInstanceId: vi.fn((m: object) => (m === mesh ? instanceId : undefined)),
    getMesh: vi.fn(() => mesh),
    move: vi.fn(),
    setHighlight: vi.fn(),
    _mesh: mesh,
  }
}

function makeCallbacks() {
  return {
    onDragMove: vi.fn(),
    onDragDrop: vi.fn(),
    onSpriteClick: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Import DragController after mocks are set up
// ---------------------------------------------------------------------------
import { DragController } from './drag'
import { PointerEventTypes } from '@babylonjs/core'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DragController', () => {
  const ID = 'sprite-1'

  describe('click (no movement)', () => {
    it('fires onSpriteClick and NOT onDragDrop when pointer never moves over ground', () => {
      // pick returns null — no ground hit during onUp either
      const scene = makeScene(null)
      const sm = makeSpriteManager(ID)
      const cb = makeCallbacks()

      new DragController(scene as never, sm as never, cb)

      scene._fireEvent(PointerEventTypes.POINTERDOWN, sm._mesh)
      // no POINTERMOVE fired
      scene._fireEvent(PointerEventTypes.POINTERUP)

      expect(cb.onSpriteClick).toHaveBeenCalledOnce()
      expect(cb.onSpriteClick).toHaveBeenCalledWith(ID)
      expect(cb.onDragDrop).not.toHaveBeenCalled()
    })
  })

  describe('drag with valid drop', () => {
    it('fires onDragDrop(id, col, row) and NOT onSpriteClick', () => {
      const dropCell = { hit: true, pickedPoint: { x: 5.5, z: 7.5 } }
      const scene = makeScene(dropCell)
      const sm = makeSpriteManager(ID)
      const cb = makeCallbacks()

      new DragController(scene as never, sm as never, cb)

      scene._fireEvent(PointerEventTypes.POINTERDOWN, sm._mesh)
      scene._fireEvent(PointerEventTypes.POINTERMOVE)
      scene._fireEvent(PointerEventTypes.POINTERUP)

      expect(cb.onDragDrop).toHaveBeenCalledOnce()
      expect(cb.onDragDrop).toHaveBeenCalledWith(ID, 5, 7)
      expect(cb.onSpriteClick).not.toHaveBeenCalled()
    })
  })

  describe('drag with no valid ground on drop', () => {
    it('reverts sprite and fires onDragDrop with original coords', () => {
      // First call (onMove) hits ground so hasMoved becomes true;
      // second call (onUp) misses ground so sprite reverts.
      let callCount = 0
      const validCell = { hit: true, pickedPoint: { x: 5.5, z: 7.5 } }
      const scene = makeScene(null) // default: no hit
      // Override pick to return valid on first call (during onMove), null on second (onUp)
      scene.pick = vi.fn((): PickResult => {
        callCount++
        return callCount === 1 ? validCell : null
      })

      // Sprite starts at col=2, row=3 (worldToCell(2,3))
      const sm = makeSpriteManager(ID, { x: 2, y: 0, z: 3 })
      const cb = makeCallbacks()

      new DragController(scene as never, sm as never, cb)

      scene._fireEvent(PointerEventTypes.POINTERDOWN, sm._mesh)
      scene._fireEvent(PointerEventTypes.POINTERMOVE) // hasMoved = true
      scene._fireEvent(PointerEventTypes.POINTERUP)   // pick returns null → revert

      expect(cb.onDragDrop).toHaveBeenCalledOnce()
      expect(cb.onDragDrop).toHaveBeenCalledWith(ID, 2, 3)
      expect(sm.move).toHaveBeenCalledWith(ID, 2, 3)
      expect(cb.onSpriteClick).not.toHaveBeenCalled()
    })
  })

  describe('dispose()', () => {
    it('does not throw when ghost is null', () => {
      const scene = makeScene(null)
      const sm = makeSpriteManager(ID)
      const cb = makeCallbacks()

      const ctrl = new DragController(scene as never, sm as never, cb)
      expect(() => ctrl.dispose()).not.toThrow()
    })
  })
})
