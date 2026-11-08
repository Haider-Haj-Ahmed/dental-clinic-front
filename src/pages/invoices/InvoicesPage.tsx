import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, ChevronLeft, ChevronRight, Loader2, X,
  AlertCircle, Trash2, FileText, CheckCircle2,
  Ban, CreditCard, ExternalLink, Minus,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { Search } from 'lucide-react'
import type { PaginatedResponse } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = 'draft' | 'finalized' | 'partial' | 'paid' | 'void'

interface InvoiceItem {
  id: number; description: string; tooth_number: string | null
  qty: number; unit_price: number; total: number
}

interface Payment {
  id: number; amount: number; paid_at: string; reference: string | null; notes: string | null
  payment_method: { id: number; name: string } | null
}

interface Invoice {
  id: number; status: InvoiceStatus
  patient_id: number; provider_id: number | null
  issued_at: string; due_at: string | null
  subtotal: number; discount: number; tax: number; total: number
  amount_paid?: number; notes: string | null
  patient: { id: number; full_name: string; phone: string | null; email: string | null }
  provider: { id: number; name: string } | null
  items: InvoiceItem[]; payments: Payment[]
}

interface Provider      { id: number; name: string; is_active: boolean }
interface PaymentMethod { id: number; name: string; is_active: boolean }
interface PatientOpt    { id: number; full_name: string; phone: string | null }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
function invoiceNo(id: number) { return `#${String(id).padStart(5, '0')}` }
function todayStr()            { return new Date().toISOString().slice(0, 10) }

const STATUS_CFG: Record<InvoiceStatus, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'text-zinc-400 bg-zinc-700/30 border-zinc-700/60' },
  finalized: { label: 'Finalized', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20'   },
  partial:   { label: 'Partial',   cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  paid:      { label: 'Paid',      cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  void:      { label: 'Void',      cls: 'text-red-400 bg-red-500/10 border-red-500/20'    },
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, cls } = STATUS_CFG[status]
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', cls)}>{label}</span>
}

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

function Drawer({ open, onClose, title, wide, children }: { open: boolean; onClose: () => void; title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0 pointer-events-none')} />
      <div className={cn('fixed top-0 right-0 h-full z-50 flex flex-col bg-[#0d0f1c] border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-in-out w-full', wide ? 'max-w-2xl' : 'max-w-lg', open ? 'translate-x-0' : 'translate-x-full')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  )
}

// ── Patient typeahead (reused pattern) ───────────────────────────────────────

function PatientSearch({ value, onChange }: { value: { id: number; name: string } | null; onChange: (v: { id: number; name: string } | null) => void }) {
  const [q, setQ]       = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)
  const dq              = useDebounce(q, 300)
  const { data, isFetching } = useQuery({
    queryKey: ['ps-inv', dq],
    queryFn: () => api.get<PaginatedResponse<PatientOpt>>('/patients', { params: { search: dq, is_active: '1', per_page: '8' } }).then(r => r.data.data),
    enabled: open && dq.length > 0,
  })
  function select(p: PatientOpt) { onChange({ id: p.id, name: p.full_name }); setQ(p.full_name); setOpen(false) }
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input className={cn(iCls, 'pl-9 pr-8')} value={q} placeholder="Search patient…"
          onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }} onFocus={() => setOpen(true)} />
        {value && <button onClick={() => { onChange(null); setQ('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>}
      </div>
      {open && q.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-[#141626] border border-white/[0.08] rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
          {isFetching && <div className="px-4 py-3 text-xs text-zinc-500">Searching…</div>}
          {!isFetching && !data?.length && <div className="px-4 py-3 text-xs text-zinc-600">No patients found</div>}
          {data?.map(p => (
            <button key={p.id} onClick={() => select(p)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                {p.full_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <div><p className="text-sm text-white">{p.full_name}</p>{p.phone && <p className="text-xs text-zinc-500">{p.phone}</p>}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Line Items Editor ─────────────────────────────────────────────────────────

interface LineItem { description: string; tooth_number: string; qty: string; unit_price: string }

const EMPTY_ITEM: LineItem = { description: '', tooth_number: '', qty: '1', unit_price: '' }

function LineItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  function update(i: number, k: keyof LineItem, v: string) {
    const next = [...items]; next[i] = { ...next[i], [k]: v }; onChange(next)
  }
  function add()    { onChange([...items, { ...EMPTY_ITEM }]) }
  function remove(i: number) { onChange(items.filter((_, j) => j !== i)) }

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.qty||'0') * parseFloat(it.unit_price||'0')), 0)

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-1">
        {['Description', 'Tooth', 'Qty', 'Unit Price', 'Total', ''].map((h, i) => (
          <p key={i} className={cn('text-[10px] font-semibold text-zinc-600 uppercase tracking-wider',
            i === 0 ? 'col-span-4' : i === 1 ? 'col-span-2' : i === 2 ? 'col-span-1' : i === 3 ? 'col-span-2' : i === 4 ? 'col-span-2' : 'col-span-1'
          )}>{h}</p>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-zinc-700 text-xs py-3 text-center">No items — add at least one</p>
      )}

      {items.map((item, i) => {
        const lineTotal = parseFloat(item.qty||'0') * parseFloat(item.unit_price||'0')
        return (
          <div key={i} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-4">
              <input className={cn(iCls, 'h-8 text-xs')} value={item.description} onChange={e => update(i, 'description', e.target.value)} placeholder="Description" />
            </div>
            <div className="col-span-2">
              <input className={cn(iCls, 'h-8 text-xs')} value={item.tooth_number} onChange={e => update(i, 'tooth_number', e.target.value)} placeholder="e.g. 11" />
            </div>
            <div className="col-span-1">
              <input type="number" min="1" className={cn(iCls, 'h-8 text-xs')} value={item.qty} onChange={e => update(i, 'qty', e.target.value)} />
            </div>
            <div className="col-span-2">
              <input type="number" min="0" step="0.01" className={cn(iCls, 'h-8 text-xs')} value={item.unit_price} onChange={e => update(i, 'unit_price', e.target.value)} placeholder="0.00" />
            </div>
            <div className="col-span-2 h-8 flex items-center">
              <span className="text-xs text-zinc-400 font-mono">{fmtCurrency(lineTotal)}</span>
            </div>
            <div className="col-span-1 h-8 flex items-center justify-center">
              <button type="button" onClick={() => remove(i)} className="w-6 h-6 rounded flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Minus className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        )
      })}

      <button type="button" onClick={add}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-dashed border-indigo-500/30 transition-colors w-full justify-center">
        <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Add Line Item
      </button>

      {items.length > 0 && (
        <div className="flex justify-end pt-1">
          <p className="text-xs text-zinc-500">Subtotal: <span className="text-white font-semibold font-mono ml-1">{fmtCurrency(subtotal)}</span></p>
        </div>
      )}
    </div>
  )
}

// ── New Invoice Form ──────────────────────────────────────────────────────────

function NewInvoiceForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(null)
  const [form, setForm] = useState({ provider_id: '', issued_at: todayStr(), due_at: '', discount: '0', tax: '0', notes: '' })
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }])
  const [err, setErr]     = useState('')
  const [fieldErr, setFE] = useState<Record<string,string>>({})
  const qc = useQueryClient()

  const { data: providers } = useQuery({
    queryKey: ['providers-list'],
    queryFn: () => api.get<{ data: Provider[] }>('/providers', { params: { is_active: '1', per_page: '100' } }).then(r => r.data.data),
  })

  const mutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/invoices', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); onSuccess() },
    onError: (e: unknown) => {
      const r = (e as { response?: { data?: { message?: string; errors?: Record<string,string[]> } } })?.response?.data
      if (r?.errors) { const flat: Record<string,string>={}; Object.entries(r.errors).forEach(([k,v])=>{flat[k]=v[0]}); setFE(flat) }
      else setErr(r?.message ?? 'Failed to create invoice.')
    },
  })

  function s(k: string) { return (v: string) => { setForm(f => ({ ...f, [k]: v })); setFE(fe => ({ ...fe, [k]: '' })) } }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setFE({})
    if (!patient) { setFE(fe => ({ ...fe, patient_id: 'Required' })); return }
    if (!items.length || items.some(i => !i.description || !i.unit_price)) {
      setErr('All items must have a description and unit price.'); return
    }
    const payload: Record<string, unknown> = {
      patient_id: patient.id,
      issued_at: form.issued_at,
      discount: parseFloat(form.discount || '0'),
      tax: parseFloat(form.tax || '0'),
      items: items.map(i => ({
        description: i.description,
        qty: parseInt(i.qty || '1'),
        unit_price: parseFloat(i.unit_price),
        ...(i.tooth_number && { tooth_number: i.tooth_number }),
      })),
    }
    if (form.provider_id) payload.provider_id = Number(form.provider_id)
    if (form.due_at)      payload.due_at      = form.due_at
    if (form.notes)       payload.notes       = form.notes
    mutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}

      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Invoice Info</p>
        <Field label="Patient" required>
          <PatientSearch value={patient} onChange={setPatient} />
          {fieldErr.patient_id && <p className="text-xs text-red-400 mt-1">{fieldErr.patient_id}</p>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider">
            <select className={cn(iCls, 'bg-[#0f1120]', !form.provider_id && 'text-zinc-600')} value={form.provider_id} onChange={e => s('provider_id')(e.target.value)}>
              <option value="">No provider</option>
              {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Issued Date" required>
            <input type="date" className={iCls} value={form.issued_at} onChange={e => s('issued_at')(e.target.value)} />
          </Field>
          <Field label="Due Date">
            <input type="date" className={iCls} value={form.due_at} onChange={e => s('due_at')(e.target.value)} />
          </Field>
          <Field label="Notes">
            <input className={iCls} value={form.notes} onChange={e => s('notes')(e.target.value)} placeholder="Optional notes…" />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Line Items</p>
        <LineItemsEditor items={items} onChange={setItems} />
      </section>

      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Adjustments</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Discount ($)">
            <input type="number" min="0" step="0.01" className={iCls} value={form.discount} onChange={e => s('discount')(e.target.value)} />
          </Field>
          <Field label="Tax ($)">
            <input type="number" min="0" step="0.01" className={iCls} value={form.tax} onChange={e => s('tax')(e.target.value)} />
          </Field>
        </div>
      </section>

      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mutation.isPending ? 'Saving…' : 'Create Invoice'}
        </button>
      </div>
    </form>
  )
}

// ── Record Payment Form ───────────────────────────────────────────────────────

function RecordPaymentForm({ invoice, onSuccess }: { invoice: Invoice; onSuccess: () => void }) {
  const remaining = invoice.total - (invoice.amount_paid ?? invoice.payments.reduce((s,p)=>s+p.amount,0))
  const [form, setForm] = useState({ amount: remaining.toFixed(2), payment_method_id: '', paid_at: todayStr(), reference: '', notes: '' })
  const [err, setErr]   = useState('')
  const qc = useQueryClient()

  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.get<{ data: PaymentMethod[] }>('/payment-methods', { params: { per_page: '100' } }).then(r => r.data.data),
  })

  const mutation = useMutation({
    mutationFn: (d: Record<string, string | number>) => api.post('/payments', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['invoice', invoice.id] }); onSuccess() },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to record payment.'),
  })

  function s(k: string) { return (v: string) => setForm(f => ({ ...f, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const payload: Record<string, string | number> = { invoice_id: invoice.id, amount: parseFloat(form.amount), paid_at: form.paid_at }
    if (form.payment_method_id) payload.payment_method_id = Number(form.payment_method_id)
    if (form.reference) payload.reference = form.reference
    if (form.notes)     payload.notes     = form.notes
    mutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl mt-3">
      {err && <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /><span>{err}</span></div>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount ($)" required>
          <input type="number" min="0.01" step="0.01" className={iCls} value={form.amount} onChange={e => s('amount')(e.target.value)} />
        </Field>
        <Field label="Payment Method">
          <select className={cn(iCls, 'bg-[#0f1120]', !form.payment_method_id && 'text-zinc-600')} value={form.payment_method_id} onChange={e => s('payment_method_id')(e.target.value)}>
            <option value="">Select…</option>
            {methods?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Paid Date" required>
          <input type="date" className={iCls} value={form.paid_at} onChange={e => s('paid_at')(e.target.value)} />
        </Field>
        <Field label="Reference">
          <input className={iCls} value={form.reference} onChange={e => s('reference')(e.target.value)} placeholder="Transaction ID…" />
        </Field>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={mutation.isPending} className="h-8 px-4 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-1.5 disabled:opacity-50">
          {mutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}{mutation.isPending ? 'Saving…' : 'Record Payment'}
        </button>
      </div>
    </form>
  )
}

// ── Invoice Detail Drawer ─────────────────────────────────────────────────────

function InvoiceDetail({ invoiceId, onClose }: { invoiceId: number; onClose: () => void }) {
  const [addingPayment, setAddingPayment] = useState(false)
  const qc = useQueryClient()

  const { data: inv, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => api.get<{ data: Invoice }>(`/invoices/${invoiceId}`).then(r => r.data.data),
  })

  const finalizeMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${invoiceId}/finalize`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['invoice', invoiceId] }) },
  })

  const voidMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${invoiceId}/void`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['invoice', invoiceId] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/invoices/${invoiceId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); onClose() },
  })

  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

  if (isLoading) return (
    <div className="p-6 space-y-4 animate-pulse">
      {Array(4).fill(0).map((_,i) => <div key={i} className="h-10 bg-white/[0.05] rounded-lg" />)}
    </div>
  )
  if (!inv) return null

  const amountPaid = inv.payments.reduce((s,p) => s+p.amount, 0)
  const balance    = inv.total - amountPaid

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-bold text-lg font-mono">{invoiceNo(inv.id)}</span>
            <StatusBadge status={inv.status} />
          </div>
          <p className="text-sm text-white font-medium">{inv.patient.full_name}</p>
          {inv.patient.email && <p className="text-xs text-zinc-500">{inv.patient.email}</p>}
        </div>
        <div className="text-right">
          <p className="text-white text-xl font-bold font-mono">{fmtCurrency(inv.total)}</p>
          {balance > 0 && inv.status !== 'void' && (
            <p className="text-xs text-amber-400 mt-0.5">Balance: {fmtCurrency(balance)}</p>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Issued',   fmtDate(inv.issued_at)],
          ['Due',      fmtDate(inv.due_at)],
          ['Provider', inv.provider?.name ?? '—'],
          ['Subtotal', fmtCurrency(inv.subtotal)],
          inv.discount > 0 ? ['Discount', `-${fmtCurrency(inv.discount)}`] : null,
          inv.tax > 0      ? ['Tax',      `+${fmtCurrency(inv.tax)}`]      : null,
        ].filter(Boolean).map(([label, value]) => (
          <div key={label as string}>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold mb-0.5">{label}</p>
            <p className="text-sm text-zinc-200">{value}</p>
          </div>
        ))}
      </div>

      {/* Items */}
      <div>
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Line Items</p>
        <div className="space-y-1">
          {inv.items.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
              <div>
                <p className="text-sm text-white">{item.description}</p>
                <p className="text-xs text-zinc-600">{item.qty} × {fmtCurrency(item.unit_price)}{item.tooth_number && ` · Tooth ${item.tooth_number}`}</p>
              </div>
              <span className="text-sm text-white font-mono font-semibold">{fmtCurrency(item.total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payments */}
      {inv.payments.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Payments</p>
          <div className="space-y-1">
            {inv.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm text-white font-semibold font-mono">{fmtCurrency(p.amount)}</p>
                  <p className="text-xs text-zinc-500">{fmtDate(p.paid_at)}{p.payment_method && ` · ${p.payment_method.name}`}{p.reference && ` · ${p.reference}`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add payment form */}
      {addingPayment && inv.status !== 'void' && inv.status !== 'draft' && (
        <div>
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Record Payment</p>
          <RecordPaymentForm invoice={inv} onSuccess={() => setAddingPayment(false)} />
        </div>
      )}

      {/* Notes */}
      {inv.notes && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Notes</p>
          <p className="text-sm text-zinc-400">{inv.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
        {inv.status === 'draft' && (
          <>
            <button onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors disabled:opacity-50">
              {finalizeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.8} />}
              Finalize
            </button>
            <button onClick={() => { if (confirm('Delete this draft invoice?')) deleteMutation.mutate() }} disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50">
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />}
              Delete
            </button>
          </>
        )}
        {(inv.status === 'finalized' || inv.status === 'partial') && (
          <button onClick={() => setAddingPayment(v => !v)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/10 transition-colors">
            <CreditCard className="w-3.5 h-3.5" strokeWidth={1.8} />
            {addingPayment ? 'Cancel Payment' : 'Record Payment'}
          </button>
        )}
        {(inv.status === 'finalized' || inv.status === 'partial' || inv.status === 'paid') && (
          <button onClick={() => { if (confirm('Void this invoice?')) voidMutation.mutate() }} disabled={voidMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50">
            {voidMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" strokeWidth={1.8} />}
            Void
          </button>
        )}
        {inv.status !== 'draft' && (
          <a href={`${apiBase}/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-zinc-400 border border-white/[0.08] hover:bg-white/[0.06] transition-colors">
            <FileText className="w-3.5 h-3.5" strokeWidth={1.8} />
            PDF <ExternalLink className="w-3 h-3 ml-0.5 opacity-50" />
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'draft',     label: 'Draft'     },
  { value: 'finalized', label: 'Finalized' },
  { value: 'partial',   label: 'Partial'   },
  { value: 'paid',      label: 'Paid'      },
  { value: 'void',      label: 'Void'      },
]

export default function InvoicesPage() {
  const [status, setStatus]       = useState('')
  const [page, setPage]           = useState(1)
  const [createOpen, setCreate]   = useState(false)
  const [detailId, setDetailId]   = useState<number | null>(null)

  const params: Record<string, string> = { page: String(page) }
  if (status) params.status = status

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', params],
    queryFn: () => api.get<PaginatedResponse<Invoice>>('/invoices', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  function onFilter(v: string) { setStatus(v); setPage(1) }

  const invoices = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="max-w-7xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">Invoices</h2>
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">
            {(meta?.total ?? 0).toLocaleString()}
          </span>
        </div>
        <button onClick={() => setCreate(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" strokeWidth={2} /> New Invoice
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5 w-fit">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => onFilter(f.value)}
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
                {['Invoice', 'Patient', 'Issued', 'Due', 'Total', 'Paid', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array(8).fill(0).map((_,i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array(8).fill(0).map((_,j) => <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/[0.05] rounded animate-pulse w-20" /></td>)}
                </tr>
              ))}
              {!isLoading && invoices.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-zinc-600 text-sm">No invoices found</td></tr>
              )}
              {!isLoading && invoices.map(inv => {
                const paid = inv.amount_paid ?? inv.payments.reduce((s,p)=>s+p.amount,0)
                const balance = inv.total - paid
                return (
                  <tr key={inv.id} onClick={() => setDetailId(inv.id)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group">
                    <td className="px-4 py-3">
                      <span className="text-white font-mono font-semibold text-xs">{invoiceNo(inv.id)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white text-xs font-medium whitespace-nowrap">{inv.patient.full_name}</p>
                      {inv.provider && <p className="text-zinc-600 text-xs">{inv.provider.name}</p>}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(inv.issued_at)}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                      {inv.due_at
                        ? <span className={cn(balance > 0 && inv.status !== 'void' && new Date(inv.due_at) < new Date() ? 'text-red-400' : '')}>{fmtDate(inv.due_at)}</span>
                        : <span className="text-zinc-700">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-white text-xs font-mono font-semibold whitespace-nowrap">{fmtCurrency(inv.total)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {paid > 0
                        ? <span className="text-emerald-400 font-mono">{fmtCurrency(paid)}</span>
                        : <span className="text-zinc-700">—</span>
                      }
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
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
            <p className="text-zinc-600 text-xs">
              {((meta.current_page-1)*meta.per_page)+1}–{Math.min(meta.current_page*meta.per_page,meta.total)} of {meta.total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={meta.current_page===1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-zinc-500 text-xs px-2">{meta.current_page} / {meta.last_page}</span>
              <button onClick={() => setPage(p=>Math.min(meta.last_page,p+1))} disabled={meta.current_page===meta.last_page}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Drawer */}
      <Drawer open={createOpen} onClose={() => setCreate(false)} title="New Invoice" wide>
        <NewInvoiceForm onSuccess={() => setCreate(false)} onClose={() => setCreate(false)} />
      </Drawer>

      {/* Detail Drawer */}
      <Drawer open={detailId !== null} onClose={() => setDetailId(null)} title={detailId ? `Invoice ${invoiceNo(detailId)}` : ''}>
        {detailId !== null && <InvoiceDetail invoiceId={detailId} onClose={() => setDetailId(null)} />}
      </Drawer>
    </div>
  )
}
