import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Server,
  Layers,
  Globe,
  GitBranch,
  Settings,
  Network,
  Building2,
  HardDrive,
  X,
  ChevronLeft,
  ChevronRight,
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

const OPEN_GROUPS_KEY = 'nm.sidebar.openGroups'

const allNavEntries: NavEntry[] = [
  {
    kind: 'link',
    id: 'dashboard',
    to: '/',
    icon: LayoutDashboard,
    label: 'Dashboard',
    viewerVisible: true,
    adminOnly: false,
  },
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
    kind: 'group',
    id: 'infraestructura',
    icon: HardDrive,
    label: 'Infraestructura',
    viewerVisible: true,
    adminOnly: false,
    children: [
      {
        kind: 'link',
        id: 'devices',
        to: '/devices',
        icon: Server,
        label: 'Dispositivos',
        viewerVisible: true,
        adminOnly: false,
      },
      {
        kind: 'link',
        id: 'racks',
        to: '/racks',
        icon: HardDrive,
        label: 'Racks',
        viewerVisible: true,
        adminOnly: false,
      },
      {
        kind: 'link',
        id: 'topology',
        to: '/topology',
        icon: GitBranch,
        label: 'Topología',
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
  const base = `group relative flex items-center ${
    isCollapsed ? 'justify-center px-2' : nested ? 'gap-3 pl-10 pr-3' : 'gap-3 px-3'
  } py-2.5 rounded-xl text-sm font-medium transition-colors`
  if (isActive) {
    return `${base} ${
      isCollapsed
        ? 'bg-blue-600/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20 shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_8px_20px_rgba(59,130,246,0.12)]'
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
    if (!raw) return { infraestructura: true, 'capa-red': true }
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return { infraestructura: true, 'capa-red': true, ...parsed }
  } catch {
    return { infraestructura: true, 'capa-red': true }
  }
}

interface SidebarProps {
  isOpen: boolean
  isCollapsed: boolean
  isViewer: boolean
  onToggleCollapsed: () => void
  onClose: () => void
}

export function Sidebar({ isOpen, isCollapsed, isViewer, onToggleCollapsed, onClose }: SidebarProps) {
  const { isGlobalAdmin } = usePermissions()
  const location = useLocation()
  const navEntries = filterVisible(allNavEntries, isGlobalAdmin, isViewer)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(readOpenGroups)

  useEffect(() => {
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(openGroups))
  }, [openGroups])

  // Auto-expand group that contains the active route
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

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const collapseButtonLabel = isCollapsed ? 'Expandir barra' : 'Contraer barra'

  const renderLeaf = (item: NavLeaf, nested = false) => (
    <NavLink
      key={item.id}
      to={item.to}
      end={item.to === '/'}
      onClick={onClose}
      className={({ isActive }) => linkClassName(isActive, isCollapsed, nested)}
    >
      <item.icon className="w-5 h-5 flex-shrink-0" />
      <span
        className={`transition-all duration-200 ${
          isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100'
        }`}
      >
        {item.label}
      </span>
      {isCollapsed && (
        <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 max-w-48 truncate whitespace-nowrap rounded-lg bg-slate-900 text-white text-xs px-3 py-1.5 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100">
          {item.label}
        </span>
      )}
    </NavLink>
  )

  const renderGroup = (group: NavGroup) => {
    const groupActive = group.children.some((c) => pathMatches(location.pathname, c.to))
    const isOpenGroup = openGroups[group.id] ?? true

    if (isCollapsed) {
      return (
        <div key={group.id} className="relative group/flyout">
          <div
            className={`flex items-center justify-center px-2 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-default ${
              groupActive
                ? 'bg-blue-600/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
            }`}
            aria-label={group.label}
            title={group.label}
          >
            <group.icon className="w-5 h-5 flex-shrink-0" />
          </div>
          <div className="pointer-events-none absolute left-full top-0 ml-3 min-w-44 rounded-xl bg-slate-900 text-white text-xs py-2 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover/flyout:pointer-events-auto group-hover/flyout:opacity-100 z-[70]">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {group.label}
            </p>
            {group.children.map((child) => {
              const active = pathMatches(location.pathname, child.to)
              return (
                <NavLink
                  key={child.id}
                  to={child.to}
                  onClick={onClose}
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
          </div>
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
          <span className="flex-1 text-left">{group.label}</span>
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
        className={`fixed top-0 left-0 z-50 h-full transform transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64 transition-[width] duration-200 ease-out ${
          isCollapsed
            ? 'bg-transparent dark:bg-transparent lg:bg-transparent lg:dark:bg-transparent'
            : 'bg-slate-50 dark:bg-slate-950'
        }`}
      >
        <div
          className={`flex flex-col h-full ${
            isCollapsed ? '' : 'border-r border-slate-200 dark:border-slate-800/80'
          }`}
        >
          <div
            className={`flex items-center justify-between h-16 ${
              isCollapsed
                ? 'lg:border-b lg:border-slate-200/60 lg:dark:border-slate-800/50'
                : 'border-b border-slate-200 dark:border-slate-800/80'
            } ${isCollapsed ? 'px-3' : 'px-6'}`}
          >
            <div className={`flex items-center ${isCollapsed ? 'gap-0' : 'gap-3'}`}>
              <div className="p-1.5 bg-blue-600 rounded-lg">
                <Network className="w-5 h-5 text-white" />
              </div>
              <span
                className={`text-lg font-bold text-slate-900 dark:text-white origin-left transition-all duration-200 ${
                  isCollapsed ? 'w-0 opacity-0 scale-95 ml-0 overflow-hidden' : 'opacity-100 scale-100 ml-3'
                }`}
              >
                NetManager
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="hidden lg:inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/5 transition-colors"
                aria-label={collapseButtonLabel}
                title={collapseButtonLabel}
              >
                {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <nav
            className={`flex-1 py-4 space-y-1 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-3'}`}
            aria-label="Navegación principal"
          >
            {navEntries.map((entry) =>
              entry.kind === 'group' ? renderGroup(entry) : renderLeaf(entry)
            )}
          </nav>

          {!isViewer && (
            <div
              className={`py-4 ${isCollapsed ? 'px-2' : 'px-3'} ${
                isCollapsed
                  ? 'lg:border-t lg:border-slate-200/60 lg:dark:border-slate-800/50'
                  : 'border-t border-slate-200 dark:border-slate-800/80'
              }`}
            >
              <NavLink
                to="/settings"
                onClick={onClose}
                className={({ isActive }) => linkClassName(isActive, isCollapsed)}
              >
                <Settings className="w-5 h-5" />
                <span
                  className={`transition-all duration-200 ${
                    isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100'
                  }`}
                >
                  Configuración
                </span>
                {isCollapsed && (
                  <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 max-w-48 truncate whitespace-nowrap rounded-lg bg-slate-900 text-white text-xs px-3 py-1.5 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100">
                    Configuración
                  </span>
                )}
              </NavLink>
            </div>
          )}
        </div>
      </aside>

      <button
        type="button"
        onClick={onToggleCollapsed}
        className={`hidden lg:flex fixed z-[60] items-center justify-center w-8 h-8 rounded-full border transition-all duration-200 ${
          isCollapsed
            ? 'left-[4.75rem] top-1/2 -translate-y-1/2 bg-white/70 dark:bg-slate-950/50 border-slate-200/70 dark:border-slate-800/60 text-slate-700 dark:text-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.20)] backdrop-blur-xl hover:scale-105 hover:bg-white/90 dark:hover:bg-slate-950/70'
            : 'left-[15.5rem] top-[4.25rem] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-md hover:bg-slate-50 dark:hover:bg-slate-900/60'
        }`}
        aria-label={collapseButtonLabel}
        title={collapseButtonLabel}
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </>
  )
}
