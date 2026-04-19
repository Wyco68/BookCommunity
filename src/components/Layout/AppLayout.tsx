import { Outlet } from 'react-router-dom'
import { DashboardHeader } from '../DashboardHeader'
import type { DashboardHeaderProps } from '../DashboardHeader'

interface AppLayoutProps {
  headerProps: DashboardHeaderProps
}

export function AppLayout({ headerProps }: AppLayoutProps) {
  return (
    <main className="shell dashboard-shell">
      <DashboardHeader {...headerProps} />
      <section className="layout-content">
        <Outlet />
      </section>
    </main>
  )
}
