import type { LayerBackgroundManager } from '../babylon/layers'
interface Props {
  weather: string
  onWeatherChange: (w: string) => void
  layerManager: LayerBackgroundManager
}
export function LayerPanel(_props: Props) { return <></> }
