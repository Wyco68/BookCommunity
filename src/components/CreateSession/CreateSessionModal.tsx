import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import type { Category, ReadingSession } from '../../types'

const LANGUAGE_STORAGE_KEY = 'bookcom-language'

function getLanguage(): Language {
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (saved === 'de' || saved === 'my') return saved
  return 'en'
}

interface CreateSessionModalProps {
  onClose: () => void
}

export function CreateSessionModal({ onClose }: CreateSessionModalProps) {
  const navigate = useNavigate()
  const t = translations[getLanguage()]
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [chapters, setChapters] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [joinPolicy, setJoinPolicy] = useState<'open' | 'request'>('open')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const cats = data as Category[]
          setCategories(cats)
          const action = cats.find((c) => c.name === 'Action') ?? cats[0]
          setSelectedCategoryId(action.id)
        }
      })
  }, [])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!title.trim()) { setError(t.sessionForm.titleRequired); return }
    if (!author.trim()) { setError(t.sessionForm.authorRequired); return }

    const totalChapters = chapters === '' ? null : Number(chapters)
    if (totalChapters !== null && (totalChapters < 1 || !Number.isInteger(totalChapters))) {
      setError(t.sessionForm.chaptersPositiveInt)
      return
    }
    if (selectedCategoryId === null) { setError(t.sessionForm.selectCategory); return }
    if (coverFile) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(coverFile.type)) {
        setError(t.sessionForm.coverImageInvalidType)
        return
      }
      if (coverFile.size > 10 * 1024 * 1024) { setError(t.sessionForm.coverImageTooLarge); return }
    }

    setCreating(true)

    const { data: sessionData, error: sessionError } = await supabase.rpc(
      'create_reading_session',
      {
        p_book_title:     title.trim(),
        p_book_author:    author.trim(),
        p_total_chapters: totalChapters ?? 12,
        p_visibility:     visibility,
        p_join_policy:    joinPolicy,
        p_category_id:    selectedCategoryId,
        p_description:    description.trim() || null,
      },
    )

    if (sessionError) {
      setError(sessionError.message)
      setCreating(false)
      return
    }

    const session = sessionData as ReadingSession

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) { setError(t.sessionForm.mustBeSignedIn); setCreating(false); return }

    if (coverFile) {
      const ext = coverFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const coverPath = `${userId}/${session.id}/cover.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('session-covers')
        .upload(coverPath, coverFile, { upsert: true, contentType: coverFile.type })

      if (uploadError) { setError(uploadError.message); setCreating(false); return }

      const { error: updateError } = await supabase
        .from('reading_sessions')
        .update({ cover_image_path: coverPath })
        .eq('id', session.id)

      if (updateError) { setError(updateError.message); setCreating(false); return }
    }

    setCreating(false)
    onClose()
    navigate(`/session/${session.id}`)
  }, [title, author, chapters, description, visibility, joinPolicy, selectedCategoryId, coverFile, navigate, onClose, t])

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content modal-create-session">
        <div className="modal-header">
          <h2>{t.sessionForm.title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t.nav.closeMenu}>✕</button>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <form className="create-session-form" onSubmit={(e) => { void handleSubmit(e) }}>
          <div className="create-session-row">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.sessionForm.bookTitlePlaceholder}
              aria-label={t.sessionForm.bookTitle}
              required
            />

            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder={t.sessionForm.authorPlaceholder}
              aria-label={t.sessionForm.author}
              required
            />
          </div>

          <div className="create-session-row">
            <input
              type="number"
              min={1}
              value={chapters}
              onChange={(e) => setChapters(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={t.sessionForm.totalChaptersPlaceholder}
              aria-label={t.sessionForm.totalChapters}
            />

            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
              aria-label={t.sessionForm.visibility}
            >
              <option value="public">{t.enums.visibility.public}</option>
              <option value="private">{t.enums.visibility.private}</option>
            </select>

            <select
              value={joinPolicy}
              onChange={(e) => setJoinPolicy(e.target.value as 'open' | 'request')}
              aria-label={t.sessionForm.joinPolicy}
            >
              <option value="open">{t.sessionForm.openJoin}</option>
              <option value="request">{t.sessionForm.requestToJoin}</option>
            </select>
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.sessionForm.descriptionPlaceholder}
            aria-label={t.sessionForm.description}
            rows={3}
          />

          {categories.length > 0 ? (
            <div className="field">
              <div className="category-tab-bar">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-tab ${selectedCategoryId === cat.id ? 'category-tab-active' : ''}`}
                    onClick={() => setSelectedCategoryId(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="field">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
              aria-label={t.sessionForm.coverImage}
            />
            <span className="field-hint">{t.sessionForm.coverImageHint}</span>
          </div>

          <div className="create-session-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={creating}>
              {t.common.cancel}
            </button>
            <button type="submit" className="primary" disabled={creating}>
              {creating ? t.sessionForm.creating : t.sessionForm.createSession}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
