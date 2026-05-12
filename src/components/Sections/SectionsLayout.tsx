import { JoinedSectionsList } from './JoinedSectionsList'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import type { SessionListPanelProps } from '../SessionListPanel'

type Copy = (typeof translations)[Language]

interface SectionsLayoutProps {
  t: Copy
  listProps: SessionListPanelProps
}

export function SectionsLayout({
  t,
  listProps,
}: SectionsLayoutProps) {
  const hasJoinedSessions = listProps.filteredSessions.length > 0 || listProps.loadingSessions

  return (
    <section className="stack">
      <article className="card stack">
        <h2>{t.sessions.home}</h2>
      </article>

      {hasJoinedSessions ? (
        <JoinedSectionsList listProps={listProps} />
      ) : (
        <article className="card">
          <div className="empty">
            <p className="subtle" style={{ margin: 0 }}>{t.sessions.noSessions}</p>
          </div>
        </article>
      )}
    </section>
  )
}

export type { SectionsLayoutProps }
