import type { FacingDir } from '../types'

const CAMERA_SNAP = Math.PI / 2
const CAMERA_OFFSET = -Math.PI / 4  // SW corner = snap index 0

// 0=SW, 1=NW, 2=NE, 3=SE
export function getCameraSnapIndex(alpha: number): number {
  return (((Math.round((alpha - CAMERA_OFFSET) / CAMERA_SNAP)) % 4) + 4) % 4
}

// Ordered so that FACING_ORDER[snapIndex] is the direction that shows FRONT (unmirrored)
// at that snap. Each 90° CW camera rotation shifts the front direction one step: W→N→E→S
const FACING_ORDER: FacingDir[] = ['w', 'n', 'e', 's']

// Relative position within the cycle determines sprite variant:
//   rel=0 → front (unmirrored)
//   rel=1 → back  (unmirrored)
//   rel=2 → back  (mirrored)
//   rel=3 → front (mirrored)
export function computeSpriteVariant(
  facing: FacingDir,
  snapIndex: number,
): { isFront: boolean; isMirrored: boolean } {
  const fi = FACING_ORDER.indexOf(facing)
  const rel = ((fi - snapIndex) % 4 + 4) % 4
  switch (rel) {
    case 0: return { isFront: true,  isMirrored: false }
    case 1: return { isFront: false, isMirrored: false }
    case 2: return { isFront: false, isMirrored: true  }
    default: return { isFront: true,  isMirrored: true  }  // rel=3
  }
}

// The 4 DirectionPicker arrow positions, in screen-space order:
//   0 = ↙ lower-left  → front unmirrored  (offset 0 in cycle)
//   1 = ↘ lower-right → front mirrored    (offset 3 in cycle)
//   2 = ↖ upper-left  → back  unmirrored  (offset 1 in cycle)
//   3 = ↗ upper-right → back  mirrored    (offset 2 in cycle)
const ARROW_CYCLE_OFFSETS = [0, 3, 1, 2]

export function getArrowWorldDir(arrowIndex: number, snapIndex: number): FacingDir {
  return FACING_ORDER[(snapIndex + ARROW_CYCLE_OFFSETS[arrowIndex]) % 4]
}
