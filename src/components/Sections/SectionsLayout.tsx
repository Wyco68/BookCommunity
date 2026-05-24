import { JoinedSectionsList } from './JoinedSectionsList'
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
}: SectionsLayoutProps) {
  const hasJoinedSessions = listProps.filteredSessions.length > 0 || listProps.loadingSessions

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem' }}>
      <section>
        <h2 style={{ marginBottom: '1rem' }}>{t.sessions.mySessions || 'My Active Sessions'}</h2>
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
    </div>
  )
}
