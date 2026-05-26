import { describe, expect, it } from 'vitest'
import { validateEmail, validatePassword } from './validation'

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
