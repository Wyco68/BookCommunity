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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
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
        if (data) setCategories(data as Category[])
      })
  }, [])

  const toggleCategory = useCallback((catId: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId],
    )
  }, [])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!author.trim()) {
      setError('Author is required')
      return
    }

    const totalChapters = chapters === '' ? null : Number(chapters)
    if (totalChapters !== null && (totalChapters < 1 || !Number.isInteger(totalChapters))) {
      setError('Chapters must be a positive integer or left empty')
      return
    }

    if (selectedCategoryIds.length < 1) {
      setError('Select at least one category')
      return
    }

    if (coverFile) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(coverFile.type)) {
        setError('Cover image must be JPG, PNG, or WebP')
        return
      }
      if (coverFile.size > 10 * 1024 * 1024) {
        setError('Cover image must be under 10MB')
        return
      }
    }
    setCreating(true)

    const rpcPayloads = [
      {
        p_book_title: title.trim(),
        p_book_author: author.trim(),
        p_total_chapters: totalChapters ?? 12,
        p_description: description.trim() || null,
        p_visibility: visibility,
        p_join_policy: joinPolicy,
        p_category_ids: selectedCategoryIds,
      },
      {
        p_book_title: title.trim(),
        p_book_author: author.trim(),
        p_total_chapters: totalChapters ?? 12,
        p_description: description.trim() || null,
        p_visibility: visibility,
        p_join_policy: joinPolicy,
      },
      {
        p_book_title: title.trim(),
        p_book_author: author.trim(),
        p_total_chapters: totalChapters ?? 12,
        p_visibility: visibility,
        p_join_policy: joinPolicy,
        p_category_ids: selectedCategoryIds,
      },
    ] as const

    let createResult = await supabase.rpc('create_reading_session', rpcPayloads[0])
    let usedFallbackWithoutCategories = false
    if (createResult.error?.message?.includes('Could not find the function')) {
      createResult = await supabase.rpc('create_reading_session', rpcPayloads[1])
      usedFallbackWithoutCategories = !createResult.error
    }
    if (createResult.error?.message?.includes('Could not find the function')) {
      createResult = await supabase.rpc('create_reading_session', rpcPayloads[2])
    }

    if (createResult.error) {
      setError(createResult.error.message)
      setCreating(false)
      return
    }

    const session = createResult.data as ReadingSession

    if (usedFallbackWithoutCategories && selectedCategoryIds.length > 0) {
      const categoriesInsert = await supabase.from('session_categories').upsert(
        selectedCategoryIds.map((categoryId) => ({
          session_id: session.id,
          category_id: categoryId,
        })),
        { onConflict: 'session_id,category_id' },
      )

      if (categoriesInsert.error) {
        setError(categoriesInsert.error.message)
        setCreating(false)
        return
      }
    }

    // Optional cover upload (separate from chapter media)
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) {
      setError('You must be signed in')
      setCreating(false)
      return
    }
    if (coverFile) {
      const ext = coverFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const coverPath = `${userId}/${session.id}/cover.${ext}`
      const coverUpload = await supabase.storage
        .from('session-covers')
        .upload(coverPath, coverFile, { upsert: true, contentType: coverFile.type })

      if (coverUpload.error) {
        setError(coverUpload.error.message)
        setCreating(false)
        return
      }

      const coverUpdate = await supabase
        .from('reading_sessions')
        .update({ cover_image_path: coverPath })
        .eq('id', session.id)

      if (coverUpdate.error) {
        setError(coverUpdate.error.message)
        setCreating(false)
        return
      }
    }

    setCreating(false)
    onClose()
    navigate(`/session/${session.id}`)
  }, [title, author, chapters, description, visibility, joinPolicy, selectedCategoryIds, coverFile, navigate, onClose])

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
              <span className="field-label">Categories *</span>
              <div className="category-tab-bar">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-tab ${selectedCategoryIds.includes(cat.id) ? 'category-tab-active' : ''}`}
                    onClick={() => toggleCategory(cat.id)}
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
