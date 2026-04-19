import { SessionDetailPanel } from '../SessionDetailPanel'
import { SessionListPanel } from '../SessionListPanel'
import type { SessionDetailPanelProps } from '../SessionDetailPanel'
import type { SessionListPanelProps } from '../SessionListPanel'

interface SectionsAndDetailsProps {
  listProps: SessionListPanelProps
  detailProps: SessionDetailPanelProps
}

export function SectionsAndDetails({ listProps, detailProps }: SectionsAndDetailsProps) {
  return (
    <section className="grid">
      <SessionListPanel {...listProps} />
      <SessionDetailPanel {...detailProps} />
    </section>
  )
}

export type { SectionsAndDetailsProps }
