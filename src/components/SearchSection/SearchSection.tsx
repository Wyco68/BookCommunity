import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import { SessionListPanel } from '../SessionListPanel'
import type { SessionListPanelProps } from '../SessionListPanel'
import { SearchInput } from './SearchInput'
import { SearchButton } from './SearchButton'
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
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    setDraftSearch(listProps.sessionSearch)
  }, [listProps.sessionSearch])

  return (
    <section className="stack">
      <article className="card stack">
        <div>
          <h2>Search</h2>
          <p className="subtle">Find reading sessions by title or author.</p>
        </div>

        <form
          className="search-toolbar"
          onSubmit={(event) => {
            event.preventDefault()
            listProps.onSessionSearchChange(draftSearch)
            setHasSearched(true)
          }}
        >
          <SearchInput
            value={draftSearch}
            label={t.sessions.searchLabel}
            placeholder={t.sessions.searchPlaceholder}
            onChange={setDraftSearch}
          />
          <SearchButton label={t.sessions.findSessions} />
        </form>
      </article>

      {hasSearched ? (
        <article className="card stack">
          <h3>Search Results</h3>
          <SessionListPanel {...listProps} showControls={false} />
        </article>
      ) : null}
    </section>
  )
}
