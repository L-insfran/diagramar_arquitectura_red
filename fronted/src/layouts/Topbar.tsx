import { Building2, Check, ChevronDown, LogOut, Menu, Moon, Search, Sun } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { usePermissions } from '../hooks/usePermissions'

interface TopbarProps {
  onMenuClick: () => void
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  operator: 'Operador',
  viewer: 'Visualizador',
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const { companies, activeCompany, activeCompanyId, setActiveCompany, isLoading } = useCompany()
  const { isGlobalAdmin, role } = usePermissions()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showCompanyMenu, setShowCompanyMenu] = useState(false)
  const [companyQuery, setCompanyQuery] = useState('')
  const companyMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showCompanyMenu) return
    const onDocClick = (e: MouseEvent) => {
      if (!companyMenuRef.current?.contains(e.target as Node)) {
        setShowCompanyMenu(false)
        setCompanyQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showCompanyMenu])

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.domain ?? '').toLowerCase().includes(q)
    )
  }, [companies, companyQuery])

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80">
      <div className="flex items-center justify-between h-full px-4 lg:px-6 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="relative min-w-0" ref={companyMenuRef}>
            <button
              type="button"
              onClick={() => setShowCompanyMenu((v) => !v)}
              disabled={isLoading || companies.length === 0}
              className="inline-flex max-w-[min(100vw-8rem,22rem)] items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
              aria-expanded={showCompanyMenu}
              aria-haspopup="listbox"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400">
                <Building2 className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {activeCompany?.name ?? (isLoading ? 'Cargando…' : 'Seleccionar cliente')}
                </span>
                <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {ROLE_LABELS[role] ?? role}
                  {activeCompany?.domain ? ` · ${activeCompany.domain}` : ''}
                </span>
              </span>
              <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
            </button>

            {showCompanyMenu && (
              <div className="absolute left-0 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={companyQuery}
                      onChange={(e) => setCompanyQuery(e.target.value)}
                      placeholder="Buscar cliente…"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 pl-8 pr-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      autoFocus
                    />
                  </div>
                </div>
                <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
                  {filteredCompanies.length === 0 ? (
                    <li className="px-3 py-4 text-center text-xs text-slate-500">Sin resultados</li>
                  ) : (
                    filteredCompanies.map((company) => {
                      const selected = company.id === activeCompanyId
                      return (
                        <li key={company.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => {
                              setActiveCompany(company.id)
                              setShowCompanyMenu(false)
                              setCompanyQuery('')
                            }}
                            className={`flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${
                              selected ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                                {company.name}
                              </span>
                              <span className="block truncate text-[11px] text-slate-500">
                                {ROLE_LABELS[company.role]}
                                {typeof company.deviceCount === 'number'
                                  ? ` · ${company.deviceCount} dispositivos`
                                  : ''}
                              </span>
                            </span>
                            {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />}
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
                {isGlobalAdmin && (
                  <div className="border-t border-slate-100 dark:border-slate-800 p-2">
                    <Link
                      to="/clients"
                      onClick={() => setShowCompanyMenu(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    >
                      <Building2 className="w-4 h-4" />
                      Gestionar clientes
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="relative ml-2">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {user?.firstName?.charAt(0) || 'U'}
                {user?.lastName?.charAt(0) || ''}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {user ? `${user.firstName} ${user.lastName}` : 'User'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                  {ROLE_LABELS[role] || role}
                </p>
              </div>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} aria-hidden />
                <div
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 py-1"
                  role="menu"
                >
                  <button
                    type="button"
                    onClick={() => {
                      void logout()
                      setShowUserMenu(false)
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    role="menuitem"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
