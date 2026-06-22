import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { usePermissions } from '../hooks/usePermissions'

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { isViewer } = usePermissions()

  useEffect(() => {
    const stored = localStorage.getItem('nm.sidebar.collapsed')
    if (stored === '1') setSidebarCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('nm.sidebar.collapsed', sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 overflow-x-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        isViewer={isViewer}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        onClose={() => setSidebarOpen(false)}
      />
      <div
        className={`flex h-dvh min-h-0 flex-col overflow-hidden transition-[margin] duration-200 ease-out ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}
      >
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6 [scrollbar-gutter:stable]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
