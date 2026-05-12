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
    <section className="page-tight">
      <article className="card page-tight-card">
        <h2>{t.nav.search}</h2>
        <form
          className="search-toolbar page-tight-toolbar"
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
        {hasSearched ? (
          <>
            <hr className="page-tight-rule" />
            <h3>{t.sessions.searchResults}</h3>
            <SessionListPanel {...listProps} showControls={false} embedded />
          </>
        ) : null}
      </article>
    </section>
  )
}
