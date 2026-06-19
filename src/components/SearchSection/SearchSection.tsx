import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import { SessionListPanel } from '../SessionListPanel'
import type { SessionListPanelProps } from '../SessionListPanel'
import { SearchInput } from './SearchInput'
import type { SessionFormState } from '../../hooks/useSessions'

type Copy = (typeof translations)[Language]

export interface SearchSectionProps {
  t: Copy
  listProps: SessionListPanelProps
  sessionForm: SessionFormState
  creatingSession: boolean
  onSessionFormChange: (next: SessionFormState) => void
  onCreateSession: (event: FormEvent<HTMLFormElement>) => Promise<void>
}

export function SearchSection({
  t,
  listProps,
}: SearchSectionProps) {
  const [visibility, setVisibility] = useState<'all' | 'public' | 'private'>('all')
  const { onSessionSearchChange, onVisibilityFilterChange } = listProps

  useEffect(() => {
    onVisibilityFilterChange(visibility)
  }, [visibility, onVisibilityFilterChange])

  return (
    <div className="search-page">
      <div className="search-page-header">
        <h2>{t.nav.search}</h2>
        <div className="search-toolbar-row">
          <form onSubmit={(e: FormEvent) => e.preventDefault()} className="search-toolbar-input">
            <SearchInput
              value={listProps.sessionSearch}
              label={t.sessions.searchLabel}
              placeholder={t.sessions.searchPlaceholder}
              onChange={onSessionSearchChange}
            />
          </form>
          <div className="search-toolbar-pills">
            <button
              type="button"
              className={`pill ${visibility === 'all' ? 'pill-selected' : ''}`}
              onClick={() => setVisibility('all')}
            >
              {t.sessions.all}
            </button>
            <button
              type="button"
              className={`pill ${visibility === 'public' ? 'pill-selected' : ''}`}
              onClick={() => setVisibility('public')}
            >
              {t.enums.visibility.public}
            </button>
            <button
              type="button"
              className={`pill ${visibility === 'private' ? 'pill-selected' : ''}`}
              onClick={() => setVisibility('private')}
            >
              {t.enums.visibility.private}
            </button>
          </div>
        </div>
      </div>

      <div className="search-page-content">
        <SessionListPanel {...listProps} showControls={false} embedded />
      </div>
    </div>
  )
}
