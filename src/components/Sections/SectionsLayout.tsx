import { JoinedSectionsList } from './JoinedSectionsList'
import { SectionDetails } from './SectionDetails'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import type { SessionListPanelProps } from '../SessionListPanel'
import type { SessionDetailPanelProps } from '../SessionDetailPanel'

type Copy = (typeof translations)[Language]

interface SectionsLayoutProps {
  t: Copy
  listProps: SessionListPanelProps
  detailProps: SessionDetailPanelProps
}

export function SectionsLayout({
  t,
  listProps,
  detailProps,
}: SectionsLayoutProps) {
  return (
    <section className="stack">
      <article className="card stack">
        <h2>Sections</h2>
        <p className="subtle">Select a joined section to review {t.sessions.memberProgress.toLowerCase()} and discussion.</p>
      </article>

      <section className="sections-grid">
        <JoinedSectionsList listProps={listProps} />
        <SectionDetails detailProps={detailProps} />
      </section>
    </section>
  )
}

export type { SectionsLayoutProps }
