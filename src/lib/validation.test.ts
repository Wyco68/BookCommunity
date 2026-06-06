import { describe, expect, it } from 'vitest'
import { validateEmail, validatePassword, sniffMimeFromBytes } from './validation'

describe('sniffMimeFromBytes', () => {
  it('detects JPEG magic bytes', () => {
    expect(sniffMimeFromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
  })

  it('detects PNG magic bytes', () => {
    expect(sniffMimeFromBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png',
    )
  })

  it('detects PDF magic bytes', () => {
    expect(sniffMimeFromBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe('application/pdf')
  })

  it('returns null for unknown content', () => {
    expect(sniffMimeFromBytes(new Uint8Array([0x00, 0x01, 0x02]))).toBeNull()
  })
})

describe('validatePassword', () => {
  it('accepts a password with upper, lower, number, and symbol', () => {
    expect(validatePassword('Abcdef1!').valid).toBe(true)
  })

  it('rejects missing uppercase', () => {
    expect(validatePassword('abcdef1!').valid).toBe(false)
  })

  it('rejects missing lowercase', () => {
    expect(validatePassword('ABCDEF1!').valid).toBe(false)
  })

  it('rejects missing number', () => {
    expect(validatePassword('Abcdefg!').valid).toBe(false)
  })

  it('rejects missing symbol', () => {
    expect(validatePassword('Abcdef12').valid).toBe(false)
  })
})

describe('validateEmail', () => {
  it('accepts a valid email', () => {
    expect(validateEmail('user@example.com').valid).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(validateEmail('not-an-email').valid).toBe(false)
  })
})
