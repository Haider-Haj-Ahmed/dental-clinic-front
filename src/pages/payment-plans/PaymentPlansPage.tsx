import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, ChevronLeft, ChevronRight, Loader2, X, AlertCircle,
  Ban, Calendar, CreditCard,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { PaginatedResponse } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type PlanStatus = 'active' | 'completed' | 'cancelled'
type Frequency  = 'weekly' | 'biweekly' | 'monthly'

interface PaymentPlan {
  id: number; invoice_id: number; status: PlanStatus
  total_amount: number; installments: number; installment_amount: number
  frequency: Frequency; start_date: string; next_due_date: string | null
  paid_installments: number; notes: string | null
  invoice: { id: number }
  patient: { id: number; full_name: string }
  created_at: string
}

interface InvoiceOption { id: number; total: number; patient: { full_name: string } }

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function invoiceNo(id: number) { return `#${String(id).padStart(5, '0')}` }
function planNo(id: number)    { return `PP-${String(id).padStart(5, '0')}` }
function todayStr()            { return new Date().toISOString().slice(0, 10) }

const STATUS_CFG: Record<PlanStatus, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  completed: { label: 'Completed', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20'            },
  cancelled: { label: 'Cancelled', cls: 'text-red-400 bg-red-500/10 border-red-500/20'            },
}

const FREQ_LABEL: Record<Frequency, string> = {
  weekly:   'Weekly',
  biweekly: 'Bi-weekly',
  monthly:  'Monthly',
}

function StatusBadge({ status }: { status: PlanStatus }) {
  const { label, cls } = STATUS_CFG[status]
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', cls)}>{label}</span>
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const iCls = 'w-full h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (<><div onClick={onClose} className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0 pointer-events-none')} /><div className={cn('fixed top-0 right-0 h-full w-full max-w-lg z-50 flex flex-col bg-[#0d0f1c] border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-in-out', open ? 'translate-x-0' : 'translate-x-full')}><div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0"><h2 className="text-white font-semibold">{title}</h2><button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button></div><div className="flex-1 overflow-y-auto">{children}</div></div></>)
}

// ── Create Form ───────────────────────────────────────────────────────────────

function CreatePlanForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    invoice_id: '', installments: '3', frequency: 'monthly' as Frequency, start_date: todayStr(), notes: '',
  })
  const [err, setErr] = useState('')
  const qc = useQueryClient()

  // Load invoices that have a balance (finalized or partial)
  const { data: invoices } = useQuery({
    queryKey: ['invoices-with-balance'],
    queryFn: () => api.get<PaginatedResponse<InvoiceOption>>('/invoices', {
      params: { status: 'finalized,partial', per_page: '100' }
    }).then(r => r.data.data),
  })

  const mutation = useMutation({
    mutationFn: (d: Record<string, string | number>) => api.post('/payment-plans', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-plans'] }); onSuccess() },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create payment plan.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!form.invoice_id) { setErr('Please select an invoice.'); return }
    if (!form.installments || parseInt(form.installments) < 2) { setErr('Minimum 2 installments.'); return }
    const payload: Record<string, string | number> = {
      invoice_id: Number(form.invoice_id),
      installments: parseInt(form.installments),
      frequency: form.frequency,
      start_date: form.start_date,
    }
    if (form.notes) payload.notes = form.notes
    mutation.mutate(payload)
  }

  const selectedInvoice = invoices?.find(i => String(i.id) === form.invoice_id)
  const previewInstallment = selectedInvoice
    ? selectedInvoice.total / parseInt(form.installments || '1')
    : null

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}

      <Field label="Invoice" required>
        <select
          className={cn(iCls, 'bg-[#0f1120]', !form.invoice_id && 'text-zinc-600')}
          value={form.invoice_id}
          onChange={e => setForm(f => ({ ...f, invoice_id: e.target.value }))}
        >
          <option value="">Select invoice…</option>
          {invoices?.map(inv => (
            <option key={inv.id} value={inv.id}>
              {invoiceNo(inv.id)} — {inv.patient.full_name} ({fmtCurrency(inv.total)})
            </option>
          ))}
        </select>
        {invoices?.length === 0 && <p className="text-xs text-zinc-600 mt-1">No invoices with outstanding balance found.</p>}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Number of Installments" required>
          <input
            type="number" min="2" max="60" className={iCls}
            value={form.installments}
            onChange={e => setForm(f => ({ ...f, installments: e.target.value }))}
          />
        </Field>
        <Field label="Frequency" required>
          <select className={cn(iCls, 'bg-[#0f1120]')} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Frequency }))}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        <Field label="Start Date" required>
          <input type="date" className={iCls} value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
        </Field>
        <Field label="Notes">
          <input className={iCls} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
        </Field>
      </div>

      {/* Preview */}
      {previewInstallment !== null && (
        <div className="bg-indigo-500/[0.06] border border-indigo-500/20 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Payment Schedule Preview</p>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Per Installment</p>
              <p className="text-white font-bold text-lg font-mono">{fmtCurrency(previewInstallment)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Total</p>
              <p className="text-zinc-200 text-sm font-mono">{fmtCurrency(selectedInvoice!.total)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Frequency</p>
              <p className="text-zinc-200 text-sm">{FREQ_LABEL[form.frequency]}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending}
          className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mutation.isPending ? 'Creating…' : 'Create Payment Plan'}
        </button>
      </div>
    </form>
  )
}

// ── Plan Detail ───────────────────────────────────────────────────────────────

function PlanDetail({ planId, onClose }: { planId: number; onClose: () => void }) {
  const qc = useQueryClient()

  const { data: plan, isLoading } = useQuery({
    queryKey: ['payment-plan', planId],
    queryFn: () => api.get<{ data: PaymentPlan }>(`/payment-plans/${planId}`).then(r => r.data.data),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/payment-plans/${planId}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-plans'] }); qc.invalidateQueries({ queryKey: ['payment-plan', planId] }) },
  })

  if (isLoading) return <div className="p-6 space-y-4 animate-pulse">{Array(5).fill(0).map((_,i) => <div key={i} className="h-10 bg-white/[0.05] rounded-lg" />)}</div>
  if (!plan) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-bold text-lg font-mono">{planNo(plan.id)}</span>
            <StatusBadge status={plan.status} />
          </div>
          <p className="text-sm text-white font-medium">{plan.patient.full_name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Invoice {invoiceNo(plan.invoice_id)}</p>
        </div>
        <div className="text-right">
          <p className="text-white text-xl font-bold font-mono">{fmtCurrency(plan.total_amount)}</p>
          <p className="text-zinc-500 text-xs mt-0.5">total amount</p>
        </div>
      </div>

      {/* Plan summary */}
      <div className="grid grid-cols-2 gap-4">
        {[
          ['Installments',       `${plan.installments} × ${fmtCurrency(plan.installment_amount)}`],
          ['Frequency',          FREQ_LABEL[plan.frequency]],
          ['Start Date',         fmtDate(plan.start_date)],
          ['Next Due',           fmtDate(plan.next_due_date)],
          ['Paid',               `${plan.paid_installments} of ${plan.installments}`],
          ['Remaining',          `${plan.installments - plan.paid_installments} payments`],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold mb-0.5">{label}</p>
            <p className="text-sm text-zinc-200">{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-zinc-500">Progress</p>
          <p className="text-xs text-zinc-500">{Math.round((plan.paid_installments / plan.installments) * 100)}%</p>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${(plan.paid_installments / plan.installments) * 100}%` }}
          />
        </div>
      </div>

      {plan.notes && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Notes</p>
          <p className="text-sm text-zinc-400">{plan.notes}</p>
        </div>
      )}

      {/* Actions */}
      {plan.status === 'active' && (
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            onClick={() => { if (confirm('Cancel this payment plan?')) cancelMutation.mutate() }}
            disabled={cancelMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {cancelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" strokeWidth={1.8} />}
            Cancel Plan
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: '', label: 'All' }, { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' },
]

export default function PaymentPlansPage() {
  const [status, setStatus]       = useState('')
  const [page, setPage]           = useState(1)
  const [createOpen, setCreate]   = useState(false)
  const [detailId, setDetailId]   = useState<number | null>(null)

  const params: Record<string, string> = { page: String(page) }
  if (status) params.status = status

  const { data, isLoading } = useQuery({
    queryKey: ['payment-plans', params],
    queryFn: () => api.get<PaginatedResponse<PaymentPlan>>('/payment-plans', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const plans = data?.data ?? []
  const meta  = data?.meta

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">Payment Plans</h2>
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">{(meta?.total ?? 0).toLocaleString()}</span>
        </div>
        <button onClick={() => setCreate(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" strokeWidth={2} /> New Plan
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5 w-fit">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => { setStatus(f.value); setPage(1) }}
            className={cn('h-7 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
              status === f.value ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
            )}>{f.label}</button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Plan #', 'Patient', 'Invoice', 'Total', 'Installments', 'Frequency', 'Progress', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array(5).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array(9).fill(0).map((_, j) => <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/[0.05] rounded animate-pulse w-20" /></td>)}
                </tr>
              ))}
              {!isLoading && plans.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <CreditCard className="w-10 h-10 text-zinc-700 mx-auto mb-3" strokeWidth={1.4} />
                    <p className="text-zinc-600 text-sm">No payment plans found</p>
                  </td>
                </tr>
              )}
              {!isLoading && plans.map(plan => {
                const pct = Math.round((plan.paid_installments / plan.installments) * 100)
                return (
                  <tr key={plan.id} onClick={() => setDetailId(plan.id)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group">
                    <td className="px-4 py-3 text-white font-mono text-xs font-semibold">{planNo(plan.id)}</td>
                    <td className="px-4 py-3 text-zinc-300 text-xs">{plan.patient.full_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-indigo-400 text-xs font-mono">{invoiceNo(plan.invoice_id)}</span>
                    </td>
                    <td className="px-4 py-3 text-white text-xs font-mono font-semibold whitespace-nowrap">{fmtCurrency(plan.total_amount)}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{plan.installments} × {fmtCurrency(plan.installment_amount)}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{FREQ_LABEL[plan.frequency]}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-zinc-500 text-xs">{pct}%</span>
                      </div>
                      {plan.next_due_date && plan.status === 'active' && (
                        <p className="text-zinc-700 text-[10px] mt-0.5 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> Next: {fmtDate(plan.next_due_date)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={plan.status} /></td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-600 group-hover:text-indigo-400 transition-colors text-xs opacity-0 group-hover:opacity-100">View →</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-zinc-600 text-xs">{((meta.current_page - 1) * meta.per_page) + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={meta.current_page === 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-zinc-500 text-xs px-2">{meta.current_page} / {meta.last_page}</span>
              <button onClick={() => setPage(p => Math.min(meta.last_page, p + 1))} disabled={meta.current_page === meta.last_page}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      <Drawer open={createOpen} onClose={() => setCreate(false)} title="New Payment Plan">
        <CreatePlanForm onSuccess={() => setCreate(false)} onClose={() => setCreate(false)} />
      </Drawer>
      <Drawer open={detailId !== null} onClose={() => setDetailId(null)} title={detailId ? planNo(detailId) : ''}>
        {detailId !== null && <PlanDetail planId={detailId} onClose={() => setDetailId(null)} />}
      </Drawer>
    </div>
  )
}
