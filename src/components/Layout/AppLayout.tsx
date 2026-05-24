import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import type { DashboardHeaderProps } from '../DashboardHeader'
import { DashboardHeader } from '../DashboardHeader'
import { CreateSessionModal } from '../CreateSession/CreateSessionModal'

interface AppLayoutProps {
  headerProps: DashboardHeaderProps
}

export function AppLayout({ headerProps }: AppLayoutProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <>
      <DashboardHeader 
        {...headerProps} 
        onCreateClick={() => setShowCreateModal(true)} 
      />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', width: '100%', minWidth: 0 }}>
        <Outlet />
      </main>
      {showCreateModal ? <CreateSessionModal onClose={() => setShowCreateModal(false)} /> : null}
    </>
  )
}