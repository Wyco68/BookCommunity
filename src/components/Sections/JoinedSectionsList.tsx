import { SessionListPanel } from '../SessionListPanel'
import type { SessionListPanelProps } from '../SessionListPanel'

interface JoinedSectionsListProps {
  listProps: SessionListPanelProps
}

export function JoinedSectionsList({ listProps }: JoinedSectionsListProps) {
  return <SessionListPanel {...listProps} showControls={false} />
}
