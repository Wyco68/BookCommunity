import { en } from './en'
import { my } from './my'

export const translations = {
  en,
  my,
}

export type Language = keyof typeof translations
