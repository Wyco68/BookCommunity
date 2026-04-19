import { SessionDetailPanel } from '../SessionDetailPanel'
import type { SessionDetailPanelProps } from '../SessionDetailPanel'

interface SectionDetailsProps {
  detailProps: SessionDetailPanelProps
}

export function SectionDetails({ detailProps }: SectionDetailsProps) {
  return <SessionDetailPanel {...detailProps} fullWidth={false} />
}
