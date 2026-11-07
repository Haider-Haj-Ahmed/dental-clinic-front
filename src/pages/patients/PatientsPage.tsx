import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, ChevronLeft, ChevronRight,
  UserX, Eye, Loader2, X, AlertCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import type { PaginatedResponse } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: number
  first_name: string
  last_name: string
  full_name: string
  gender: 'male' | 'female' | 'other' | null
  date_of_birth: string | null
  phone: string | null
  email: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  blood_type: string | null
  medical_alerts: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  deleted_at: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAge(dob: string | null): string {
  if (!dob) return ''
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  return `${y}y`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ── Small components ─────────────────────────────────────────────────────────

function Avatar({ name, archived }: { name: string; archived?: boolean }) {
  return (
    <div className={cn(
      'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
      archived ? 'bg-zinc-700/40 text-zinc-500' : 'bg-indigo-500/15 text-indigo-300',
    )}>
      {initials(name)}
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
      active
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : 'bg-zinc-700/30 text-zinc-500 border-zinc-700/50',
    )}>
      {active ? 'Active' : 'Archived'}
    </span>
  )
}

// ── Form primitives ───────────────────────────────────────────────────────────

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

const inputCls = cn(
  'w-full h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08]',
  'placeholder:text-zinc-600 outline-none transition-all',
  'focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20',
)

const textareaCls = cn(
  'w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08]',
  'placeholder:text-zinc-600 outline-none resize-none transition-all',
  'focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20',
)

// ── Drawer ────────────────────────────────────────────────────────────────────

function Drawer({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />
      <div className={cn(
        'fixed top-0 right-0 h-full w-full max-w-lg z-50 flex flex-col',
        'bg-[#0d0f1c] border-l border-white/[0.07] shadow-2xl shadow-black/60',
        'transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
          <h2 className="text-white font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  )
}

// ── New Patient Form ──────────────────────────────────────────────────────────

const EMPTY: Record<string, string> = {
  first_name: '', last_name: '', gender: '', date_of_birth: '',
  phone: '', email: '', address: '',
  emergency_contact_name: '', emergency_contact_phone: '',
  blood_type: '', medical_alerts: '', notes: '',
}

function NewPatientForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [form, setForm]         = useState<Record<string, string>>(EMPTY)
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [serverError, setSrv]   = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.post('/patients', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patients'] }); onSuccess() },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      if (e.response?.data?.errors) {
        const flat: Record<string, string> = {}
        Object.entries(e.response.data.errors).forEach(([k, v]) => { flat[k] = v[0] })
        setErrors(flat)
      } else {
        setSrv(e.response?.data?.message ?? 'Failed to create patient.')
      }
    },
  })

  function set(k: string) {
    return (v: string) => {
      setForm(f => ({ ...f, [k]: v }))
      setErrors(e => ({ ...e, [k]: '' }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSrv('')
    const errs: Record<string, string> = {}
    if (!form.first_name.trim()) errs.first_name = 'Required'
    if (!form.last_name.trim())  errs.last_name  = 'Required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    const payload: Record<string, string> = {}
    Object.entries(form).forEach(([k, v]) => { if (v) payload[k] = v })
    mutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6" noValidate>

      {serverError && (
        <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{serverError}</span>
        </div>
      )}

      {/* Basic */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Basic Info</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" required error={errors.first_name}>
            <input className={cn(inputCls, errors.first_name && 'border-red-500/40')} value={form.first_name} onChange={e => set('first_name')(e.target.value)} placeholder="Jane" />
          </Field>
          <Field label="Last Name" required error={errors.last_name}>
            <input className={cn(inputCls, errors.last_name && 'border-red-500/40')} value={form.last_name} onChange={e => set('last_name')(e.target.value)} placeholder="Doe" />
          </Field>
          <Field label="Gender">
            <select className={cn(inputCls, 'bg-[#0f1120]', !form.gender && 'text-zinc-600')} value={form.gender} onChange={e => set('gender')(e.target.value)}>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Date of Birth">
            <input type="date" className={inputCls} value={form.date_of_birth} onChange={e => set('date_of_birth')(e.target.value)} />
          </Field>
          <Field label="Blood Type">
            <select className={cn(inputCls, 'bg-[#0f1120]', !form.blood_type && 'text-zinc-600')} value={form.blood_type} onChange={e => set('blood_type')(e.target.value)}>
              <option value="">Select…</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className={inputCls} value={form.phone} onChange={e => set('phone')(e.target.value)} placeholder="+1 555 000 0000" />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={form.email} onChange={e => set('email')(e.target.value)} placeholder="jane@email.com" />
          </Field>
        </div>
        <Field label="Address">
          <textarea className={textareaCls} rows={2} value={form.address} onChange={e => set('address')(e.target.value)} placeholder="Street, City, Country" />
        </Field>
      </section>

      {/* Emergency */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Emergency Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input className={inputCls} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name')(e.target.value)} placeholder="Contact name" />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone')(e.target.value)} placeholder="+1 555 000 0000" />
          </Field>
        </div>
      </section>

      {/* Medical */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Medical</p>
        <Field label="Medical Alerts">
          <textarea className={textareaCls} rows={2} value={form.medical_alerts} onChange={e => set('medical_alerts')(e.target.value)} placeholder="Allergies, conditions, special care notes…" />
        </Field>
        <Field label="Notes">
          <textarea className={textareaCls} rows={2} value={form.notes} onChange={e => set('notes')(e.target.value)} placeholder="Internal notes…" />
        </Field>
      </section>

      {/* Footer */}
      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose}
          className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mutation.isPending ? 'Saving…' : 'Create Patient'}
        </button>
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const navigate = useNavigate()
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<'active' | 'all' | 'archived'>('active')
  const [page, setPage]         = useState(1)
  const [drawerOpen, setDrawer] = useState(false)
  const dSearch = useDebounce(search, 350)

  const params: Record<string, string> = { page: String(page) }
  if (dSearch)             params.search        = dSearch
  if (filter === 'active') params.is_active     = '1'
  if (filter === 'archived') { params.is_active = '0'; params.with_archived = '1' }
  if (filter === 'all')    params.with_archived = '1'

  const { data, isLoading } = useQuery({
    queryKey: ['patients', params],
    queryFn: () => api.get<PaginatedResponse<Patient>>('/patients', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const qc = useQueryClient()
  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/patients/${id}/archive`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  })

  function onSearch(v: string) { setSearch(v); setPage(1) }
  function onFilter(v: typeof filter) { setFilter(v); setPage(1) }

  const patients = data?.data ?? []
  const meta     = data?.meta

  return (
    <div className="max-w-6xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">Patients</h2>
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">
            {(meta?.total ?? 0).toLocaleString()}
          </span>
        </div>
        <button
          onClick={() => setDrawer(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          New Patient
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search name, phone, email…"
            className="w-full h-9 pl-9 pr-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/15 transition-all"
          />
        </div>
        <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5">
          {(['active', 'all', 'archived'] as const).map(f => (
            <button
              key={f}
              onClick={() => onFilter(f)}
              className={cn(
                'h-7 px-3 rounded-md text-xs font-medium transition-colors capitalize',
                filter === f ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Patient', 'Date of Birth', 'Phone', 'Blood', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array(8).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array(6).fill(0).map((_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="h-3 bg-white/[0.05] rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && patients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-zinc-600 text-sm">
                    No patients found
                  </td>
                </tr>
              )}

              {!isLoading && patients.map(p => (
                <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.full_name} archived={!p.is_active} />
                      <div>
                        <p className={cn('font-medium leading-none', p.is_active ? 'text-white' : 'text-zinc-500')}>
                          {p.full_name}
                        </p>
                        {p.email && <p className="text-zinc-600 text-xs mt-1">{p.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap text-xs">
                    {p.date_of_birth
                      ? <>{fmtDate(p.date_of_birth)} <span className="text-zinc-600">· {getAge(p.date_of_birth)}</span></>
                      : <span className="text-zinc-700">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                    {p.phone ?? <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {p.blood_type
                      ? <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/15 rounded px-1.5 py-0.5">{p.blood_type}</span>
                      : <span className="text-zinc-700 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3"><StatusBadge active={p.is_active} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button
                        onClick={() => navigate(`/patients/${p.id}`)}
                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" strokeWidth={1.8} /> View
                      </button>
                      {p.is_active && (
                        <button
                          onClick={() => archiveMutation.mutate(p.id)}
                          disabled={archiveMutation.isPending}
                          className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" strokeWidth={1.8} /> Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-zinc-600 text-xs">
              {((meta.current_page - 1) * meta.per_page) + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={meta.current_page === 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-zinc-500 text-xs px-2">{meta.current_page} / {meta.last_page}</span>
              <button
                onClick={() => setPage(p => Math.min(meta.last_page, p + 1))}
                disabled={meta.current_page === meta.last_page}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawer(false)} title="New Patient">
        <NewPatientForm onSuccess={() => setDrawer(false)} onClose={() => setDrawer(false)} />
      </Drawer>
    </div>
  )
}
