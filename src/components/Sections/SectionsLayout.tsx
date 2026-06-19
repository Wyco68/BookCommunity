import { JoinedSectionsList } from './JoinedSectionsList'
import { SessionListPanel } from '../SessionListPanel'
import { filterDiscoverSessions } from '../../lib/sessionData'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import type { SessionListPanelProps } from '../SessionListPanel'
import type { ReadingSession } from '../../types'

type Copy = (typeof translations)[Language]

export interface SectionsLayoutProps {
  t: Copy
  listProps: SessionListPanelProps
  allSessions?: ReadingSession[]
}

export function SectionsLayout({
  t,
  listProps,
  allSessions,
}: SectionsLayoutProps) {
  const hasJoinedSessions = listProps.filteredSessions.length > 0 || listProps.loadingSessions
  const discoverSessions = filterDiscoverSessions(allSessions ?? [], listProps.memberships)

  return (
    <div className="stack">
      <section>
        <h2 className="span-full" style={{ marginBottom: 'var(--space-4)' }}>{t.sessions.mySessions || 'My Active Sessions'}</h2>
        {hasJoinedSessions ? (
          <JoinedSectionsList listProps={listProps} />
        ) : (
          <article className="card">
            <div className="empty">
              <p className="subtle" style={{ margin: 0 }}>{t.sessions.noSessions}</p>
              <p className="muted" style={{ marginTop: 'var(--space-2)' }}>{t.sessions.noSessionsHint}</p>
            </div>
          </article>
        )}
      </section>

      {discoverSessions.length > 0 ? (
        <section>
          <h2 style={{ marginBottom: 'var(--space-4)' }}>{t.sessions.featured}</h2>
          <SessionListPanel
            {...listProps}
            filteredSessions={discoverSessions}
            showControls={false}
            embedded
          />
        </section>
      ) : null}
    </div>
  )
}
