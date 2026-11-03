import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Server,
  Layers,
  Globe,
  Cable,
  FileSpreadsheet,
  FileBox,
  Download,
  Printer,
  Settings,
  Building2,
  HardDrive,
  MapPin,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
} from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'

type NavLeaf = {
  kind: 'link'
  id: string
  to: string
  icon: LucideIcon
  label: string
  viewerVisible: boolean
  adminOnly: boolean
}

type NavGroup = {
  kind: 'group'
  id: string
  icon: LucideIcon
  label: string
  viewerVisible: boolean
  adminOnly: boolean
  children: NavLeaf[]
}

type NavEntry = NavLeaf | NavGroup

type AnchorRect = {
  top: number
  left: number
  bottom: number
  right: number
  width: number
  height: number
}

const OPEN_GROUPS_KEY = 'nm.sidebar.openGroups'
const FLYOUT_GAP = 12
const RAIL_W = 'w-[4.5rem]'
const RAIL_W_LG = 'lg:w-[4.5rem]'
const OPEN_W = 'w-60'
const OPEN_W_LG = 'lg:w-60'

const allNavEntries: NavEntry[] = [
  {
    kind: 'link',
    id: 'projects',
    to: '/projects',
    icon: Building2,
    label: 'Proyectos',
    viewerVisible: false,
    adminOnly: true,
  },
  {
    kind: 'link',
    id: 'dashboard',
    to: '/',
    icon: LayoutDashboard,
    label: 'Panel',
    viewerVisible: true,
    adminOnly: false,
  },
  {
    kind: 'group',
    id: 'infraestructura',
    icon: HardDrive,
    label: 'Infraestructura',
    viewerVisible: true,
    adminOnly: false,
    children: [
      {
        kind: 'link',
        id: 'connection-diagram',
        to: '/connection-diagram',
        icon: Cable,
        label: 'Diagrama de conexión',
        viewerVisible: true,
        adminOnly: false,
      },
      {
        kind: 'link',
        id: 'sites',
        to: '/settings/sites',
        icon: MapPin,
        label: 'Sitios y áreas',
        viewerVisible: true,
        adminOnly: false,
      },
      {
        kind: 'link',
        id: 'containers',
        to: '/containers',
        icon: HardDrive,
        label: 'Contenedores',
        viewerVisible: true,
        adminOnly: false,
      },
      {
        kind: 'link',
        id: 'devices',
        to: '/devices',
        icon: Server,
        label: 'Dispositivos',
        viewerVisible: true,
        adminOnly: false,
      },
    ],
  },
  {
    kind: 'group',
    id: 'capa-red',
    icon: Globe,
    label: 'Capa de Red',
    viewerVisible: true,
    adminOnly: false,
    children: [
      {
        kind: 'link',
        id: 'networks',
        to: '/networks',
        icon: Globe,
        label: 'Redes',
        viewerVisible: true,
        adminOnly: false,
      },
      {
        kind: 'link',
        id: 'vlans',
        to: '/vlans',
        icon: Layers,
        label: 'VLANs',
        viewerVisible: true,
        adminOnly: false,
      },
    ],
  },
  {
    kind: 'group',
    id: 'exportar',
    icon: Download,
    label: 'Exportar',
    viewerVisible: true,
    adminOnly: false,
    children: [
      {
        kind: 'link',
        id: 'export-inventory',
        to: '/export/inventory',
        icon: Layers,
        label: 'Inventario por modelo',
        viewerVisible: true,
        adminOnly: false,
      },
      {
        kind: 'link',
        id: 'connection-sheets',
        to: '/connection-sheets',
        icon: FileSpreadsheet,
        label: 'Exportar conexiones',
        viewerVisible: true,
        adminOnly: false,
      },
      {
        kind: 'link',
        id: 'export-dxf',
        to: '/export/dxf',
        icon: FileBox,
        label: 'Exportar a DXF',
        viewerVisible: true,
        adminOnly: false,
      },
    ],
  },
  {
    kind: 'link',
    id: 'print',
    to: '/print',
    icon: Printer,
    label: 'Imprimir',
    viewerVisible: true,
    adminOnly: false,
  },
]

function pathMatches(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function filterVisible(
  entries: NavEntry[],
  isGlobalAdmin: boolean,
  isViewer: boolean
): NavEntry[] {
  return entries
    .filter((entry) => {
      if (entry.adminOnly && !isGlobalAdmin) return false
      if (isViewer && !entry.viewerVisible) return false
      return true
    })
    .map((entry) => {
      if (entry.kind !== 'group') return entry
      return {
        ...entry,
        children: entry.children.filter((child) => {
          if (child.adminOnly && !isGlobalAdmin) return false
          if (isViewer && !child.viewerVisible) return false
          return true
        }),
      }
    })
    .filter((entry) => entry.kind !== 'group' || entry.children.length > 0)
}

function linkClassName(isActive: boolean, isCollapsed: boolean, nested = false): string {
  const base = `flex items-center min-w-0 max-w-full ${
    isCollapsed ? 'justify-center px-0' : nested ? 'gap-3 pl-10 pr-3' : 'gap-3 px-3'
  } py-2.5 rounded-xl text-sm font-medium transition-colors`
  if (isActive) {
    return `${base} ${
      isCollapsed
        ? 'bg-blue-600/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20'
        : 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
    }`
  }
  return `${base} ${
    isCollapsed
      ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200'
  }`
}

function readOpenGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(OPEN_GROUPS_KEY)
    if (!raw) return { infraestructura: true, exportar: true, 'capa-red': true }
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return { infraestructura: true, exportar: true, 'capa-red': true, ...parsed }
  } catch {
    return { infraestructura: true, exportar: true, 'capa-red': true }
  }
}

function measureAnchor(el: HTMLElement | null): AnchorRect | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    top: r.top,
    left: r.left,
    bottom: r.bottom,
    right: r.right,
    width: r.width,
    height: r.height,
  }
}

function FixedTooltip({
  anchor,
  children,
}: {
  anchor: AnchorRect
  children: ReactNode
}) {
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[80] max-w-48 truncate whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg ring-1 ring-white/10"
      style={{
        top: anchor.top + anchor.height / 2,
        left: anchor.right + FLYOUT_GAP,
        transform: 'translateY(-50%)',
      }}
    >
      {children}
    </div>,
    document.body
  )
}

interface SidebarProps {
  isOpen: boolean
  isCollapsed: boolean
  isViewer: boolean
  appVersion: string | null
  onOpenReleaseHistory: () => void
  onToggleCollapsed: () => void
  onClose: () => void
}

export function Sidebar({
  isOpen,
  isCollapsed,
  isViewer,
  appVersion,
  onOpenReleaseHistory,
  onToggleCollapsed,
  onClose,
}: SidebarProps) {
  const { isGlobalAdmin } = usePermissions()
  const location = useLocation()
  const navEntries = filterVisible(allNavEntries, isGlobalAdmin, isViewer)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(readOpenGroups)
  const [openFlyoutId, setOpenFlyoutId] = useState<string | null>(null)
  const [flyoutAnchor, setFlyoutAnchor] = useState<AnchorRect | null>(null)
  const [hoveredTip, setHoveredTip] = useState<{ id: string; label: string; anchor: AnchorRect } | null>(
    null
  )
  const flyoutRef = useRef<HTMLDivElement | null>(null)
  const flyoutTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const flyoutCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearFlyoutCloseTimer = () => {
    if (flyoutCloseTimer.current) {
      clearTimeout(flyoutCloseTimer.current)
      flyoutCloseTimer.current = null
    }
  }

  const closeFlyout = () => {
    clearFlyoutCloseTimer()
    setOpenFlyoutId(null)
    setFlyoutAnchor(null)
  }

  const scheduleFlyoutClose = () => {
    clearFlyoutCloseTimer()
    flyoutCloseTimer.current = setTimeout(() => {
      setOpenFlyoutId(null)
      setFlyoutAnchor(null)
      flyoutCloseTimer.current = null
    }, 140)
  }

  useEffect(() => {
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(openGroups))
  }, [openGroups])

  useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false
      const next = { ...prev }
      for (const entry of allNavEntries) {
        if (entry.kind !== 'group') continue
        const active = entry.children.some((c) => pathMatches(location.pathname, c.to))
        if (active && !next[entry.id]) {
          next[entry.id] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [location.pathname])

  useEffect(() => {
    closeFlyout()
    setHoveredTip(null)
  }, [isCollapsed, location.pathname])

  useEffect(() => {
    return () => clearFlyoutCloseTimer()
  }, [])

  useEffect(() => {
    if (!openFlyoutId) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (flyoutRef.current?.contains(target)) return
      const trigger = flyoutTriggerRefs.current[openFlyoutId]
      if (trigger?.contains(target)) return
      closeFlyout()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeFlyout()
    }

    const refreshAnchor = () => {
      const trigger = flyoutTriggerRefs.current[openFlyoutId]
      setFlyoutAnchor(measureAnchor(trigger))
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', refreshAnchor)
    window.addEventListener('scroll', refreshAnchor, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', refreshAnchor)
      window.removeEventListener('scroll', refreshAnchor, true)
    }
  }, [openFlyoutId])

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const collapseButtonLabel = isCollapsed ? 'Expandir barra' : 'Contraer barra'

  const showTip = (id: string, label: string, el: HTMLElement | null) => {
    if (!isCollapsed) return
    const anchor = measureAnchor(el)
    if (!anchor) return
    setHoveredTip({ id, label, anchor })
  }

  const hideTip = (id: string) => {
    setHoveredTip((prev) => (prev?.id === id ? null : prev))
  }

  const openGroupFlyout = (groupId: string, el: HTMLElement | null) => {
    const anchor = measureAnchor(el)
    if (!anchor) return
    clearFlyoutCloseTimer()
    setHoveredTip(null)
    if (openFlyoutId === groupId) {
      closeFlyout()
      return
    }
    setOpenFlyoutId(groupId)
    setFlyoutAnchor(anchor)
  }

  const previewGroupFlyout = (groupId: string, el: HTMLElement | null) => {
    const anchor = measureAnchor(el)
    if (!anchor) return
    clearFlyoutCloseTimer()
    setHoveredTip(null)
    setOpenFlyoutId(groupId)
    setFlyoutAnchor(anchor)
  }

  const renderLeaf = (item: NavLeaf, nested = false) => (
    <NavLink
      key={item.id}
      to={item.to}
      end={item.to === '/'}
      onClick={onClose}
      onMouseEnter={(e) => showTip(item.id, item.label, e.currentTarget)}
      onMouseLeave={() => hideTip(item.id)}
      onFocus={(e) => showTip(item.id, item.label, e.currentTarget)}
      onBlur={() => hideTip(item.id)}
      className={({ isActive }) => linkClassName(isActive, isCollapsed, nested)}
    >
      <item.icon className="w-5 h-5 flex-shrink-0" />
      {!isCollapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )

  const openFlyoutGroup =
    openFlyoutId && isCollapsed
      ? (navEntries.find((e) => e.kind === 'group' && e.id === openFlyoutId) as NavGroup | undefined)
      : undefined

  const renderGroup = (group: NavGroup) => {
    const groupActive = group.children.some((c) => pathMatches(location.pathname, c.to))
    const isOpenGroup = openGroups[group.id] ?? true
    const isFlyoutOpen = openFlyoutId === group.id

    if (isCollapsed) {
      return (
        <div key={group.id} className="w-full max-w-full">
          <button
            type="button"
            ref={(el) => {
              flyoutTriggerRefs.current[group.id] = el
            }}
            onClick={(e) => openGroupFlyout(group.id, e.currentTarget)}
            onMouseEnter={(e) => previewGroupFlyout(group.id, e.currentTarget)}
            onMouseLeave={scheduleFlyoutClose}
            aria-expanded={isFlyoutOpen}
            aria-haspopup="menu"
            aria-label={group.label}
            className={`flex w-full max-w-full items-center justify-center py-2.5 rounded-xl text-sm font-medium transition-colors ${
              groupActive || isFlyoutOpen
                ? 'bg-blue-600/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <group.icon className="w-5 h-5 flex-shrink-0" />
          </button>
        </div>
      )
    }

    return (
      <div key={group.id} className="space-y-0.5">
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          aria-expanded={isOpenGroup}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            groupActive
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <group.icon className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1 text-left truncate">{group.label}</span>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
              isOpenGroup ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </button>
        {isOpenGroup && (
          <div className="space-y-0.5">{group.children.map((child) => renderLeaf(child, true))}</div>
        )}
      </div>
    )
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 h-full overflow-hidden transform transition-[width,transform] duration-200 ease-out lg:translate-x-0 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? `${RAIL_W} ${RAIL_W_LG}` : `${OPEN_W} ${OPEN_W_LG}`}`}
      >
        <div className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden">
          {/* Header + único control de colapso (desktop) */}
          <div
            className={`flex-shrink-0 border-b border-slate-200 dark:border-slate-800/80 ${
              isCollapsed
                ? 'flex flex-col items-center gap-2 px-1.5 py-3'
                : 'flex h-[5.75rem] items-center gap-1 px-2.5'
            }`}
          >
            {isCollapsed ? (
              <>
                <img
                  src="/favicon.png"
                  alt="InfraRed PX Control"
                  className="h-8 w-8 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/10 shadow-sm"
                />
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                  aria-label={collapseButtonLabel}
                  aria-expanded={false}
                  title={collapseButtonLabel}
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <img
                    src="/infrared-px-logo.jpg"
                    alt="InfraRed PX Control"
                    className="h-[4.75rem] w-full object-contain object-left rounded-md ring-1 ring-black/10 dark:ring-white/10 shadow-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className="hidden lg:inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                  aria-label={collapseButtonLabel}
                  aria-expanded={true}
                  title={collapseButtonLabel}
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="lg:hidden p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0"
                  aria-label="Cerrar menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          <nav
            className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain py-3 space-y-1 ${
              isCollapsed ? 'px-1.5' : 'px-3'
            }`}
            aria-label="Navegación principal"
          >
            {navEntries.map((entry) =>
              entry.kind === 'group' ? renderGroup(entry) : renderLeaf(entry)
            )}
          </nav>

          {!isViewer && (
            <div
              className={`flex-shrink-0 border-t border-slate-200 dark:border-slate-800/80 py-3 ${
                isCollapsed ? 'px-1.5' : 'px-3'
              }`}
            >
              <NavLink
                to="/settings"
                onClick={onClose}
                onMouseEnter={(e) => showTip('settings', 'Configuración', e.currentTarget)}
                onMouseLeave={() => hideTip('settings')}
                onFocus={(e) => showTip('settings', 'Configuración', e.currentTarget)}
                onBlur={() => hideTip('settings')}
                className={({ isActive }) => linkClassName(isActive, isCollapsed)}
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="truncate">Configuración</span>}
              </NavLink>
            </div>
          )}

          <div
            className={`flex-shrink-0 ${isViewer ? 'mt-auto border-t border-slate-200 dark:border-slate-800/80 pt-3' : ''} ${
              isCollapsed ? 'px-1.5 pb-3' : 'px-3 pb-3'
            }`}
          >
            <button
              type="button"
              onClick={onOpenReleaseHistory}
              disabled={!appVersion}
              onMouseEnter={(e) =>
                appVersion && showTip('version', `Versión ${appVersion}`, e.currentTarget)
              }
              onMouseLeave={() => hideTip('version')}
              onFocus={(e) =>
                appVersion && showTip('version', `Versión ${appVersion}`, e.currentTarget)
              }
              onBlur={() => hideTip('version')}
              title={appVersion ? `Versión ${appVersion}` : 'Versión'}
              className={`flex w-full max-w-full min-w-0 items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-800 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-slate-500 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-400 ${
                isCollapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'
              }`}
            >
              <span className="text-xs font-medium truncate max-w-full">
                {appVersion ? `v${appVersion}` : 'v—'}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {isCollapsed && hoveredTip && !openFlyoutGroup && (
        <FixedTooltip anchor={hoveredTip.anchor}>{hoveredTip.label}</FixedTooltip>
      )}

      {openFlyoutGroup && flyoutAnchor &&
        createPortal(
          <div
            ref={flyoutRef}
            role="menu"
            aria-label={openFlyoutGroup.label}
            className="fixed z-[80] min-w-44 rounded-xl bg-slate-900 text-white text-xs py-2 shadow-lg ring-1 ring-white/10"
            style={{
              top: Math.max(8, Math.min(flyoutAnchor.top, window.innerHeight - 120)),
              left: flyoutAnchor.right + FLYOUT_GAP,
              maxHeight: 'min(24rem, calc(100vh - 24px))',
              overflowY: 'auto',
            }}
            onMouseEnter={clearFlyoutCloseTimer}
            onMouseLeave={scheduleFlyoutClose}
          >
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {openFlyoutGroup.label}
            </p>
            {openFlyoutGroup.children.map((child) => {
              const active = pathMatches(location.pathname, child.to)
              return (
                <NavLink
                  key={child.id}
                  to={child.to}
                  role="menuitem"
                  onClick={() => {
                    onClose()
                    closeFlyout()
                  }}
                  className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                    active
                      ? 'bg-blue-600/30 text-blue-200'
                      : 'text-slate-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <child.icon className="w-4 h-4 flex-shrink-0" />
                  {child.label}
                </NavLink>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}
