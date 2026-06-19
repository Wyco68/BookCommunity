import type { FormEvent } from 'react'
import { JoinedSectionsList } from './JoinedSectionsList'
import { SessionListPanel } from '../SessionListPanel'
import { SearchInput } from '../SearchSection/SearchInput'
import { filterDiscoverSessions } from '../../lib/sessionData'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import type { SessionListPanelProps } from '../SessionListPanel'
import type { ReadingSession } from '../../types'

type Copy = (typeof translations)[Language]

export interface SectionsLayoutProps {
  t: Copy
  searchListProps: SessionListPanelProps
  joinedListProps: SessionListPanelProps
  allSessions?: ReadingSession[]
}

export function SectionsLayout({
  t,
  searchListProps,
  joinedListProps,
  allSessions,
}: SectionsLayoutProps) {
  const { sessionSearch, visibilityFilter, onSessionSearchChange, onVisibilityFilterChange } = searchListProps
  const isSearching = sessionSearch.trim() !== '' || visibilityFilter !== 'all'

  const hasJoinedSessions = joinedListProps.filteredSessions.length > 0 || joinedListProps.loadingSessions
  const discoverSessions = filterDiscoverSessions(allSessions ?? [], joinedListProps.memberships)

  return (
    <div className="stack">
      <section className="home-search-bar">
        <form onSubmit={(e: FormEvent) => e.preventDefault()} className="search-toolbar-input">
          <SearchInput
            value={sessionSearch}
            label={t.sessions.searchLabel}
            placeholder={t.sessions.searchPlaceholder}
            onChange={onSessionSearchChange}
          />
        </form>
        <div className="search-toolbar-pills">
          <button
            type="button"
            className={`pill ${visibilityFilter === 'all' ? 'pill-selected' : ''}`}
            onClick={() => onVisibilityFilterChange('all')}
          >
            {t.sessions.all}
          </button>
          <button
            type="button"
            className={`pill ${visibilityFilter === 'public' ? 'pill-selected' : ''}`}
            onClick={() => onVisibilityFilterChange('public')}
          >
            {t.enums.visibility.public}
          </button>
          <button
            type="button"
            className={`pill ${visibilityFilter === 'private' ? 'pill-selected' : ''}`}
            onClick={() => onVisibilityFilterChange('private')}
          >
            {t.enums.visibility.private}
          </button>
        </div>
      </section>

      {isSearching ? (
        <SessionListPanel {...searchListProps} showControls={false} embedded />
      ) : (
        <>
          <section>
            <h2 className="span-full" style={{ marginBottom: 'var(--space-4)' }}>{t.sessions.mySessions || 'My Active Sessions'}</h2>
            {hasJoinedSessions ? (
              <JoinedSectionsList listProps={joinedListProps} />
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
                {...joinedListProps}
                filteredSessions={discoverSessions}
                showControls={false}
                embedded
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
