import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { CreateSessionModal } from '../CreateSession/CreateSessionModal'

type Copy = (typeof translations)[Language]

export interface AppShellHeaderProps {
  t: Copy
  language: Language
  myAvatarImage: string | null
  myAvatarLabel: string
  myDisplayName: string
  onLanguageChange: (language: Language) => void
  onSignOut: () => void
  onCreateClick?: () => void
  userId?: string
}

interface AppLayoutProps {
  headerProps: AppShellHeaderProps
}

export function AppLayout({ headerProps }: AppLayoutProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar
        {...headerProps}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        onCreateClick={() => setShowCreateModal(true)}
      />
      <div className="app-shell-main">
        <TopBar
          {...headerProps}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="app-shell-feed">
          <Outlet />
        </main>
      </div>
      {showCreateModal ? <CreateSessionModal onClose={() => setShowCreateModal(false)} /> : null}
    </div>
  )
}
