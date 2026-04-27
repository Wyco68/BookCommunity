import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/Layout/AppLayout'
import type { DashboardHeaderProps } from '../components/DashboardHeader'
import type { ProfileEditProps } from '../components/ProfileEdit/ProfileEdit'
import type { SearchSectionProps } from '../components/SearchSection/SearchSection'
import type { SectionsLayoutProps } from '../components/Sections/SectionsLayout'
import { ProfileEditPage } from '../pages/ProfileEditPage'
import { SearchSectionPage } from '../pages/SearchSectionPage'
import { SectionsAndDetailsPage } from '../pages/SectionsAndDetailsPage'
import { CategoriesRoutePage } from '../pages/CategoriesRoutePage'
import { APP_PATHS } from './paths'

interface AppRouterProps {
  headerProps: DashboardHeaderProps
  profileEditProps: ProfileEditProps
  searchSectionProps: SearchSectionProps
  sectionsAndDetailsProps: SectionsLayoutProps
  userId: string
}

export function AppRouter({
  headerProps,
  profileEditProps,
  searchSectionProps,
  sectionsAndDetailsProps,
  userId,
}: AppRouterProps) {
  return (
    <Routes>
      <Route element={<AppLayout headerProps={headerProps} />}>
        <Route index element={<Navigate to={APP_PATHS.search} replace />} />
        <Route path={APP_PATHS.profileEdit} element={<ProfileEditPage {...profileEditProps} />} />
        <Route path={APP_PATHS.search} element={<SearchSectionPage {...searchSectionProps} />} />
        <Route path={APP_PATHS.sections} element={<SectionsAndDetailsPage {...sectionsAndDetailsProps} />} />
        <Route path={APP_PATHS.categories} element={<CategoriesRoutePage userId={userId} />} />
      </Route>
      <Route path="*" element={<Navigate to={APP_PATHS.search} replace />} />
    </Routes>
  )
}
