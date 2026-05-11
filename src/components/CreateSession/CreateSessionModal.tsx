import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Category, ReadingSession } from '../../types'

interface CreateSessionModalProps {
  onClose: () => void
}

export function CreateSessionModal({ onClose }: CreateSessionModalProps) {
  const navigate = useNavigate()
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

    if (!title.trim()) { setError('Title is required'); return }
    if (!author.trim()) { setError('Author is required'); return }

    const totalChapters = chapters === '' ? null : Number(chapters)
    if (totalChapters !== null && (totalChapters < 1 || !Number.isInteger(totalChapters))) {
      setError('Chapters must be a positive integer or left empty')
      return
    }
    if (selectedCategoryId === null) { setError('Select a category'); return }
    if (coverFile) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(coverFile.type)) {
        setError('Cover image must be JPG, PNG, or WebP')
        return
      }
      if (coverFile.size > 10 * 1024 * 1024) { setError('Cover image must be under 10MB'); return }
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
    if (!userId) { setError('You must be signed in'); setCreating(false); return }

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
  }, [title, author, chapters, description, visibility, joinPolicy, selectedCategoryId, coverFile, navigate, onClose])

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content modal-create-session">
        <div className="modal-header">
          <h2>Create Reading Session</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <form className="create-session-form" onSubmit={(e) => { void handleSubmit(e) }}>
          <div className="create-session-row">
            <label className="field">
              <span className="field-label">Title *</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Book title"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Author *</span>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author name"
                required
              />
            </label>
          </div>

          <div className="create-session-row">
            <label className="field">
              <span className="field-label">Total Chapters *</span>
              <input
                type="number"
                min={1}
                value={chapters}
                onChange={(e) => setChapters(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 20"
              />
            </label>

            <label className="field">
              <span className="field-label">Visibility</span>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>

            <label className="field">
              <span className="field-label">Join Policy</span>
              <select value={joinPolicy} onChange={(e) => setJoinPolicy(e.target.value as 'open' | 'request')}>
                <option value="open">Open</option>
                <option value="request">Request to Join</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this session about?"
              rows={3}
            />
          </label>

          {categories.length > 0 ? (
            <div className="field">
              <span className="field-label">Category *</span>
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

          <label className="field">
            <span className="field-label">Cover Image</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
            <span className="field-hint">JPG, PNG or WebP · max 10 MB · optional</span>
          </label>

          <div className="create-session-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={creating}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
