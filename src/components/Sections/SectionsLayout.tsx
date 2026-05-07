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
  listProps,
}: SectionsLayoutProps) {
  const hasJoinedSessions = listProps.filteredSessions.length > 0 || listProps.loadingSessions

  return (
    <section className="stack">
      <article className="card stack">
        <h2>Home</h2>
        <p className="subtle">Your joined reading sessions.</p>
      </article>

      {hasJoinedSessions ? (
        <JoinedSectionsList listProps={listProps} />
      ) : (
        <article className="card">
          <div className="empty">
            <p className="subtle" style={{ margin: 0 }}>You haven't joined any sessions yet.</p>
            <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
              Use the <strong>Search</strong> tab to discover and join reading sessions.
            </p>
          </div>
        </article>
      )}
    </section>
  )
}

export type { SectionsLayoutProps }
