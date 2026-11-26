import { useRef, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ChevronLeft, ChevronRight, Loader2, X,
  AlertCircle, Bell, Check, BookOpen, Ban, Trash2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import type { PaginatedResponse } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type RecallStatus = 'pending' | 'sent' | 'booked' | 'dismissed'

interface Recall {
  id: number; patient_id: number; due_date: string
  status: RecallStatus; last_reminder_sent_at: string | null
  notes: string | null; patient: { id: number; full_name: string; phone: string | null; email: string | null }
  created_at: string
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<RecallStatus, { label: string; cls: string; icon: React.ElementType }> = {
  pending:   { label: 'Pending',   cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   icon: Bell    },
  sent:      { label: 'Sent',      cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         icon: Bell    },
  booked:    { label: 'Booked',    cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: BookOpen },
  dismissed: { label: 'Dismissed', cls: 'text-zinc-500 bg-zinc-700/30 border-zinc-700/50',     icon: Ban     },
}

function StatusBadge({ status }: { status: RecallStatus }) {
  const { label, cls } = STATUS_CFG[status]
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', cls)}>{label}</span>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function isOverdue(due: string) { return new Date(due) < new Date() }
function todayStr()             { return new Date().toISOString().slice(0, 10) }

// ── Shared UI ─────────────────────────────────────────────────────────────────

const iCls = 'w-full h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>
}

function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (<><div onClick={onClose} className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0 pointer-events-none')} /><div className={cn('fixed top-0 right-0 h-full w-full max-w-lg z-50 flex flex-col bg-[#0d0f1c] border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-in-out', open ? 'translate-x-0' : 'translate-x-full')}><div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0"><h2 className="text-white font-semibold">{title}</h2><button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4"/></button></div><div className="flex-1 overflow-y-auto">{children}</div></div></>)
}

// ── Patient typeahead ─────────────────────────────────────────────────────────

function PatientSearch({ value, onChange }: { value: { id: number; name: string } | null; onChange: (v: { id: number; name: string } | null) => void }) {
  const [q, setQ] = useState(value?.name ?? ''); const [open, setOpen] = useState(false)
  const dq = useDebounce(q, 300); const ref = useRef<HTMLDivElement>(null)
  const { data, isFetching } = useQuery({ queryKey: ['ps-recall', dq], queryFn: () => api.get<PaginatedResponse<{ id: number; full_name: string; phone: string | null }>>('/patients', { params: { search: dq, is_active: '1', per_page: '8' } }).then(r => r.data.data), enabled: open && dq.length > 0 })
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input className={cn(iCls, 'pl-9 pr-8')} value={q} placeholder="Search patient…" onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }} onFocus={() => setOpen(true)} />
        {value && <button onClick={() => { onChange(null); setQ('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>}
      </div>
      {open && q.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-[#141626] border border-white/[0.08] rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
          {isFetching && <div className="px-4 py-3 text-xs text-zinc-500">Searching…</div>}
          {!isFetching && !data?.length && <div className="px-4 py-3 text-xs text-zinc-600">No patients found</div>}
          {data?.map(p => (
            <button key={p.id} onClick={() => { onChange({ id: p.id, name: p.full_name }); setQ(p.full_name); setOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">{p.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</div>
              <div><p className="text-sm text-white">{p.full_name}</p>{p.phone && <p className="text-xs text-zinc-500">{p.phone}</p>}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Create Recall Form ────────────────────────────────────────────────────────

function CreateRecallForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(null)
  const [form, setForm] = useState({ due_date: '', notes: '' })
  const [err, setErr] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/recalls', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recalls'] }); onSuccess() },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create recall.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!patient) { setErr('Patient is required.'); return }
    if (!form.due_date) { setErr('Due date is required.'); return }
    const p: Record<string, unknown> = { patient_id: patient.id, due_date: form.due_date }
    if (form.notes) p.notes = form.notes
    mutation.mutate(p)
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}
      <Field label="Patient" required><PatientSearch value={patient} onChange={setPatient} /></Field>
      <Field label="Due Date" required>
        <input type="date" className={iCls} value={form.due_date} min={todayStr()} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
      </Field>
      <Field label="Notes">
        <textarea className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none resize-none focus:border-indigo-500/50 transition-all" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for recall, special notes…" />
      </Field>
      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{mutation.isPending ? 'Saving…' : 'Create Recall'}
        </button>
      </div>
    </form>
  )
}

// ── Row actions ───────────────────────────────────────────────────────────────

function RecallActions({ recall }: { recall: Recall }) {
  const qc = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: (status: RecallStatus) => api.patch(`/recalls/${recall.id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recalls'] }),
  })
  const reminderMutation = useMutation({
    mutationFn: () => api.post(`/recalls/${recall.id}/send-reminder`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recalls'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/recalls/${recall.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recalls'] }),
  })

  const isBusy = statusMutation.isPending || reminderMutation.isPending || deleteMutation.isPending

  return (
    <div className="flex items-center gap-1">
      {/* Send Reminder — only for pending/sent */}
      {(recall.status === 'pending' || recall.status === 'sent') && (
        <button onClick={() => reminderMutation.mutate()} disabled={isBusy}
          className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-sky-400 hover:bg-sky-500/10 border border-transparent hover:border-sky-500/20 transition-colors disabled:opacity-50"
          title="Send reminder">
          {reminderMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" strokeWidth={1.8} />}
          Remind
        </button>
      )}
      {/* Mark Booked */}
      {(recall.status === 'pending' || recall.status === 'sent') && (
        <button onClick={() => statusMutation.mutate('booked')} disabled={isBusy}
          className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-colors disabled:opacity-50"
          title="Mark as booked">
          {statusMutation.isPending && statusMutation.variables === 'booked' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" strokeWidth={2} />}
          Booked
        </button>
      )}
      {/* Dismiss */}
      {recall.status !== 'dismissed' && recall.status !== 'booked' && (
        <button onClick={() => statusMutation.mutate('dismissed')} disabled={isBusy}
          className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
          title="Dismiss">
          <Ban className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
      )}
      {/* Delete */}
      <button onClick={() => { if (confirm('Delete recall?')) deleteMutation.mutate() }} disabled={isBusy}
        className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
        title="Delete">
        {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />}
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'due' | 'pending' | 'sent' | 'booked' | 'dismissed'

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',       label: 'All'       },
  { id: 'due',       label: '⚠ Due Now' },
  { id: 'pending',   label: 'Pending'   },
  { id: 'sent',      label: 'Sent'      },
  { id: 'booked',    label: 'Booked'    },
  { id: 'dismissed', label: 'Dismissed' },
]

export default function RecallsPage() {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [page, setPage]     = useState(1)
  const [createOpen, setC]  = useState(false)
  const qc = useQueryClient()

  const isDue = filter === 'due'

  const params: Record<string, string> = { page: String(page) }
  if (!isDue && filter !== 'all') params.status = filter

  const { data, isLoading } = useQuery({
    queryKey: ['recalls', filter, page],
    queryFn: () => {
      const url = isDue ? '/recalls/due' : '/recalls'
      return api.get<PaginatedResponse<Recall>>(url, { params }).then(r => r.data)
    },
    placeholderData: prev => prev,
  })

  function changeFilter(f: FilterTab) { setFilter(f); setPage(1) }

  const recalls = data?.data ?? []
  const meta    = data?.meta

  return (
    <div className="max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">Recalls</h2>
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">{(meta?.total ?? 0).toLocaleString()}</span>
        </div>
        <button onClick={() => setC(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" strokeWidth={2} /> New Recall
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5 w-fit flex-wrap">
        {FILTER_TABS.map(f => (
          <button key={f.id} onClick={() => changeFilter(f.id)}
            className={cn('h-7 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
              filter === f.id
                ? f.id === 'due' ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200',
            )}>{f.label}</button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Patient', 'Due Date', 'Status', 'Last Reminder', 'Notes', 'Actions'].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array(6).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array(6).fill(0).map((_, j) => <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/[0.05] rounded animate-pulse w-24" /></td>)}
                </tr>
              ))}
              {!isLoading && recalls.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-16 text-center text-zinc-600 text-sm">No recalls found</td></tr>
              )}
              {!isLoading && recalls.map(r => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-3">
                    <p className="text-white text-xs font-medium">{r.patient.full_name}</p>
                    {r.patient.phone && <p className="text-zinc-600 text-xs">{r.patient.phone}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className={cn('text-xs font-medium', isOverdue(r.due_date) && r.status === 'pending' ? 'text-red-400' : 'text-zinc-300')}>{fmtDate(r.due_date)}</p>
                    {isOverdue(r.due_date) && r.status === 'pending' && <p className="text-[10px] text-red-500">Overdue</p>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                    {r.last_reminder_sent_at ? fmtDate(r.last_reminder_sent_at) : <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs max-w-[200px] truncate">
                    {r.notes ?? <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <RecallActions recall={r} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-zinc-600 text-xs">{((meta.current_page - 1) * meta.per_page) + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={meta.current_page === 1} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-zinc-500 text-xs px-2">{meta.current_page} / {meta.last_page}</span>
              <button onClick={() => setPage(p => Math.min(meta.last_page, p + 1))} disabled={meta.current_page === meta.last_page} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      <Drawer open={createOpen} onClose={() => setC(false)} title="New Recall">
        <CreateRecallForm onSuccess={() => setC(false)} onClose={() => setC(false)} />
      </Drawer>
    </div>
  )
}
