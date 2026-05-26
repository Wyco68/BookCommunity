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
