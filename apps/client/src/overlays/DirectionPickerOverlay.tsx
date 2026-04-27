import { For } from 'solid-js'
import type { FacingDir } from '../types'
import { getCameraSnapIndex, getArrowWorldDir } from '../babylon/cameraFacing'

interface Props {
  screenX: number
  screenY: number
  cameraAlpha: number
  onPick: (facing: FacingDir) => void
  onDismiss?: () => void
}

// Order matches getArrowWorldDir arrowIndex: 0=↙, 1=↘, 2=↖, 3=↗
const ARROW_POSITIONS = [
  { label: '↙', dx: -56, dy:  44 },
  { label: '↘', dx:  56, dy:  44 },
  { label: '↖', dx: -56, dy: -44 },
  { label: '↗', dx:  56, dy: -44 },
]

export function DirectionPickerOverlay(props: Props) {
  const snapIndex = () => getCameraSnapIndex(props.cameraAlpha)
  return (
    <For each={ARROW_POSITIONS}>
      {({ label, dx, dy }, i) => {
        const dir = () => getArrowWorldDir(i(), snapIndex())
        return (
          <button
            onPointerDown={(e) => { e.stopPropagation(); props.onPick(dir()); props.onDismiss?.() }}
            style={`position:fixed;left:${props.screenX + dx - 26}px;top:${props.screenY + dy - 18}px;width:52px;height:36px;z-index:70;background:rgba(15,15,20,0.88);border:1px solid rgba(255,210,50,0.7);border-radius:6px;color:#ffe033;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;letter-spacing:0.03em;box-shadow:0 2px 8px rgba(0,0,0,0.6);pointer-events:auto;`}
          >
            {label} {dir().toUpperCase()}
          </button>
        )
      }}
    </For>
  )
}
