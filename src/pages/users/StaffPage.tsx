import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Edit2, Trash2, Loader2, X, AlertCircle,
  ShieldCheck, ShieldOff, Mail, CheckCircle2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/store/authStore'
import type { PaginatedResponse } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type Role = 'owner' | 'receptionist' | 'provider' | 'assistant'

interface StaffUser {
  id: number; name: string; email: string; role: Role
  email_verified_at: string | null
  two_factor_enabled: boolean
  force_password_change: boolean
  created_at: string
}

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CFG: Record<Role, { label: string; cls: string }> = {
  owner:        { label: 'Owner',        cls: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  receptionist: { label: 'Receptionist', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  provider:     { label: 'Provider',     cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  assistant:    { label: 'Assistant',    cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
}

function RoleBadge({ role }: { role: Role }) {
  const { label, cls } = ROLE_CFG[role] ?? { label: role, cls: 'text-zinc-400 bg-zinc-700/30 border-zinc-700' }
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', cls)}>{label}</span>
}

function initials(name: string) { return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() }

// ── Shared UI ─────────────────────────────────────────────────────────────────

const iCls = 'w-full h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  )
}

function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0 pointer-events-none')} />
      <div className={cn('fixed top-0 right-0 h-full w-full max-w-lg z-50 flex flex-col bg-[#0d0f1c] border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-in-out', open ? 'translate-x-0' : 'translate-x-full')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  )
}

// ── User Form ─────────────────────────────────────────────────────────────────

function UserForm({ mode, initial, userId, onSuccess, onClose }: {
  mode: 'create' | 'edit'; initial?: { name: string; email: string; role: string }
  userId?: number; onSuccess: () => void; onClose: () => void
}) {
  const [form, setForm] = useState({ name: initial?.name ?? '', email: initial?.email ?? '', role: initial?.role ?? 'receptionist', password: '', password_confirmation: '' })
  const [err, setErr]   = useState('')
  const [fieldErr, setFE] = useState<Record<string, string>>({})
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (d: Record<string, string>) =>
      mode === 'create' ? api.post('/users', d) : api.patch(`/users/${userId}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); onSuccess() },
    onError: (e: unknown) => {
      const r = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
      if (r?.errors) { const flat: Record<string,string>={}; Object.entries(r.errors).forEach(([k,v])=>{flat[k]=v[0]}); setFE(flat) }
      else setErr(r?.message ?? 'Operation failed.')
    },
  })

  function s(k: string) { return (v: string) => { setForm(f => ({ ...f, [k]: v })); setFE(fe => ({ ...fe, [k]: '' })) } }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setFE({})
    const p: Record<string, string> = { name: form.name, email: form.email, role: form.role }
    if (mode === 'create') {
      p.password = form.password
      p.password_confirmation = form.password_confirmation
    } else if (form.password) {
      p.password = form.password
      p.password_confirmation = form.password_confirmation
    }
    mutation.mutate(p)
  }

  const ROLES: Role[] = ['owner', 'receptionist', 'provider', 'assistant']

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}

      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Identity</p>
        <Field label="Full Name" required error={fieldErr.name}>
          <input className={cn(iCls, fieldErr.name && 'border-red-500/40')} value={form.name} onChange={e => s('name')(e.target.value)} placeholder="Jane Smith" />
        </Field>
        <Field label="Email" required error={fieldErr.email}>
          <input type="email" className={cn(iCls, fieldErr.email && 'border-red-500/40')} value={form.email} onChange={e => s('email')(e.target.value)} placeholder="jane@clinic.com" />
        </Field>
        <Field label="Role" required error={fieldErr.role}>
          <select className={cn(iCls, 'bg-[#0f1120]')} value={form.role} onChange={e => s('role')(e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_CFG[r].label}</option>)}
          </select>
        </Field>
      </section>

      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
          {mode === 'create' ? 'Password' : 'Change Password (optional)'}
        </p>
        <Field label="Password" required={mode === 'create'} error={fieldErr.password}>
          <input type="password" className={cn(iCls, fieldErr.password && 'border-red-500/40')} value={form.password} onChange={e => s('password')(e.target.value)} placeholder="Min 8 chars, mixed case + numbers" autoComplete="new-password" />
        </Field>
        <Field label="Confirm Password" required={mode === 'create'} error={fieldErr.password_confirmation}>
          <input type="password" className={iCls} value={form.password_confirmation} onChange={e => s('password_confirmation')(e.target.value)} placeholder="Repeat password" autoComplete="new-password" />
        </Field>
      </section>

      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mutation.isPending ? 'Saving…' : mode === 'create' ? 'Create Staff' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [createOpen, setC]    = useState(false)
  const [editing, setEditing] = useState<StaffUser | null>(null)
  const dSearch = useDebounce(search, 350)
  const qc = useQueryClient()
  const currentUser = useAuthStore(s => s.user)

  const params: Record<string,string> = { page: String(page) }
  if (dSearch) params.search = dSearch

  const { data, isLoading } = useQuery({
    queryKey: ['staff', params],
    queryFn: () => api.get<PaginatedResponse<StaffUser>>('/users', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })

  const resendMutation = useMutation({
    mutationFn: (id: number) => api.post(`/users/${id}/resend-verification`),
  })

  const users = data?.data ?? []
  const meta  = data?.meta

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">Staff</h2>
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">{(meta?.total ?? 0).toLocaleString()}</span>
        </div>
        <button onClick={() => setC(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" strokeWidth={2} /> New Staff
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search name, email…"
          className="w-full h-9 pl-9 pr-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/40 transition-all" />
      </div>

      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Staff Member','Role','Email','2FA','Joined',''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array(5).fill(0).map((_,i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array(6).fill(0).map((_,j) => <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/[0.05] rounded animate-pulse w-24" /></td>)}
                </tr>
              ))}
              {!isLoading && users.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center text-zinc-600 text-sm">No staff found</td></tr>}
              {!isLoading && users.map(u => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                        u.id === currentUser?.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/[0.06] text-zinc-400',
                      )}>{initials(u.name)}</div>
                      <div>
                        <p className="text-white text-xs font-medium">{u.name}{u.id === currentUser?.id && <span className="ml-1.5 text-[10px] text-zinc-600">(you)</span>}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {u.email_verified_at
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" strokeWidth={1.8} />
                        : <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" strokeWidth={1.8} />
                      }
                      <span className="text-zinc-400 text-xs">{u.email}</span>
                    </div>
                    {!u.email_verified_at && (
                      <button onClick={() => resendMutation.mutate(u.id)} disabled={resendMutation.isPending}
                        className="text-[10px] text-amber-400 hover:text-amber-300 mt-0.5 transition-colors">
                        Resend verification
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.two_factor_enabled
                      ? <span className="flex items-center gap-1 text-xs text-emerald-400"><ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.8} />Enabled</span>
                      : <span className="flex items-center gap-1 text-xs text-zinc-600"><ShieldOff className="w-3.5 h-3.5" strokeWidth={1.8} />Off</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-zinc-600 text-xs whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => setEditing(u)} className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors">
                        <Edit2 className="w-3.5 h-3.5" strokeWidth={1.8} /> Edit
                      </button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => { if (confirm(`Delete ${u.name}?`)) deleteMutation.mutate(u.id) }} disabled={deleteMutation.isPending}
                          className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-zinc-600 text-xs">{((meta.current_page-1)*meta.per_page)+1}–{Math.min(meta.current_page*meta.per_page,meta.total)} of {meta.total}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={meta.current_page===1} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-zinc-500 text-xs px-2">{meta.current_page} / {meta.last_page}</span>
              <button onClick={() => setPage(p=>Math.min(meta.last_page,p+1))} disabled={meta.current_page===meta.last_page} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      <Drawer open={createOpen} onClose={() => setC(false)} title="New Staff Member"><UserForm mode="create" onSuccess={() => setC(false)} onClose={() => setC(false)} /></Drawer>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Edit Staff Member">
        {editing && <UserForm mode="edit" userId={editing.id} initial={{ name: editing.name, email: editing.email, role: editing.role }} onSuccess={() => setEditing(null)} onClose={() => setEditing(null)} />}
      </Drawer>
    </div>
  )
}
