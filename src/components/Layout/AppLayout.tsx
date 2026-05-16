import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { DashboardHeader } from '../DashboardHeader'
import type { DashboardHeaderProps } from '../DashboardHeader'
import { CreateSessionModal } from '../CreateSession/CreateSessionModal'

interface AppLayoutProps {
  headerProps: DashboardHeaderProps
}

export function AppLayout({ headerProps }: AppLayoutProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <main className="shell dashboard-shell">
      <div className="app-container">
        <DashboardHeader {...headerProps} onCreateClick={() => setShowCreateModal(true)} />
        <section className="layout-content">
          <Outlet />
        </section>
      </div>
      {showCreateModal ? <CreateSessionModal onClose={() => setShowCreateModal(false)} /> : null}
    </main>
  )
}