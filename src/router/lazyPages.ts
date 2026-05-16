import { lazy } from 'react'

export const ProfileEditPage = lazy(() =>
  import('../pages/ProfileEditPage').then((m) => ({ default: m.ProfileEditPage })),
)
export const SearchSectionPage = lazy(() =>
  import('../pages/SearchSectionPage').then((m) => ({ default: m.SearchSectionPage })),
)
export const SectionsAndDetailsPage = lazy(() =>
  import('../pages/SectionsAndDetailsPage').then((m) => ({ default: m.SectionsAndDetailsPage })),
)
export const CategoriesRoutePage = lazy(() =>
  import('../pages/CategoriesRoutePage').then((m) => ({ default: m.CategoriesRoutePage })),
)
export const SessionDetailPage = lazy(() =>
  import('../pages/SessionDetailPage').then((m) => ({ default: m.SessionDetailPage })),
)
export const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
