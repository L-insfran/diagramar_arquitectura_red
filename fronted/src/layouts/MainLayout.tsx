import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ReleaseNotice } from '../components/ReleaseNotice'
import { usePermissions } from '../hooks/usePermissions'
import { releasesService, type ReleaseStatus } from '../services/releases.service'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function MainLayout() {
  const location = useLocation()
  const isFullBleedCanvas = location.pathname === '/connection-diagram'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [release, setRelease] = useState<ReleaseStatus | null>(null)
  const [noticeMode, setNoticeMode] = useState<'unseen' | 'history' | null>(null)
  const [isAcking, setIsAcking] = useState(false)
  const { isViewer } = usePermissions()

  useEffect(() => {
    const stored = localStorage.getItem('nm.sidebar.collapsed')
    if (stored === '1') setSidebarCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('nm.sidebar.collapsed', sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    let cancelled = false
    releasesService
      .status()
      .then((data) => {
        if (cancelled) return
        setRelease(data)
        if (data.unseen.length > 0) setNoticeMode('unseen')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const closeNotice = () => {
    if (noticeMode !== 'unseen') {
      setNoticeMode(null)
      return
    }
    if (isAcking) return
    setIsAcking(true)
    releasesService
      .acknowledge()
      .then((data) => {
        setRelease(data)
        setNoticeMode(null)
      })
      .catch(() => {})
      .finally(() => setIsAcking(false))
  }

  const noticeReleases =
    noticeMode === 'history' ? (release?.history ?? []) : (release?.unseen ?? [])

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 overflow-x-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        isViewer={isViewer}
        appVersion={release?.current?.version ?? null}
        onOpenReleaseHistory={() => {
          if (!release?.history.length) return
          setNoticeMode((current) => (current === 'unseen' ? current : 'history'))
        }}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        onClose={() => setSidebarOpen(false)}
      />
      <ReleaseNotice
        isOpen={noticeMode !== null && noticeReleases.length > 0}
        mode={noticeMode === 'history' ? 'history' : 'unseen'}
        releases={noticeReleases}
        isAcking={isAcking}
        onClose={closeNotice}
      />
      <div
        className={`flex h-dvh min-h-0 flex-col overflow-hidden transition-[margin] duration-200 ease-out ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}
      >
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main
          className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] ${
            isFullBleedCanvas ? 'overflow-hidden p-0' : 'p-4 lg:p-6'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
