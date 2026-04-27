import { useState, useRef } from 'react'
import type { MediaType, SessionMedia } from '../../types'

interface MediaUploadProps {
  onUpload: (file: File, mediaType: MediaType, description?: string) => Promise<boolean>
  uploading: boolean
  error: string | null
}

export function MediaUpload({ onUpload, uploading, error }: MediaUploadProps) {
  const [mediaType, setMediaType] = useState<MediaType>('image')
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const acceptMap: Record<MediaType, string> = {
    image: 'image/jpeg,image/png,image/webp',
    book_file: 'application/pdf,application/epub+zip',
  }

  async function handleUpload() {
    if (!selectedFile) return

    const success = await onUpload(selectedFile, mediaType, description)
    if (success) {
      setSelectedFile(null)
      setDescription('')
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  return (
    <div className="stack gap-sm">
      <div className="split">
        <label className="field">
          <span>Media Type</span>
          <select
            value={mediaType}
            onChange={(e) => {
              setMediaType(e.target.value as MediaType)
              setSelectedFile(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
          >
            <option value="image">Image</option>
            <option value="book_file">Book File (PDF/EPUB)</option>
          </select>
        </label>

        <label className="field">
          <span>File</span>
          <input
            ref={inputRef}
            type="file"
            accept={acceptMap[mediaType]}
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <label className="field">
        <span>Description (optional)</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this file"
          maxLength={200}
        />
      </label>

      {error ? <p className="error">{error}</p> : null}

      <button
        type="button"
        className="primary"
        disabled={!selectedFile || uploading}
        onClick={() => { void handleUpload() }}
      >
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
    </div>
  )
}

interface MediaGalleryProps {
  media: SessionMedia[]
  mediaUrls: Record<string, string>
  loading: boolean
  hasMore: boolean
  onLoadMore: () => Promise<void>
  onRemove: (item: SessionMedia) => Promise<boolean>
  currentUserId: string
  sessionOwnerId: string
}

export function MediaGallery({
  media,
  mediaUrls,
  loading,
  hasMore,
  onLoadMore,
  onRemove,
  currentUserId,
  sessionOwnerId,
}: MediaGalleryProps) {
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleRemove(item: SessionMedia) {
    setRemovingId(item.id)
    await onRemove(item)
    setRemovingId(null)
  }

  if (loading && media.length === 0) {
    return <p className="subtle">Loading media…</p>
  }

  if (media.length === 0) {
    return <p className="subtle">No media uploaded yet.</p>
  }

  return (
    <div className="stack">
      <div className="media-grid">
        {media.map((item) => {
          const url = mediaUrls[item.file_path]
          const canDelete = item.uploader_id === currentUserId || sessionOwnerId === currentUserId

          return (
            <div key={item.id} className="media-item">
              {item.media_type === 'image' && url ? (
                <img
                  className="media-thumbnail"
                  src={url}
                  alt={item.description || item.file_name}
                  loading="lazy"
                />
              ) : (
                <div className="media-file-icon">
                  <span className="pill">{item.mime_type.split('/').pop()?.toUpperCase()}</span>
                  <p className="muted media-filename">{item.file_name}</p>
                </div>
              )}

              {item.description ? (
                <p className="muted media-description">{item.description}</p>
              ) : null}

              <div className="media-actions">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="secondary media-download-link"
                  >
                    Open
                  </a>
                ) : null}

                {canDelete ? (
                  <button
                    type="button"
                    className="ghost"
                    disabled={removingId === item.id}
                    onClick={() => { void handleRemove(item) }}
                  >
                    {removingId === item.id ? 'Removing…' : 'Remove'}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {hasMore ? (
        <button
          type="button"
          className="secondary"
          onClick={() => { void onLoadMore() }}
        >
          Load More
        </button>
      ) : null}
    </div>
  )
}
