export const MAX_TITLE_LENGTH = 200
export const MAX_DESCRIPTION_LENGTH = 2000
export const MAX_COMMENT_LENGTH = 5000
const MAX_CATEGORY_NAME_LENGTH = 100
const MAX_DISPLAY_NAME_LENGTH = 100

export interface ValidationResult {
  valid: boolean
  error: string | null
}

function ok(): ValidationResult {
  return { valid: true, error: null }
}

function fail(error: string): ValidationResult {
  return { valid: false, error }
}

export function validateText(
  value: string,
  fieldName: string,
  maxLength: number,
  required = true,
): ValidationResult {
  const trimmed = value.trim()

  if (required && trimmed.length === 0) {
    return fail(`${fieldName} is required`)
  }

  if (trimmed.length > maxLength) {
    return fail(`${fieldName} must be ${maxLength} characters or fewer`)
  }

  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
    return fail(`${fieldName} contains invalid characters`)
  }

  return ok()
}

export function validateBookTitle(value: string): ValidationResult {
  return validateText(value, 'Book title', MAX_TITLE_LENGTH)
}

export function validateBookAuthor(value: string): ValidationResult {
  return validateText(value, 'Author', MAX_TITLE_LENGTH)
}

export function validateDescription(value: string): ValidationResult {
  return validateText(value, 'Description', MAX_DESCRIPTION_LENGTH, false)
}

export function validateComment(value: string): ValidationResult {
  return validateText(value, 'Comment', MAX_COMMENT_LENGTH)
}

export function validateCategoryName(value: string): ValidationResult {
  return validateText(value, 'Category name', MAX_CATEGORY_NAME_LENGTH)
}

export function validateDisplayName(value: string): ValidationResult {
  return validateText(value, 'Display name', MAX_DISPLAY_NAME_LENGTH, false)
}

export const MIN_PASSWORD_LENGTH = 8

export function validatePassword(value: string): ValidationResult {
  if (value.length < MIN_PASSWORD_LENGTH) {
    return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  if (!/[A-Z]/.test(value)) {
    return fail('Password must include at least one uppercase letter.')
  }
  if (!/[a-z]/.test(value)) {
    return fail('Password must include at least one lowercase letter.')
  }
  if (!/[0-9]/.test(value)) {
    return fail('Password must include at least one number.')
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return fail('Password must include at least one symbol.')
  }
  return ok()
}

export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) {
    return fail('Email is required.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return fail('Enter a valid email address.')
  }
  return ok()
}

const VALID_VISIBILITIES = ['public', 'private'] as const
const VALID_JOIN_POLICIES = ['open', 'request'] as const
const VALID_MEDIA_TYPES = ['image', 'book_file'] as const
const VALID_CATEGORY_ROLES = ['owner', 'moderator', 'member'] as const

export function validateEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  fieldName: string,
): ValidationResult {
  if (!(allowed as readonly string[]).includes(value)) {
    return fail(`Invalid ${fieldName}: "${value}". Allowed: ${allowed.join(', ')}`)
  }
  return ok()
}

export function validateVisibility(value: string): ValidationResult {
  return validateEnum(value, VALID_VISIBILITIES, 'visibility')
}

export function validateJoinPolicy(value: string): ValidationResult {
  return validateEnum(value, VALID_JOIN_POLICIES, 'join policy')
}

export function validateMediaType(value: string): ValidationResult {
  return validateEnum(value, VALID_MEDIA_TYPES, 'media type')
}

export function validateCategoryRole(value: string): ValidationResult {
  return validateEnum(value, VALID_CATEGORY_ROLES, 'category role')
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_BOOK_TYPES = ['application/pdf', 'application/epub+zip']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_BOOK_BYTES = 50 * 1024 * 1024

export async function readFileHeader(file: File, length = 16): Promise<Uint8Array> {
  const buffer = await file.slice(0, length).arrayBuffer()
  return new Uint8Array(buffer)
}

export function sniffMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 4
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (
    bytes.length >= 4
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
  ) {
    return 'application/pdf'
  }
  if (
    bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && (bytes[2] === 0x03 || bytes[2] === 0x05)
    && (bytes[3] === 0x04 || bytes[3] === 0x06)
  ) {
    return 'application/epub+zip'
  }
  return null
}

export async function detectFileMime(file: File): Promise<string | null> {
  const header = await readFileHeader(file)
  return sniffMimeFromBytes(header)
}

export function validateImageFile(file: File): ValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return fail(`Invalid image type: ${file.type}. Allowed: JPG, PNG, WebP`)
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return fail(`Image too large. Maximum: ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`)
  }
  return ok()
}

export function validateBookFile(file: File): ValidationResult {
  if (!ALLOWED_BOOK_TYPES.includes(file.type)) {
    return fail(`Invalid book file type: ${file.type}. Allowed: PDF, EPUB`)
  }
  if (file.size > MAX_BOOK_BYTES) {
    return fail(`Book file too large. Maximum: ${MAX_BOOK_BYTES / (1024 * 1024)} MB`)
  }
  return ok()
}

export function validateMediaFile(file: File, mediaType: 'image' | 'book_file'): ValidationResult {
  return mediaType === 'image' ? validateImageFile(file) : validateBookFile(file)
}

export async function validateMediaFileAsync(
  file: File,
  mediaType: 'image' | 'book_file',
): Promise<ValidationResult & { detectedMime: string | null }> {
  const basic = validateMediaFile(file, mediaType)
  if (!basic.valid) {
    return { ...basic, detectedMime: null }
  }

  const detected = await detectFileMime(file)
  if (!detected) {
    return { valid: false, error: 'Could not verify file type from file contents', detectedMime: null }
  }

  const allowed = mediaType === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_BOOK_TYPES
  if (!allowed.includes(detected)) {
    return {
      valid: false,
      error: `File content is not a permitted ${mediaType === 'image' ? 'image' : 'book file'} format`,
      detectedMime: detected,
    }
  }

  if (detected !== file.type) {
    return {
      valid: false,
      error: 'File content does not match the declared file type',
      detectedMime: detected,
    }
  }

  return { valid: true, error: null, detectedMime: detected }
}

export function validateChapterNumber(value: number, totalChapters: number): ValidationResult {
  if (!Number.isInteger(value) || value < 1) {
    return fail('Chapter must be a positive integer')
  }
  if (value > totalChapters) {
    return fail(`Chapter must be ${totalChapters} or fewer`)
  }
  return ok()
}

export function validateTotalChapters(value: number): ValidationResult {
  if (!Number.isInteger(value) || value < 1) {
    return fail('Total chapters must be a positive integer')
  }
  if (value > 10000) {
    return fail('Total chapters must be 10,000 or fewer')
  }
  return ok()
}
