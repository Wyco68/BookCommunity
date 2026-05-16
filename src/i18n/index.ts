import { en } from './en'
import { de } from './de'
import { my } from './my'

export const translations = {
  en,
  de,
  my,
}

export type Language = keyof typeof translations
export type Translation = typeof en
