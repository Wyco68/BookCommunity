import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/Layout/AppLayout'
import { ErrorBoundary } from '../components/ErrorBoundary'
import type { DashboardHeaderProps } from '../components/DashboardHeader'
import type { ProfileEditProps } from '../components/ProfileEdit/ProfileEdit'
import type { SearchSectionProps } from '../components/SearchSection/SearchSection'
import type { SectionsLayoutProps } from '../components/Sections/SectionsLayout'
import { ProfileEditPage } from '../pages/ProfileEditPage'
import { SearchSectionPage } from '../pages/SearchSectionPage'
import { SectionsAndDetailsPage } from '../pages/SectionsAndDetailsPage'
import { CategoriesRoutePage } from '../pages/CategoriesRoutePage'
import { SessionDetailPage } from '../pages/SessionDetailPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { APP_PATHS } from './paths'

interface AppRouterProps {
  headerProps: DashboardHeaderProps
  profileEditProps: ProfileEditProps
  searchSectionProps: SearchSectionProps
  sectionsAndDetailsProps: SectionsLayoutProps
  userId: string
  onSessionDeleted: (sessionId: string) => void
}

export function AppRouter({
  headerProps,
  profileEditProps,
  searchSectionProps,
  sectionsAndDetailsProps,
  userId,
  onSessionDeleted,
}: AppRouterProps) {
  return (
    <Routes>
      <Route element={<AppLayout headerProps={headerProps} />}>
        <Route index element={<Navigate to={APP_PATHS.home} replace />} />
        <Route
          path={APP_PATHS.home}
          element={
            <ErrorBoundary>
              <SectionsAndDetailsPage {...sectionsAndDetailsProps} />
            </ErrorBoundary>
          }
        />
        <Route
          path={APP_PATHS.profileEdit}
          element={<ErrorBoundary><ProfileEditPage {...profileEditProps} /></ErrorBoundary>}
        />
        <Route
          path={APP_PATHS.search}
          element={<ErrorBoundary><SearchSectionPage {...searchSectionProps} /></ErrorBoundary>}
        />
        <Route
          path={APP_PATHS.categories}
          element={<ErrorBoundary><CategoriesRoutePage userId={userId} /></ErrorBoundary>}
        />
        <Route
          path={APP_PATHS.sessionDetail}
          element={
            <ErrorBoundary>
              <SessionDetailPage userId={userId} onSessionDeleted={onSessionDeleted} />
            </ErrorBoundary>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
