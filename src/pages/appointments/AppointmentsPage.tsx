import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ChevronLeft, ChevronRight,
  Loader2, X, AlertCircle, Check, Ban, UserX, Clock,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import type { PaginatedResponse } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type Status = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

interface Appointment {
  id: number
  patient_id: number; provider_id: number
  appointment_type_id: number | null; operatory_id: number | null
  start_at: string; end_at: string
  status: Status
  chief_complaint: string | null; notes: string | null; color: string | null
  cancelled_at: string | null
  patient:  { id: number; full_name: string; phone: string | null }
  provider: { id: number; name: string; specialty: string | null }
  appointment_type: { id: number; name: string; color: string | null } | null
  operatory: { id: number; name: string } | null
}

interface Provider       { id: number; name: string; specialty: string | null; is_active: boolean }
interface AppointmentType{ id: number; name: string; default_duration_minutes: number; color: string | null; is_active: boolean }
interface Operatory      { id: number; name: string; is_active: boolean }
interface PatientOption  { id: number; full_name: string; phone: string | null }

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<Status, { label: string; badge: string }> = {
  scheduled: { label: 'Scheduled', badge: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  confirmed: { label: 'Confirmed', badge: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  completed: { label: 'Completed', badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  cancelled: { label: 'Cancelled', badge: 'text-red-400 bg-red-500/10 border-red-500/20' },
  no_show:   { label: 'No Show',   badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
}

const TRANSITIONS: Record<Status, { status: Status; label: string; cls: string; icon: React.ElementType }[]> = {
  scheduled: [
    { status: 'confirmed', label: 'Confirm',  cls: 'text-sky-400 hover:bg-sky-500/10',     icon: Check },
    { status: 'cancelled', label: 'Cancel',   cls: 'text-red-400 hover:bg-red-500/10',     icon: Ban   },
  ],
  confirmed: [
    { status: 'completed', label: 'Complete', cls: 'text-emerald-400 hover:bg-emerald-500/10', icon: Check  },
    { status: 'no_show',   label: 'No Show',  cls: 'text-amber-400 hover:bg-amber-500/10',     icon: UserX  },
    { status: 'cancelled', label: 'Cancel',   cls: 'text-red-400 hover:bg-red-500/10',         icon: Ban    },
  ],
  completed: [], cancelled: [], no_show: [],
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function duration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  return mins >= 60 ? `${Math.floor(mins/60)}h${mins%60 ? ` ${mins%60}m` : ''}` : `${mins}m`
}
function initials(name: string) { return name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() }
function todayStr() { return new Date().toISOString().slice(0,10) }

// ── Shared UI ─────────────────────────────────────────────────────────────────

const iCls = 'w-full h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', cfg.badge)}>
      {cfg.label}
    </span>
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

// ── Patient typeahead ─────────────────────────────────────────────────────────

function PatientSearch({ value, onChange }: { value: { id: number; name: string } | null; onChange: (v: { id: number; name: string } | null) => void }) {
  const [q, setQ]           = useState(value?.name ?? '')
  const [open, setOpen]     = useState(false)
  const dq                  = useDebounce(q, 300)
  const ref                 = useRef<HTMLDivElement>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['patient-search', dq],
    queryFn: () => api.get<PaginatedResponse<PatientOption>>('/patients', { params: { search: dq, is_active: '1', per_page: '8' } }).then(r => r.data.data),
    enabled: open && dq.length > 0,
  })

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function select(p: PatientOption) {
    onChange({ id: p.id, name: p.full_name })
    setQ(p.full_name)
    setOpen(false)
  }

  function clear() { onChange(null); setQ('') }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input
          className={cn(iCls, 'pl-9 pr-8')}
          value={q}
          placeholder="Search patient…"
          onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }}
          onFocus={() => setOpen(true)}
        />
        {value && <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>}
      </div>
      {open && q.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-[#141626] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 max-h-52 overflow-y-auto">
          {isFetching && <div className="px-4 py-3 text-xs text-zinc-500">Searching…</div>}
          {!isFetching && (!data || data.length === 0) && <div className="px-4 py-3 text-xs text-zinc-600">No patients found</div>}
          {!isFetching && data?.map(p => (
            <button key={p.id} onClick={() => select(p)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">{initials(p.full_name)}</div>
              <div>
                <p className="text-sm text-white">{p.full_name}</p>
                {p.phone && <p className="text-xs text-zinc-500">{p.phone}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── New Appointment Form ──────────────────────────────────────────────────────

const EMPTY_FORM = {
  date: todayStr(), start_time: '09:00', end_time: '09:30',
  status: 'scheduled' as Status,
  chief_complaint: '', notes: '',
  provider_id: '', appointment_type_id: '', operatory_id: '',
}

function NewAppointmentForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [form, setForm]   = useState(EMPTY_FORM)
  const [patient, setPt]  = useState<{ id: number; name: string } | null>(null)
  const [err, setErr]     = useState('')
  const [fieldErr, setFE] = useState<Record<string, string>>({})
  const qc = useQueryClient()

  const { data: providers } = useQuery({ queryKey: ['providers-list'], queryFn: () => api.get<{ data: Provider[] }>('/providers', { params: { is_active: '1', per_page: '100' } }).then(r => r.data.data) })
  const { data: types }     = useQuery({ queryKey: ['appt-types-list'], queryFn: () => api.get<{ data: AppointmentType[] }>('/appointment-types', { params: { is_active: '1', per_page: '100' } }).then(r => r.data.data) })
  const { data: operatories}= useQuery({ queryKey: ['operatories-list'], queryFn: () => api.get<{ data: Operatory[] }>('/operatories', { params: { is_active: '1', per_page: '100' } }).then(r => r.data.data) })

  const mutation = useMutation({
    mutationFn: (d: Record<string, string | number>) => api.post('/appointments', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); onSuccess() },
    onError: (e: unknown) => {
      const r = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
      if (r?.errors) { const flat: Record<string,string>={}; Object.entries(r.errors).forEach(([k,v])=>{flat[k]=v[0]}); setFE(flat) }
      else setErr(r?.message ?? 'Failed to create appointment.')
    },
  })

  function s(k: string) { return (v: string) => { setForm(f => ({ ...f, [k]: v })); setFE(fe => ({ ...fe, [k]: '' })) } }

  function onTypeChange(typeId: string) {
    s('appointment_type_id')(typeId)
    if (typeId && types) {
      const t = types.find(t => String(t.id) === typeId)
      if (t) {
        const [h, m] = form.start_time.split(':').map(Number)
        const endMins = h * 60 + m + t.default_duration_minutes
        const endH = String(Math.floor(endMins / 60) % 24).padStart(2, '0')
        const endM = String(endMins % 60).padStart(2, '0')
        setForm(f => ({ ...f, appointment_type_id: typeId, end_time: `${endH}:${endM}` }))
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setFE({})
    if (!patient) { setFE(fe => ({ ...fe, patient_id: 'Required' })); return }
    if (!form.provider_id) { setFE(fe => ({ ...fe, provider_id: 'Required' })); return }
    const payload: Record<string, string | number> = {
      patient_id: patient.id,
      provider_id: Number(form.provider_id),
      start_at: `${form.date}T${form.start_time}:00`,
      end_at:   `${form.date}T${form.end_time}:00`,
      status: form.status,
    }
    if (form.appointment_type_id) payload.appointment_type_id = Number(form.appointment_type_id)
    if (form.operatory_id)        payload.operatory_id        = Number(form.operatory_id)
    if (form.chief_complaint)     payload.chief_complaint     = form.chief_complaint
    if (form.notes)               payload.notes               = form.notes
    mutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}

      {/* Patient */}
      <Field label="Patient" required>
        <PatientSearch value={patient} onChange={setPt} />
        {fieldErr.patient_id && <p className="text-xs text-red-400 mt-1">{fieldErr.patient_id}</p>}
      </Field>

      {/* Provider */}
      <Field label="Provider" required>
        <select className={cn(iCls, 'bg-[#0f1120]', !form.provider_id && 'text-zinc-600')} value={form.provider_id} onChange={e => s('provider_id')(e.target.value)}>
          <option value="">Select provider…</option>
          {providers?.map(p => <option key={p.id} value={p.id}>{p.name}{p.specialty ? ` — ${p.specialty}` : ''}</option>)}
        </select>
        {fieldErr.provider_id && <p className="text-xs text-red-400 mt-1">{fieldErr.provider_id}</p>}
      </Field>

      {/* Date + Times */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 sm:col-span-1">
          <Field label="Date" required><input type="date" className={iCls} value={form.date} onChange={e => s('date')(e.target.value)} /></Field>
        </div>
        <Field label="Start Time" required>
          <input type="time" className={iCls} value={form.start_time} onChange={e => s('start_time')(e.target.value)} />
          {fieldErr.start_at && <p className="text-xs text-red-400 mt-1">{fieldErr.start_at}</p>}
        </Field>
        <Field label="End Time" required>
          <input type="time" className={iCls} value={form.end_time} onChange={e => s('end_time')(e.target.value)} />
          {fieldErr.end_at && <p className="text-xs text-red-400 mt-1">{fieldErr.end_at}</p>}
        </Field>
      </div>

      {/* Type + Operatory */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select className={cn(iCls, 'bg-[#0f1120]', !form.appointment_type_id && 'text-zinc-600')} value={form.appointment_type_id} onChange={e => onTypeChange(e.target.value)}>
            <option value="">Select type…</option>
            {types?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.default_duration_minutes}m)</option>)}
          </select>
        </Field>
        <Field label="Operatory">
          <select className={cn(iCls, 'bg-[#0f1120]', !form.operatory_id && 'text-zinc-600')} value={form.operatory_id} onChange={e => s('operatory_id')(e.target.value)}>
            <option value="">Select operatory…</option>
            {operatories?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
      </div>

      {/* Status */}
      <Field label="Status">
        <select className={cn(iCls, 'bg-[#0f1120]')} value={form.status} onChange={e => s('status')(e.target.value as Status)}>
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
        </select>
      </Field>

      {/* Chief Complaint */}
      <Field label="Chief Complaint">
        <textarea className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none resize-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all" rows={2} value={form.chief_complaint} onChange={e => s('chief_complaint')(e.target.value)} placeholder="Reason for visit…" />
      </Field>

      {/* Notes */}
      <Field label="Notes">
        <textarea className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none resize-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all" rows={2} value={form.notes} onChange={e => s('notes')(e.target.value)} placeholder="Internal notes…" />
      </Field>

      {/* Footer */}
      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mutation.isPending ? 'Saving…' : 'Create Appointment'}
        </button>
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show',   label: 'No Show'   },
]

export default function AppointmentsPage() {
  const [status, setStatus]     = useState('')
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo]     = useState('')
  const [page, setPage]         = useState(1)
  const [drawer, setDrawer]     = useState(false)
  const qc = useQueryClient()

  const params: Record<string, string> = { page: String(page) }
  if (status)   params.status    = status
  if (dateFrom) params.date_from = dateFrom
  if (dateTo)   params.date_to   = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', params],
    queryFn: () => api.get<PaginatedResponse<Appointment>>('/appointments', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, s }: { id: number; s: Status }) => api.patch(`/appointments/${id}`, { status: s }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  })

  function changeStatus(id: number, s: Status) { statusMutation.mutate({ id, s }) }

  function onFilterStatus(v: string) { setStatus(v); setPage(1) }

  const appointments = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="max-w-7xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">Appointments</h2>
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">
            {(meta?.total ?? 0).toLocaleString()}
          </span>
        </div>
        <button
          onClick={() => setDrawer(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" strokeWidth={2} /> New Appointment
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date range */}
        <div className="flex items-center gap-2">
          <input
            type="date" value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/40 transition-all"
          />
          <span className="text-zinc-600 text-xs">to</span>
          <input
            type="date" value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/40 transition-all"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => onFilterStatus(f.value)}
              className={cn('h-7 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                status === f.value ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Date & Time', 'Patient', 'Provider', 'Type', 'Duration', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array(8).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array(7).fill(0).map((_, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/[0.05] rounded animate-pulse w-24" /></td>
                  ))}
                </tr>
              ))}

              {!isLoading && appointments.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-zinc-600 text-sm">No appointments found</td></tr>
              )}

              {!isLoading && appointments.map(a => {
                const transitions = TRANSITIONS[a.status]
                return (
                  <tr key={a.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                    {/* Date/Time */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-white text-xs font-medium">{fmtDate(a.start_at)}</p>
                      <p className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" strokeWidth={1.8} />
                        {fmtTime(a.start_at)} – {fmtTime(a.end_at)}
                      </p>
                    </td>

                    {/* Patient */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                          {initials(a.patient.full_name)}
                        </div>
                        <div>
                          <p className="text-white text-xs font-medium whitespace-nowrap">{a.patient.full_name}</p>
                          {a.patient.phone && <p className="text-zinc-600 text-xs">{a.patient.phone}</p>}
                        </div>
                      </div>
                    </td>

                    {/* Provider */}
                    <td className="px-4 py-3">
                      <p className="text-zinc-300 text-xs whitespace-nowrap">{a.provider.name}</p>
                      {a.provider.specialty && <p className="text-zinc-600 text-xs">{a.provider.specialty}</p>}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      {a.appointment_type ? (
                        <span className="text-xs text-zinc-300 bg-white/[0.05] border border-white/[0.07] rounded px-2 py-0.5 whitespace-nowrap">
                          {a.appointment_type.name}
                        </span>
                      ) : <span className="text-zinc-700 text-xs">—</span>}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{duration(a.start_at, a.end_at)}</td>

                    {/* Status */}
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {transitions.length > 0 && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {transitions.map(t => {
                            const Icon = t.icon
                            const busy = statusMutation.isPending && statusMutation.variables?.id === a.id && statusMutation.variables?.s === t.status
                            return (
                              <button
                                key={t.status}
                                onClick={() => changeStatus(a.id, t.status)}
                                disabled={statusMutation.isPending}
                                className={cn('flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium transition-colors border border-transparent hover:border-current', t.cls)}
                              >
                                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" strokeWidth={2} />}
                                {t.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={meta.current_page === 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-zinc-500 text-xs px-2">{meta.current_page} / {meta.last_page}</span>
              <button onClick={() => setPage(p => Math.min(meta.last_page, p + 1))} disabled={meta.current_page === meta.last_page}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="New Appointment">
        <NewAppointmentForm onSuccess={() => setDrawer(false)} onClose={() => setDrawer(false)} />
      </Drawer>
    </div>
  )
}
