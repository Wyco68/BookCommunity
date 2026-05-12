import { useState, useRef } from 'react'
import type { MediaType } from '../../types'
import { ConfirmModal } from '../ConfirmModal'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'

type Copy = (typeof translations)[Language]

interface MediaUploadProps {
  t: Copy
  onUpload: (file: File, mediaType: MediaType, description?: string) => Promise<boolean>
  uploading: boolean
  error: string | null
  nextChapter: number
  totalChapters: number
}

export function MediaUpload({
  t,
  onUpload,
  uploading,
  error,
  nextChapter,
  totalChapters,
}: MediaUploadProps) {
  const [mediaType, setMediaType] = useState<MediaType>('image')
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [confirming, setConfirming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const acceptMap: Record<MediaType, string> = {
    image: 'image/jpeg,image/png,image/webp',
    book_file: 'application/pdf,application/epub+zip',
  }

  function handleRequestUpload() {
    if (!selectedFile) return
    setConfirming(true)
  }

  async function handleConfirmUpload() {
    if (!selectedFile) return
    setConfirming(false)
    const success = await onUpload(selectedFile, mediaType, description)
    if (success) {
      setSelectedFile(null)
      setDescription('')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      {confirming ? (
        <ConfirmModal
          message={t.media.confirmUpload(selectedFile?.name ?? '', nextChapter)}
          confirmLabel={t.media.uploadChapter(nextChapter)}
          cancelLabel={t.common.cancel}
          onConfirm={() => { void handleConfirmUpload() }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}

      <div className="owner-upload-block">
        <div className="owner-upload-header">
          <span className="owner-upload-title">{t.media.uploadChapter(nextChapter)}</span>
          <span className="owner-upload-progress">{t.media.uploadProgress(nextChapter - 1, totalChapters)}</span>
        </div>

        <div className="owner-upload-row">
          <select
            value={mediaType}
            onChange={(e) => {
              setMediaType(e.target.value as MediaType)
              setSelectedFile(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            aria-label={t.media.type}
          >
            <option value="image">{t.media.typeImage}</option>
            <option value="book_file">{t.media.typeBookFile}</option>
          </select>

          <input
            ref={inputRef}
            type="file"
            accept={acceptMap[mediaType]}
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            aria-label={t.media.file}
          />
        </div>

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.media.descriptionPlaceholder}
          aria-label={t.media.descriptionOptional}
          maxLength={200}
        />

        {error ? <p className="error">{error}</p> : null}

        <button
          type="button"
          className="primary"
          disabled={!selectedFile || uploading}
          onClick={handleRequestUpload}
        >
          {uploading ? t.media.uploading(nextChapter) : t.media.uploadChapter(nextChapter)}
        </button>
      </div>
    </>
  )
}
