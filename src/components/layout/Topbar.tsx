import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, LogOut, ChevronDown, Check, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  data: { title?: string; message?: string; body?: string; [k: string]: unknown }
  read_at: string | null
  created_at: string
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard', '/patients': 'Patients', '/appointments': 'Appointments',
  '/providers': 'Providers', '/encounters': 'Encounters', '/treatment-plans': 'Treatment Plans',
  '/prescriptions': 'Prescriptions', '/invoices': 'Invoices', '/payments': 'Payments',
  '/inventory': 'Inventory', '/suppliers': 'Suppliers', '/reports': 'Reports',
  '/users': 'Staff', '/settings': 'Settings', '/audit-logs': 'Audit Logs',
  '/recalls': 'Recalls',
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner', provider: 'Provider', receptionist: 'Receptionist', assistant: 'Assistant',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface TopbarProps { sidebarCollapsed: boolean }

export default function Topbar({ sidebarCollapsed }: TopbarProps) {
  const [userMenuOpen, setUserMenuOpen]   = useState(false)
  const [notifOpen, setNotifOpen]         = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef    = useRef<HTMLDivElement>(null)
  const navigate    = useNavigate()
  const location    = useLocation()
  const user        = useAuthStore(s => s.user)
  const logout      = useAuthStore(s => s.logout)
  const qc          = useQueryClient()

  const pageTitle = Object.entries(PAGE_TITLES).find(([p]) => location.pathname.startsWith(p))?.[1] ?? 'Dashboard'

  // Notifications
  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: Notification[] }>('/notifications', { params: { per_page: '20' } }).then(r => r.data.data),
    refetchInterval: 60_000, // poll every minute
  })
  const notifications = notifData ?? []
  const unreadCount   = notifications.filter(n => !n.read_at).length

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const deleteReadMutation = useMutation({
    mutationFn: () => api.delete('/notifications/read'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (notifRef.current    && !notifRef.current.contains(e.target as Node))    setNotifOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function handleLogout() {
    try { await api.post('/auth/logout') } catch {}
    logout(); navigate('/login')
  }

  const initials = user?.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  return (
    <header className={cn(
      'fixed top-0 right-0 h-14 z-20',
      'bg-[#0a0c14]/90 backdrop-blur-md border-b border-white/[0.06]',
      'flex items-center justify-between px-5',
      'transition-all duration-300',
      sidebarCollapsed ? 'left-[68px]' : 'left-64',
    )}>
      {/* Page title */}
      <h1 className="text-white font-semibold text-sm">{pageTitle}</h1>

      <div className="flex items-center gap-1.5">

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            <Bell className="w-4 h-4" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] w-80 bg-[#141626] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
                <p className="text-white text-sm font-semibold">Notifications {unreadCount > 0 && <span className="text-xs text-indigo-400 ml-1">({unreadCount} new)</span>}</p>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button onClick={() => markAllReadMutation.mutate()} className="h-6 px-2 rounded text-[11px] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1">
                      <Check className="w-3 h-3" /> All read
                    </button>
                  )}
                  {notifications.some(n => n.read_at) && (
                    <button onClick={() => deleteReadMutation.mutate()} className="h-6 px-2 rounded text-[11px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="px-4 py-8 text-center text-zinc-600 text-sm">No notifications</div>
                )}
                {notifications.map(n => {
                  const title = n.data?.title ?? n.data?.message ?? n.data?.body ?? 'Notification'
                  const body  = n.data?.body  ?? n.data?.message ?? ''
                  return (
                    <button key={n.id} onClick={() => !n.read_at && markReadMutation.mutate(n.id)}
                      className={cn('w-full text-left px-4 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors last:border-b-0',
                        !n.read_at && 'bg-indigo-500/[0.03]',
                      )}>
                      <div className="flex items-start gap-2">
                        {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />}
                        {n.read_at  && <span className="w-1.5 h-1.5 shrink-0 mt-1.5" />}
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs font-medium truncate', n.read_at ? 'text-zinc-400' : 'text-white')}>{title as string}</p>
                          {body && typeof body === 'string' && body !== title && (
                            <p className="text-[11px] text-zinc-600 truncate mt-0.5">{body}</p>
                          )}
                          <p className="text-[10px] text-zinc-700 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div ref={userMenuRef} className="relative">
          <button onClick={() => setUserMenuOpen(v => !v)}
            className="flex items-center gap-2 h-8 pl-1.5 pr-2 rounded-lg hover:bg-white/[0.06] transition-colors">
            <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <span className="text-indigo-300 text-[10px] font-bold leading-none">{initials}</span>
            </div>
            <span className="text-zinc-300 text-sm font-medium hidden sm:block max-w-[120px] truncate">{user?.name}</span>
            <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-500 transition-transform duration-150', userMenuOpen && 'rotate-180')} strokeWidth={2} />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] w-52 bg-[#141626] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <p className="text-white text-sm font-medium truncate">{user?.name}</p>
                <p className="text-zinc-500 text-xs truncate mt-0.5">{user?.email}</p>
                <span className="inline-flex mt-2 text-[10px] font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/20 rounded-full px-2 py-0.5 tracking-wide">
                  {ROLE_LABEL[user?.role ?? ''] ?? user?.role}
                </span>
              </div>
              <div className="p-1">
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  <LogOut className="w-4 h-4" strokeWidth={1.8} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
