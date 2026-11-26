import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Bell, LogOut, ChevronDown, Check, Trash2,
  KeyRound, Loader2, X, AlertCircle, Monitor, Shield,
} from 'lucide-react'
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

interface Session {
  id: number | string
  name: string
  last_used_at: string | null
  created_at: string
  is_current?: boolean
}

const FRIENDLY: Record<string, string> = {
  '/dashboard':'Dashboard','/patients':'Patients','/appointments':'Appointments',
  '/providers':'Providers','/recalls':'Recalls','/encounters':'Encounters',
  '/treatment-plans':'Treatment Plans','/prescriptions':'Prescriptions',
  '/invoices':'Invoices','/payments':'Payments','/payment-plans':'Payment Plans',
  '/inventory':'Inventory','/suppliers':'Suppliers','/reports':'Reports',
  '/users':'Staff','/settings':'Settings','/audit-logs':'Audit Logs',
}
const ROLE_LABEL: Record<string, string> = {
  owner:'Owner', provider:'Provider', receptionist:'Receptionist', assistant:'Assistant',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const iCls = 'w-full h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'

// ── Change Password Modal ─────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [err, setErr] = useState(''); const [ok, setOk] = useState(false)
  const mutation = useMutation({
    mutationFn: (d: typeof form) => api.post('/auth/change-password', d),
    onSuccess: () => { setOk(true); setTimeout(onClose, 1500) },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.'),
  })
  function s(k: string) { return (v: string) => { setForm(f => ({ ...f, [k]: v })); setErr('') } }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!form.current_password || !form.password) { setErr('All fields required.'); return }
    if (form.password !== form.password_confirmation) { setErr('Passwords do not match.'); return }
    if (form.password.length < 8) { setErr('Min 8 characters.'); return }
    mutation.mutate(form)
  }
  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#0f1120] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
            <h2 className="text-white font-semibold">Change Password</h2>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
            {err && <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /><span>{err}</span></div>}
            {ok  && <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-3 py-2.5"><Check className="w-3.5 h-3.5" /> Changed successfully.</div>}
            {['current_password','password','password_confirmation'].map((k,i) => (
              <div key={k} className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{['Current Password','New Password','Confirm New Password'][i]}</label>
                <input type="password" className={iCls} value={(form as Record<string,string>)[k]} onChange={e => s(k)(e.target.value)} autoComplete={i===0?'current-password':'new-password'} />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
              <button type="submit" disabled={mutation.isPending || ok} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{mutation.isPending ? 'Saving…' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ── Sessions Modal ────────────────────────────────────────────────────────────
function SessionsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<{ data: Session[] }>('/auth/tokens').then(r => r.data.data),
  })
  const revokeMutation = useMutation({
    mutationFn: (id: number | string) => api.delete(`/auth/tokens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
  const revokeAllMutation = useMutation({
    mutationFn: () => api.delete('/auth/tokens'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const sessions = data ?? []

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0f1120] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" strokeWidth={1.8} />
              <h2 className="text-white font-semibold">Active Sessions</h2>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {isLoading && Array(3).fill(0).map((_, i) => <div key={i} className="h-14 bg-white/[0.03] rounded-lg animate-pulse" />)}
            {!isLoading && sessions.length === 0 && <p className="text-zinc-600 text-sm text-center py-6">No sessions found</p>}
            {sessions.map(s => (
              <div key={s.id} className={cn('flex items-center justify-between gap-3 px-4 py-3 rounded-xl border', s.is_current ? 'bg-indigo-500/[0.06] border-indigo-500/20' : 'bg-white/[0.02] border-white/[0.05]')}>
                <div className="flex items-center gap-3 min-w-0">
                  <Monitor className="w-4 h-4 text-zinc-500 shrink-0" strokeWidth={1.8} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-white font-medium truncate">{s.name || 'Unknown Device'}</p>
                      {s.is_current && <span className="text-[10px] text-indigo-400 bg-indigo-500/15 border border-indigo-500/20 rounded-full px-1.5 py-0.5 font-semibold shrink-0">Current</span>}
                    </div>
                    <p className="text-xs text-zinc-500">{s.last_used_at ? `Last used ${timeAgo(s.last_used_at)}` : `Created ${timeAgo(s.created_at)}`}</p>
                  </div>
                </div>
                {!s.is_current && (
                  <button onClick={() => revokeMutation.mutate(s.id)} disabled={revokeMutation.isPending}
                    className="shrink-0 h-7 px-2.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors disabled:opacity-50">
                    {revokeMutation.isPending && revokeMutation.variables === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Revoke'}
                  </button>
                )}
              </div>
            ))}
          </div>
          {sessions.some(s => !s.is_current) && (
            <div className="px-4 pb-4">
              <button onClick={() => { if (confirm('Revoke all other sessions?')) revokeAllMutation.mutate() }} disabled={revokeAllMutation.isPending}
                className="w-full h-9 rounded-lg text-sm text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {revokeAllMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Revoke All Other Sessions
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Topbar ────────────────────────────────────────────────────────────────────

interface TopbarProps { sidebarCollapsed: boolean }

export default function Topbar({ sidebarCollapsed }: TopbarProps) {
  const [userMenuOpen,  setUserMenuOpen]  = useState(false)
  const [notifOpen,     setNotifOpen]     = useState(false)
  const [changePwOpen,  setChangePwOpen]  = useState(false)
  const [sessionsOpen,  setSessionsOpen]  = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef    = useRef<HTMLDivElement>(null)
  const navigate    = useNavigate()
  const location    = useLocation()
  const user        = useAuthStore(s => s.user)
  const logout      = useAuthStore(s => s.logout)
  const qc          = useQueryClient()

  const pageTitle = Object.entries(FRIENDLY).find(([p]) => location.pathname.startsWith(p))?.[1] ?? 'Dashboard'

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: Notification[] }>('/notifications', { params: { per_page: '20' } }).then(r => r.data.data),
    refetchInterval: 60_000,
  })
  const notifications = notifData ?? []
  const unreadCount   = notifications.filter(n => !n.read_at).length

  const markReadMutation    = useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
  const markAllReadMutation = useMutation({ mutationFn: () => api.post('/notifications/read-all'),              onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
  const deleteReadMutation  = useMutation({ mutationFn: () => api.delete('/notifications/read'),               onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })

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
    <>
      <header className={cn(
        'fixed top-0 right-0 h-14 z-20',
        'bg-[#0a0c14]/90 backdrop-blur-md border-b border-white/[0.06]',
        'flex items-center justify-between px-5 transition-all duration-300',
        sidebarCollapsed ? 'left-[68px]' : 'left-64',
      )}>
        <h1 className="text-white font-semibold text-sm">{pageTitle}</h1>

        <div className="flex items-center gap-1.5">
          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button onClick={() => setNotifOpen(v => !v)}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors">
              <Bell className="w-4 h-4" strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] w-80 bg-[#141626] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
                  <p className="text-white text-sm font-semibold">Notifications {unreadCount > 0 && <span className="text-xs text-indigo-400 ml-1">({unreadCount} new)</span>}</p>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && <button onClick={() => markAllReadMutation.mutate()} className="h-6 px-2 rounded text-[11px] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1"><Check className="w-3 h-3" /> All read</button>}
                    {notifications.some(n => n.read_at) && <button onClick={() => deleteReadMutation.mutate()} className="h-6 px-2 rounded text-[11px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 && <div className="px-4 py-8 text-center text-zinc-600 text-sm">No notifications</div>}
                  {notifications.map(n => {
                    const title = String(n.data?.title ?? n.data?.message ?? n.data?.body ?? 'Notification')
                    const body  = String(n.data?.body ?? n.data?.message ?? '')
                    return (
                      <button key={n.id} onClick={() => !n.read_at && markReadMutation.mutate(n.id)}
                        className={cn('w-full text-left px-4 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors last:border-b-0', !n.read_at && 'bg-indigo-500/[0.03]')}>
                        <div className="flex items-start gap-2">
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-1.5', !n.read_at ? 'bg-indigo-400' : 'bg-transparent')} />
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-xs font-medium truncate', n.read_at ? 'text-zinc-400' : 'text-white')}>{title}</p>
                            {body && body !== title && <p className="text-[11px] text-zinc-600 truncate mt-0.5">{body}</p>}
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
                  <button onClick={() => { setUserMenuOpen(false); setChangePwOpen(true) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-colors">
                    <KeyRound className="w-4 h-4" strokeWidth={1.8} /> Change Password
                  </button>
                  <button onClick={() => { setUserMenuOpen(false); setSessionsOpen(true) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-colors">
                    <Shield className="w-4 h-4" strokeWidth={1.8} /> Active Sessions
                  </button>
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

      {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} />}
      {sessionsOpen  && <SessionsModal     onClose={() => setSessionsOpen(false)}  />}
    </>
  )
}
