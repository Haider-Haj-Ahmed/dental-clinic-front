import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, LogOut, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':       'Dashboard',
  '/patients':        'Patients',
  '/appointments':    'Appointments',
  '/providers':       'Providers',
  '/encounters':      'Encounters',
  '/treatment-plans': 'Treatment Plans',
  '/prescriptions':   'Prescriptions',
  '/invoices':        'Invoices',
  '/payments':        'Payments',
  '/inventory':       'Inventory',
  '/suppliers':       'Suppliers',
  '/reports':         'Reports',
  '/users':           'Staff',
  '/settings':        'Settings',
  '/audit-logs':      'Audit Logs',
}

const ROLE_LABEL: Record<string, string> = {
  owner:        'Owner',
  provider:     'Provider',
  receptionist: 'Receptionist',
  assistant:    'Assistant',
}

interface TopbarProps {
  sidebarCollapsed: boolean
}

export default function Topbar({ sidebarCollapsed }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef   = useRef<HTMLDivElement>(null)
  const navigate  = useNavigate()
  const location  = useLocation()
  const user      = useAuthStore(s => s.user)
  const logout    = useAuthStore(s => s.logout)

  const pageTitle =
    Object.entries(PAGE_TITLES)
      .find(([path]) => location.pathname.startsWith(path))?.[1] ?? 'Dashboard'

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleLogout() {
    try { await api.post('/auth/logout') } catch {}
    logout()
    navigate('/login')
  }

  const initials = user?.name
    ?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-14 z-20',
        'bg-[#0a0c14]/80 backdrop-blur-md border-b border-white/[0.06]',
        'flex items-center justify-between px-5',
        'transition-all duration-300',
        sidebarCollapsed ? 'left-16' : 'left-60',
      )}
    >
      {/* Page title */}
      <h1 className="text-white font-semibold text-sm">{pageTitle}</h1>

      {/* Right controls */}
      <div className="flex items-center gap-1.5">

        {/* Notifications bell */}
        <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors">
          <Bell className="w-4 h-4" strokeWidth={1.8} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full" />
        </button>

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2 h-8 pl-1.5 pr-2 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <span className="text-indigo-300 text-[10px] font-bold leading-none">{initials}</span>
            </div>
            <span className="text-zinc-300 text-sm font-medium hidden sm:block max-w-[120px] truncate">
              {user?.name}
            </span>
            <ChevronDown
              className={cn('w-3.5 h-3.5 text-zinc-500 transition-transform duration-150', menuOpen && 'rotate-180')}
              strokeWidth={2}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] w-52 bg-[#141626] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
              {/* Info */}
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <p className="text-white text-sm font-medium truncate">{user?.name}</p>
                <p className="text-zinc-500 text-xs truncate mt-0.5">{user?.email}</p>
                <span className="inline-flex mt-2 text-[10px] font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/20 rounded-full px-2 py-0.5 tracking-wide">
                  {ROLE_LABEL[user?.role ?? ''] ?? user?.role}
                </span>
              </div>
              {/* Actions */}
              <div className="p-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.8} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
