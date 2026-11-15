import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { KeyRound, Loader2, AlertCircle, X } from 'lucide-react'

const COLLAPSED_KEY = 'dental-sidebar-collapsed'

// ── Force password change banner ──────────────────────────────────────────────

function ForcePwBanner() {
  const [form, setForm] = useState({ password: '', password_confirmation: '' })
  const [err, setErr]   = useState('')
  const [done, setDone] = useState(false)
  const user = useAuthStore(s => s.user)
  const setAuth = useAuthStore(s => s.setAuth)

  const mutation = useMutation({
    mutationFn: (d: typeof form) => api.post('/auth/change-password', { current_password: '', ...d }),
    onSuccess: () => {
      if (user) setAuth(useAuthStore.getState().token!, { ...user, force_password_change: false })
      setDone(true)
    },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.'),
  })

  if (done) return null

  const iCls = 'h-9 px-3 rounded-lg text-sm text-white bg-white/[0.08] border border-white/[0.15] placeholder:text-zinc-500 outline-none focus:border-amber-500/60 transition-all'

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3">
      <div className="flex items-start gap-3 max-w-3xl">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" strokeWidth={1.8} />
        <div className="flex-1">
          <p className="text-amber-300 text-sm font-medium">Password change required</p>
          <p className="text-amber-400/70 text-xs mt-0.5">Your administrator has requested you change your password before continuing.</p>
          {err && <p className="text-red-400 text-xs mt-1">{err}</p>}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <input type="password" className={iCls} style={{ width: '180px' }} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="New password" autoComplete="new-password" />
            <input type="password" className={iCls} style={{ width: '180px' }} value={form.password_confirmation} onChange={e => setForm(f => ({ ...f, password_confirmation: e.target.value }))} placeholder="Confirm password" autoComplete="new-password" />
            <button
              onClick={() => { setErr(''); if (!form.password || form.password.length < 8) { setErr('Min 8 characters.'); return } if (form.password !== form.password_confirmation) { setErr('Passwords do not match.'); return } mutation.mutate(form) }}
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" strokeWidth={1.8} />}
              {mutation.isPending ? 'Saving…' : 'Set Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true')
  const user = useAuthStore(s => s.user)

  function toggle() {
    setCollapsed(v => { const next = !v; localStorage.setItem(COLLAPSED_KEY, String(next)); return next })
  }

  return (
    <div className="min-h-screen bg-[#0a0c14]">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <Topbar sidebarCollapsed={collapsed} />
      <main className={cn('pt-14 min-h-screen transition-all duration-300', collapsed ? 'ml-[68px]' : 'ml-64')}>
        {/* Force password change banner — shown above page content */}
        {user?.force_password_change && <ForcePwBanner />}
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
