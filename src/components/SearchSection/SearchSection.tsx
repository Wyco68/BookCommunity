import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import { SessionListPanel } from '../SessionListPanel'
import type { SessionListPanelProps } from '../SessionListPanel'
import { SearchInput } from './SearchInput'
import { CreateSectionButton } from './CreateSectionButton'
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
  sessionForm,
  creatingSession,
  onSessionFormChange,
  onCreateSession,
}: SearchSectionProps) {
  const [draftSearch, setDraftSearch] = useState(listProps.sessionSearch)
  const [panelMode, setPanelMode] = useState<'search' | 'create'>('search')

  useEffect(() => {
    setDraftSearch(listProps.sessionSearch)
  }, [listProps.sessionSearch])

  return (
    <section className="stack">
      <article className="card stack">
        <div>
          <h2>Search & Create</h2>
          <p className="subtle">Find sections quickly or create a new one.</p>
        </div>

        <div className="auth-switch" role="tablist" aria-label="Search and create views">
          <button
            type="button"
            className={`auth-switch-option ${panelMode === 'search' ? 'auth-switch-option-active' : ''}`}
            onClick={() => setPanelMode('search')}
          >
            Search
          </button>
          <button
            type="button"
            className={`auth-switch-option ${panelMode === 'create' ? 'auth-switch-option-active' : ''}`}
            onClick={() => setPanelMode('create')}
          >
            Create
          </button>
        </div>

        {panelMode === 'search' ? (
          <form
            className="search-toolbar"
            onSubmit={(event) => {
              event.preventDefault()
              listProps.onSessionSearchChange(draftSearch)
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
        ) : (
          <form
            className="stack"
            onSubmit={(event) => {
              void onCreateSession(event)
            }}
          >
            <label className="field">
              <span>{t.sessionForm.bookTitle}</span>
              <input
                type="text"
                value={sessionForm.bookTitle}
                onChange={(event) => onSessionFormChange({ ...sessionForm, bookTitle: event.target.value })}
                placeholder={t.sessionForm.bookTitlePlaceholder}
              />
            </label>

            <label className="field">
              <span>{t.sessionForm.author}</span>
              <input
                type="text"
                value={sessionForm.bookAuthor}
                onChange={(event) => onSessionFormChange({ ...sessionForm, bookAuthor: event.target.value })}
                placeholder={t.sessionForm.authorPlaceholder}
              />
            </label>

            <label className="field">
              <span>{t.sessionForm.totalChapters}</span>
              <input
                type="number"
                min={1}
                max={999}
                value={sessionForm.totalChapters}
                onChange={(event) =>
                  onSessionFormChange({
                    ...sessionForm,
                    totalChapters: Number.isNaN(Number(event.target.value)) ? 1 : Number(event.target.value),
                  })
                }
              />
            </label>

            <label className="field">
              <span>{t.sessionForm.description}</span>
              <textarea
                value={sessionForm.description}
                onChange={(event) => onSessionFormChange({ ...sessionForm, description: event.target.value })}
                placeholder={t.sessionForm.descriptionPlaceholder}
              />
            </label>

            <div className="split">
              <label className="field">
                <span>{t.sessionForm.visibility}</span>
                <select
                  value={sessionForm.visibility}
                  onChange={(event) =>
                    onSessionFormChange({
                      ...sessionForm,
                      visibility: event.target.value as 'public' | 'private',
                    })
                  }
                >
                  <option value="public">{t.sessionForm.public}</option>
                  <option value="private">{t.sessionForm.private}</option>
                </select>
              </label>

              <label className="field">
                <span>{t.sessionForm.joinPolicy}</span>
                <select
                  value={sessionForm.joinPolicy}
                  onChange={(event) =>
                    onSessionFormChange({
                      ...sessionForm,
                      joinPolicy: event.target.value as 'open' | 'request',
                    })
                  }
                >
                  <option value="open">{t.sessionForm.openJoin}</option>
                  <option value="request">{t.sessionForm.requestRequired}</option>
                </select>
              </label>
            </div>

            <CreateSectionButton
              creatingSession={creatingSession}
              creatingLabel={t.sessionForm.creating}
              createLabel={t.sessionForm.createSession}
            />
          </form>
        )}
      </article>

      <article className="card stack">
        <h3>Search Results</h3>
        <SessionListPanel {...listProps} showControls={false} />
      </article>
    </section>
  )
}
