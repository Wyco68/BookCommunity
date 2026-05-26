import type { ReactElement } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { AppLayout } from '../components/Layout/AppLayout'
import { ErrorBoundary } from '../components/ErrorBoundary'
import type { DashboardHeaderProps } from '../components/DashboardHeader'
import type { ProfileEditProps } from '../components/ProfileEdit/ProfileEdit'
import type { SearchSectionProps } from '../components/SearchSection/SearchSection'
import type { SectionsLayoutProps } from '../components/Sections/SectionsLayout'
import { APP_PATHS } from './paths'
import {
  CategoriesRoutePage,
  NotFoundPage,
  ProfileEditPage,
  SearchSectionPage,
  SectionsAndDetailsPage,
  SessionDetailPage,
} from './lazyPages'

/** Path segment for a nested route (parent has no path). */
function nestPath(absolute: string): string {
  return absolute.startsWith('/') ? absolute.slice(1) : absolute
}

interface AppRouterProps {
  headerProps: DashboardHeaderProps
  profileEditProps: ProfileEditProps
  searchSectionProps: SearchSectionProps
  sectionsAndDetailsProps: SectionsLayoutProps
  userId: string
  onSessionDeleted: (sessionId: string) => void
}

export function buildAuthenticatedBranch({
  headerProps,
  profileEditProps,
  searchSectionProps,
  sectionsAndDetailsProps,
  userId,
  onSessionDeleted,
}: AppRouterProps): ReactElement {
  const homeScreen = (
    <ErrorBoundary>
      <SectionsAndDetailsPage {...sectionsAndDetailsProps} />
    </ErrorBoundary>
  )

  return (
    <Route element={<AppLayout headerProps={headerProps} />}>
      <Route index element={<Navigate to={APP_PATHS.home} replace />} />
      <Route path={nestPath(APP_PATHS.dashboard)} element={homeScreen} />
      <Route path={nestPath(APP_PATHS.home)} element={homeScreen} />
      <Route
        path={nestPath(APP_PATHS.account)}
        element={<ErrorBoundary><ProfileEditPage {...profileEditProps} /></ErrorBoundary>}
      />
      <Route
        path={nestPath(APP_PATHS.profileEdit)}
        element={<Navigate to={APP_PATHS.account} replace />}
      />
      <Route
        path={nestPath(APP_PATHS.search)}
        element={<ErrorBoundary><SearchSectionPage {...searchSectionProps} /></ErrorBoundary>}
      />
      <Route
        path={nestPath(APP_PATHS.categories)}
        element={<ErrorBoundary><CategoriesRoutePage userId={userId} /></ErrorBoundary>}
      />
      <Route
        path={nestPath(APP_PATHS.sessionDetail)}
        element={
          <ErrorBoundary>
            <SessionDetailPage userId={userId} onSessionDeleted={onSessionDeleted} />
          </ErrorBoundary>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  )
}
