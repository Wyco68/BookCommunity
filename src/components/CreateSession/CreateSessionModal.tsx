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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [mediaFile, setMediaFile] = useState<File | null>(null)
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

  const toggleCategory = useCallback((catId: string) => {
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

    if (mediaFile) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/epub+zip']
      if (!allowedTypes.includes(mediaFile.type)) {
        setError('File must be an image, PDF, or EPUB')
        return
      }
      if (mediaFile.size > 50 * 1024 * 1024) {
        setError('File must be under 50MB')
        return
      }
    }

    setCreating(true)

    const createResult = await supabase.rpc('create_reading_session', {
      p_book_title: title.trim(),
      p_book_author: author.trim(),
      p_total_chapters: totalChapters ?? 12,
      p_description: description.trim() || null,
      p_visibility: visibility,
      p_join_policy: joinPolicy,
    })

    if (createResult.error) {
      setError(createResult.error.message)
      setCreating(false)
      return
    }

    const session = createResult.data as ReadingSession

    // Add owner membership
    await supabase.from('session_members').insert({
      session_id: session.id,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      role: 'owner',
    })

    // Assign categories
    if (selectedCategoryIds.length > 0) {
      await supabase.from('session_categories').insert(
        selectedCategoryIds.map((catId) => ({
          session_id: session.id,
          category_id: catId,
        })),
      )
    }

    // Upload media if provided
    if (mediaFile) {
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (userId) {
        const filePath = `${session.id}/${Date.now()}-${mediaFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('session-media')
          .upload(filePath, mediaFile)

        if (!uploadError) {
          const mediaType = mediaFile.type.startsWith('image/') ? 'image' : 'book_file'
          await supabase.from('session_media').insert({
            session_id: session.id,
            uploader_id: userId,
            media_type: mediaType,
            file_path: filePath,
            file_name: mediaFile.name,
            file_size_bytes: mediaFile.size,
            mime_type: mediaFile.type,
          })
        }
      }
    }

    setCreating(false)
    onClose()
    navigate(`/session/${session.id}`)
  }, [title, author, chapters, description, visibility, joinPolicy, selectedCategoryIds, mediaFile, navigate, onClose])

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create Session</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <form className="stack" onSubmit={(e) => { void handleSubmit(e) }}>
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

          <label className="field">
            <span className="field-label">Chapters</span>
            <input
              type="number"
              min={1}
              value={chapters}
              onChange={(e) => setChapters(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Number of chapters (optional)"
            />
          </label>

          <label className="field">
            <span className="field-label">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this session about?"
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

          {categories.length > 0 ? (
            <div className="field">
              <span className="field-label">Categories</span>
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
            <span className="field-label">Media (image / pdf / ebook)</span>
            <input
              type="file"
              accept="image/*,.pdf,.epub"
              onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <button type="submit" className="primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create Session'}
          </button>
        </form>
      </div>
    </div>
  )
}
