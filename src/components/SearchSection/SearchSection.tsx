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
  const [draftSearch, setDraftSearch] = useState(listProps.sessionSearch)
  const [visibility, setVisibility] = useState<'all' | 'public' | 'private'>('all')
  const [hasSearched, setHasSearched] = useState(false)
  const { onSessionSearchChange, onVisibilityFilterChange } = listProps

  // Submit search
  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    onSessionSearchChange(draftSearch)
    setHasSearched(true)
  }

  useEffect(() => {
    onVisibilityFilterChange(visibility)
  }, [visibility, onVisibilityFilterChange])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sticky Header / Search Toolbar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--surface)',
        padding: '1.5rem',
        borderBottom: '1px solid var(--border)'
      }}>
        <h2 style={{ margin: '0 0 1rem 0' }}>{t.nav.search}</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <form style={{ flex: '1 1 300px' }} onSubmit={handleSearch}>
            <SearchInput
              value={draftSearch}
              label={t.sessions.searchLabel}
              placeholder={t.sessions.searchPlaceholder}
              onChange={setDraftSearch}
            />
            <button type="submit" style={{ display: 'none' }}>Search</button>
          </form>
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
            {/* Filter chips */}
            <button
              className={`pill ${visibility === 'all' ? 'pill-active' : ''}`}
              onClick={() => setVisibility('all')}
              style={{ cursor: 'pointer', background: visibility === 'all' ? 'var(--electric-blue)' : 'var(--surface-raised)', color: visibility === 'all' ? 'white' : 'var(--text-primary)' }}
            >
              {t.sessions.all}
            </button>
            <button
              className={`pill ${visibility === 'public' ? 'pill-active' : ''}`}
              onClick={() => setVisibility('public')}
              style={{ cursor: 'pointer', background: visibility === 'public' ? 'var(--electric-blue)' : 'var(--surface-raised)', color: visibility === 'public' ? 'white' : 'var(--text-primary)' }}
            >
              {t.enums.visibility.public}
            </button>
            <button
              className={`pill ${visibility === 'private' ? 'pill-active' : ''}`}
              onClick={() => setVisibility('private')}
              style={{ cursor: 'pointer', background: visibility === 'private' ? 'var(--electric-blue)' : 'var(--surface-raised)', color: visibility === 'private' ? 'white' : 'var(--text-primary)' }}
            >
              {t.enums.visibility.private}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
        {hasSearched ? (
          <SessionListPanel {...listProps} showControls={false} embedded />
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <p className="subtle">Enter a search query and press Enter to find sessions.</p>
          </div>
        )}
      </div>
    </div>
  )
}
