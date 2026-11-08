import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Mail, Phone, BadgeCheck, Building2,
  Edit2, Power, Loader2, X, AlertCircle, FileText,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import type { PaginatedResponse } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface Provider {
  id: number
  name: string
  specialty: string | null
  phone: string | null
  email: string | null
  license_number: string | null
  bio: string | null
  is_active: boolean
  operatory: { id: number; name: string } | null
  user: { id: number; name: string; email: string } | null
}

interface Operatory { id: number; name: string; is_active: boolean }

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

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

// ── Provider Form ─────────────────────────────────────────────────────────────

type FormMode = 'create' | 'edit'

const EMPTY = { name: '', specialty: '', phone: '', email: '', license_number: '', bio: '', operatory_id: '', is_active: true }

function ProviderForm({ mode, initial, providerId, onSuccess, onClose }: {
  mode: FormMode
  initial?: typeof EMPTY
  providerId?: number
  onSuccess: () => void
  onClose: () => void
}) {
  const [form, setForm]   = useState(initial ?? EMPTY)
  const [err, setErr]     = useState('')
  const [fieldErr, setFE] = useState<Record<string, string>>({})
  const qc = useQueryClient()

  const { data: operatories } = useQuery({
    queryKey: ['operatories-list'],
    queryFn: () => api.get<{ data: Operatory[] }>('/operatories', { params: { per_page: '100' } }).then(r => r.data.data),
  })

  const mutation = useMutation({
    mutationFn: (d: Record<string, string | boolean | number>) =>
      mode === 'create'
        ? api.post('/providers', d)
        : api.patch(`/providers/${providerId}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['providers'] }); onSuccess() },
    onError: (e: unknown) => {
      const r = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
      if (r?.errors) { const flat: Record<string,string>={}; Object.entries(r.errors).forEach(([k,v])=>{flat[k]=v[0]}); setFE(flat) }
      else setErr(r?.message ?? 'Operation failed.')
    },
  })

  function s(k: string) { return (v: string | boolean) => { setForm(f => ({ ...f, [k]: v })); setFE(fe => ({ ...fe, [k]: '' })) } }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setFE({})
    if (!form.name.trim()) { setFE(fe => ({ ...fe, name: 'Required' })); return }
    const payload: Record<string, string | boolean | number> = { name: form.name, is_active: form.is_active }
    if (form.specialty)      payload.specialty      = form.specialty
    if (form.phone)          payload.phone          = form.phone
    if (form.email)          payload.email          = form.email
    if (form.license_number) payload.license_number = form.license_number
    if (form.bio)            payload.bio            = form.bio
    if (form.operatory_id)   payload.operatory_id   = Number(form.operatory_id)
    mutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}

      {/* Identity */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Identity</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Full Name" required error={fieldErr.name}>
              <input className={cn(iCls, fieldErr.name && 'border-red-500/40')} value={form.name} onChange={e => s('name')(e.target.value)} placeholder="Dr. Jane Smith" />
            </Field>
          </div>
          <Field label="Specialty" error={fieldErr.specialty}>
            <input className={iCls} value={form.specialty} onChange={e => s('specialty')(e.target.value)} placeholder="e.g. Orthodontist" />
          </Field>
          <Field label="License Number" error={fieldErr.license_number}>
            <input className={iCls} value={form.license_number} onChange={e => s('license_number')(e.target.value)} placeholder="LIC-00000" />
          </Field>
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" error={fieldErr.phone}>
            <input className={iCls} value={form.phone} onChange={e => s('phone')(e.target.value)} placeholder="+1 555 000 0000" />
          </Field>
          <Field label="Email" error={fieldErr.email}>
            <input type="email" className={iCls} value={form.email} onChange={e => s('email')(e.target.value)} placeholder="dr@clinic.com" />
          </Field>
        </div>
      </section>

      {/* Assignment */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Assignment</p>
        <Field label="Default Operatory">
          <select className={cn(iCls, 'bg-[#0f1120]', !form.operatory_id && 'text-zinc-600')} value={form.operatory_id} onChange={e => s('operatory_id')(e.target.value)}>
            <option value="">No operatory</option>
            {operatories?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
      </section>

      {/* Bio */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Bio</p>
        <textarea
          className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none resize-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          rows={3} value={form.bio} onChange={e => s('bio')(e.target.value)} placeholder="Short bio or notes about this provider…"
        />
      </section>

      {/* Active toggle */}
      <label className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg cursor-pointer select-none">
        <div>
          <p className="text-sm text-white font-medium">Active</p>
          <p className="text-xs text-zinc-500 mt-0.5">Can be assigned to appointments</p>
        </div>
        <button
          type="button"
          onClick={() => s('is_active')(!form.is_active)}
          className={cn('w-10 h-5 rounded-full transition-colors relative shrink-0',
            form.is_active ? 'bg-indigo-600' : 'bg-zinc-700',
          )}
        >
          <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            form.is_active ? 'translate-x-5' : 'translate-x-0.5',
          )} />
        </button>
      </label>

      {/* Footer */}
      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mutation.isPending ? 'Saving…' : mode === 'create' ? 'Create Provider' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

// ── Provider Card ─────────────────────────────────────────────────────────────

function ProviderCard({ provider, onEdit }: { provider: Provider; onEdit: (p: Provider) => void }) {
  const qc = useQueryClient()

  const toggleActive = useMutation({
    mutationFn: () => api.patch(`/providers/${provider.id}`, { is_active: !provider.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })

  return (
    <div className={cn(
      'bg-[#0f1120] border rounded-xl p-5 flex flex-col gap-4 transition-colors',
      provider.is_active ? 'border-white/[0.07]' : 'border-white/[0.04] opacity-60',
    )}>
      {/* Top: avatar + name + badge */}
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
          provider.is_active ? 'bg-indigo-500/15 text-indigo-300' : 'bg-zinc-700/40 text-zinc-500',
        )}>
          {initials(provider.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{provider.name}</p>
          {provider.specialty
            ? <p className="text-indigo-400/80 text-xs mt-0.5 truncate">{provider.specialty}</p>
            : <p className="text-zinc-600 text-xs mt-0.5">No specialty</p>
          }
        </div>
        <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0',
          provider.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-700/30 border-zinc-700/50',
        )}>
          {provider.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Info rows */}
      <div className="space-y-2 flex-1">
        {provider.email && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Mail className="w-3.5 h-3.5 text-zinc-600 shrink-0" strokeWidth={1.8} />
            <span className="truncate">{provider.email}</span>
          </div>
        )}
        {provider.phone && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Phone className="w-3.5 h-3.5 text-zinc-600 shrink-0" strokeWidth={1.8} />
            <span>{provider.phone}</span>
          </div>
        )}
        {provider.license_number && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <BadgeCheck className="w-3.5 h-3.5 text-zinc-600 shrink-0" strokeWidth={1.8} />
            <span className="font-mono">{provider.license_number}</span>
          </div>
        )}
        {provider.operatory && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Building2 className="w-3.5 h-3.5 text-zinc-600 shrink-0" strokeWidth={1.8} />
            <span>{provider.operatory.name}</span>
          </div>
        )}
        {provider.bio && (
          <div className="flex items-start gap-2 text-xs text-zinc-500 mt-1">
            <FileText className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-px" strokeWidth={1.8} />
            <span className="line-clamp-2 leading-relaxed">{provider.bio}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/[0.05]">
        <button
          onClick={() => onEdit(provider)}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.07] transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" strokeWidth={1.8} /> Edit
        </button>
        <button
          onClick={() => toggleActive.mutate()}
          disabled={toggleActive.isPending}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs border transition-colors',
            provider.is_active
              ? 'text-red-400 border-red-500/20 hover:bg-red-500/10'
              : 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10',
          )}
        >
          {toggleActive.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Power className="w-3.5 h-3.5" strokeWidth={1.8} />
          }
          {provider.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  )
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5 space-y-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-white/[0.05] shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 bg-white/[0.05] rounded w-32" />
          <div className="h-3 bg-white/[0.05] rounded w-20" />
        </div>
      </div>
      <div className="space-y-2">
        {Array(3).fill(0).map((_,i) => <div key={i} className="h-3 bg-white/[0.05] rounded w-full" />)}
      </div>
      <div className="flex gap-2 pt-1 border-t border-white/[0.05]">
        <div className="flex-1 h-8 bg-white/[0.04] rounded-lg" />
        <div className="flex-1 h-8 bg-white/[0.04] rounded-lg" />
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterState = 'active' | 'all' | 'inactive'

export default function ProvidersPage() {
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<FilterState>('active')
  const [page, setPage]         = useState(1)
  const [createOpen, setCreate] = useState(false)
  const [editing, setEditing]   = useState<Provider | null>(null)
  const dSearch = useDebounce(search, 350)

  const params: Record<string, string> = { page: String(page), per_page: '12' }
  if (dSearch) params.search = dSearch
  if (filter === 'active')   params.is_active = '1'
  if (filter === 'inactive') params.is_active = '0'

  const { data, isLoading } = useQuery({
    queryKey: ['providers', params],
    queryFn: () => api.get<PaginatedResponse<Provider>>('/providers', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  function onSearch(v: string) { setSearch(v); setPage(1) }
  function onFilter(v: FilterState) { setFilter(v); setPage(1) }

  const providers = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="max-w-6xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">Providers</h2>
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">
            {(meta?.total ?? 0).toLocaleString()}
          </span>
        </div>
        <button
          onClick={() => setCreate(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" strokeWidth={2} /> New Provider
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search} onChange={e => onSearch(e.target.value)}
            placeholder="Search name, specialty, email…"
            className="w-full h-9 pl-9 pr-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/15 transition-all"
          />
        </div>
        <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5">
          {(['active', 'all', 'inactive'] as FilterState[]).map(f => (
            <button key={f} onClick={() => onFilter(f)}
              className={cn('h-7 px-3 rounded-md text-xs font-medium transition-colors capitalize',
                filter === f ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >{f}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && Array(6).fill(0).map((_,i) => <SkeletonCard key={i} />)}
        {!isLoading && providers.length === 0 && (
          <div className="col-span-3 flex items-center justify-center h-48">
            <p className="text-zinc-600 text-sm">No providers found</p>
          </div>
        )}
        {!isLoading && providers.map(p => (
          <ProviderCard key={p.id} provider={p} onEdit={setEditing} />
        ))}
      </div>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-zinc-600 text-xs">
            {((meta.current_page - 1) * meta.per_page) + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={meta.current_page===1}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-zinc-500 text-xs px-2">{meta.current_page} / {meta.last_page}</span>
            <button onClick={() => setPage(p => Math.min(meta.last_page,p+1))} disabled={meta.current_page===meta.last_page}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Create Drawer */}
      <Drawer open={createOpen} onClose={() => setCreate(false)} title="New Provider">
        <ProviderForm mode="create" onSuccess={() => setCreate(false)} onClose={() => setCreate(false)} />
      </Drawer>

      {/* Edit Drawer */}
      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Edit Provider">
        {editing && (
          <ProviderForm
            mode="edit"
            providerId={editing.id}
            initial={{
              name: editing.name,
              specialty: editing.specialty ?? '',
              phone: editing.phone ?? '',
              email: editing.email ?? '',
              license_number: editing.license_number ?? '',
              bio: editing.bio ?? '',
              operatory_id: editing.operatory ? String(editing.operatory.id) : '',
              is_active: editing.is_active,
            }}
            onSuccess={() => setEditing(null)}
            onClose={() => setEditing(null)}
          />
        )}
      </Drawer>
    </div>
  )
}
