import { useState, useRef } from 'react'
import type { MediaType } from '../../types'
import { ConfirmModal } from '../ConfirmModal'

interface MediaUploadProps {
  onUpload: (file: File, mediaType: MediaType, description?: string) => Promise<boolean>
  uploading: boolean
  error: string | null
  nextChapter: number
  totalChapters: number
}

export function MediaUpload({
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
          message={`Upload "${selectedFile?.name}" as Chapter ${nextChapter}?`}
          confirmLabel={`Upload Chapter ${nextChapter}`}
          onConfirm={() => { void handleConfirmUpload() }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}

      <div className="owner-upload-block">
        <div className="owner-upload-header">
          <span className="owner-upload-title">Upload Chapter {nextChapter}</span>
          <span className="owner-upload-progress">{nextChapter - 1} / {totalChapters} uploaded</span>
        </div>

        <div className="owner-upload-row">
          <label className="field">
            <span>Type</span>
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

          <label className="field owner-upload-file-label">
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
            placeholder="Brief description"
            maxLength={200}
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button
          type="button"
          className="primary"
          disabled={!selectedFile || uploading}
          onClick={handleRequestUpload}
        >
          {uploading ? `Uploading Chapter ${nextChapter}…` : `Upload Chapter ${nextChapter}`}
        </button>
      </div>
    </>
  )
}
