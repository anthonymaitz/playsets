import type { ToolTab } from './BuilderRoot'
interface Props {
  selectedTab: ToolTab
  onSelectTab: (tab: ToolTab) => void
  selectedTileId: string
  onSelectTileId: (id: string) => void
  onSave: () => void
}
export function BuilderToolbar(_props: Props) { return <></> }
