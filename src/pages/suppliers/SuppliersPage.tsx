import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Edit2, Power, Loader2, X, AlertCircle,
  Mail, Phone, MapPin, FileText, ChevronLeft, ChevronRight,
  Package, Truck, CheckCircle2, Ban, Trash2, Minus,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import type { PaginatedResponse } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: number; name: string; contact_name: string | null
  phone: string | null; email: string | null; address: string | null
  notes: string | null; is_active: boolean
}

type POStatus = 'draft' | 'sent' | 'received' | 'cancelled'

interface POItem {
  id: number; inventory_item_id: number; quantity_ordered: number
  quantity_received: number | null; unit_cost: number
  inventory_item: { id: number; name: string; sku: string | null; unit: string }
}

interface PurchaseOrder {
  id: number; supplier_id: number; status: POStatus
  ordered_at: string | null; expected_at: string | null; received_at: string | null
  notes: string | null; created_by: number
  supplier: Supplier; creator: { id: number; name: string }
  items: POItem[]
}

interface InventoryItemOption { id: number; name: string; sku: string | null; unit: string; unit_cost: number | null }

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
function poNo(id: number) { return `PO-${String(id).padStart(5,'0')}` }
function todayStr()       { return new Date().toISOString().slice(0,10) }

const PO_STATUS_CFG: Record<POStatus, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'text-zinc-400 bg-zinc-700/30 border-zinc-700/60' },
  sent:      { label: 'Sent',      cls: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  received:  { label: 'Received',  cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  cancelled: { label: 'Cancelled', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
}

function POStatusBadge({ status }: { status: POStatus }) {
  const { label, cls } = PO_STATUS_CFG[status]
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', cls)}>{label}</span>
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

// ══ SUPPLIERS TAB ════════════════════════════════════════════════════════════

const EMPTY_SUP = { name: '', contact_name: '', phone: '', email: '', address: '', notes: '', is_active: true }

function SupplierForm({ mode, initial, supplierId, onSuccess, onClose }: {
  mode: 'create' | 'edit'; initial?: typeof EMPTY_SUP; supplierId?: number; onSuccess: () => void; onClose: () => void
}) {
  const [form, setForm] = useState(initial ?? EMPTY_SUP)
  const [err, setErr]   = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (d: Record<string, string | boolean>) =>
      mode === 'create' ? api.post('/suppliers', d) : api.patch(`/suppliers/${supplierId}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); onSuccess() },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Operation failed.'),
  })

  function s(k: string) { return (v: string | boolean) => setForm(f => ({ ...f, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!form.name.trim()) { setErr('Name is required.'); return }
    const p: Record<string, string | boolean> = { name: form.name, is_active: form.is_active }
    if (form.contact_name) p.contact_name = form.contact_name
    if (form.phone)        p.phone        = form.phone
    if (form.email)        p.email        = form.email
    if (form.address)      p.address      = form.address
    if (form.notes)        p.notes        = form.notes
    mutation.mutate(p)
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Company</p>
        <Field label="Company Name" required>
          <input className={iCls} value={form.name} onChange={e => s('name')(e.target.value)} placeholder="e.g. MedSupply Co." />
        </Field>
        <Field label="Contact Person">
          <input className={iCls} value={form.contact_name} onChange={e => s('contact_name')(e.target.value)} placeholder="Full name" />
        </Field>
      </section>
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={iCls} value={form.phone} onChange={e => s('phone')(e.target.value)} placeholder="+1 555 000 0000" /></Field>
          <Field label="Email"><input type="email" className={iCls} value={form.email} onChange={e => s('email')(e.target.value)} placeholder="supplier@co.com" /></Field>
        </div>
        <Field label="Address">
          <textarea className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none resize-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all" rows={2} value={form.address} onChange={e => s('address')(e.target.value)} placeholder="Street, City, Country" />
        </Field>
      </section>
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Notes</p>
        <textarea className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none resize-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all" rows={2} value={form.notes} onChange={e => s('notes')(e.target.value)} placeholder="Internal notes…" />
      </section>
      <label className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg cursor-pointer select-none">
        <div><p className="text-sm text-white font-medium">Active</p><p className="text-xs text-zinc-500 mt-0.5">Can be assigned to purchase orders</p></div>
        <button type="button" onClick={() => s('is_active')(!form.is_active)} className={cn('w-10 h-5 rounded-full transition-colors relative shrink-0', form.is_active ? 'bg-indigo-600' : 'bg-zinc-700')}>
          <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', form.is_active ? 'translate-x-5' : 'translate-x-0.5')} />
        </button>
      </label>
      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mutation.isPending ? 'Saving…' : mode === 'create' ? 'Create Supplier' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

function SuppliersTab() {
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [createOpen, setC]    = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const dSearch = useDebounce(search, 350)
  const qc = useQueryClient()

  const params: Record<string,string> = { page: String(page) }
  if (dSearch) params.search = dSearch

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', params],
    queryFn: () => api.get<PaginatedResponse<Supplier>>('/suppliers', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const toggleActive = useMutation({
    mutationFn: (s: Supplier) => api.patch(`/suppliers/${s.id}`, { is_active: !s.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })

  const suppliers = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">{(meta?.total ?? 0).toLocaleString()}</span>
        </div>
        <button onClick={() => setC(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" strokeWidth={2} /> New Supplier
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search name, contact…"
          className="w-full h-9 pl-9 pr-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/40 transition-all" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && Array(6).fill(0).map((_,i) => (
          <div key={i} className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5 space-y-3 animate-pulse">
            <div className="h-4 bg-white/[0.05] rounded w-32" />
            <div className="space-y-2">{Array(3).fill(0).map((_,j) => <div key={j} className="h-3 bg-white/[0.05] rounded w-full" />)}</div>
          </div>
        ))}
        {!isLoading && suppliers.length === 0 && (
          <div className="col-span-3 flex items-center justify-center h-40"><p className="text-zinc-600 text-sm">No suppliers found</p></div>
        )}
        {!isLoading && suppliers.map(sup => (
          <div key={sup.id} className={cn('bg-[#0f1120] border rounded-xl p-5 flex flex-col gap-4', sup.is_active ? 'border-white/[0.07]' : 'border-white/[0.04] opacity-60')}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-indigo-400" strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{sup.name}</p>
                  {sup.contact_name && <p className="text-zinc-500 text-xs truncate">{sup.contact_name}</p>}
                </div>
              </div>
              <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0',
                sup.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-700/30 border-zinc-700/50',
              )}>{sup.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="space-y-1.5 flex-1">
              {sup.phone && <div className="flex items-center gap-2 text-xs text-zinc-400"><Phone className="w-3.5 h-3.5 text-zinc-600 shrink-0" strokeWidth={1.8} /><span>{sup.phone}</span></div>}
              {sup.email && <div className="flex items-center gap-2 text-xs text-zinc-400"><Mail className="w-3.5 h-3.5 text-zinc-600 shrink-0" strokeWidth={1.8} /><span className="truncate">{sup.email}</span></div>}
              {sup.address && <div className="flex items-start gap-2 text-xs text-zinc-500"><MapPin className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-px" strokeWidth={1.8} /><span className="line-clamp-2">{sup.address}</span></div>}
              {sup.notes && <div className="flex items-start gap-2 text-xs text-zinc-600"><FileText className="w-3.5 h-3.5 text-zinc-700 shrink-0 mt-px" strokeWidth={1.8} /><span className="line-clamp-1">{sup.notes}</span></div>}
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-white/[0.05]">
              <button onClick={() => setEditing(sup)} className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.07] transition-colors">
                <Edit2 className="w-3.5 h-3.5" strokeWidth={1.8} /> Edit
              </button>
              <button onClick={() => toggleActive.mutate(sup)} disabled={toggleActive.isPending}
                className={cn('flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs border transition-colors',
                  sup.is_active ? 'text-red-400 border-red-500/20 hover:bg-red-500/10' : 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10',
                )}>
                <Power className="w-3.5 h-3.5" strokeWidth={1.8} />
                {sup.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-zinc-600 text-xs">{((meta.current_page-1)*meta.per_page)+1}–{Math.min(meta.current_page*meta.per_page,meta.total)} of {meta.total}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={meta.current_page===1} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-zinc-500 text-xs px-2">{meta.current_page} / {meta.last_page}</span>
            <button onClick={() => setPage(p=>Math.min(meta.last_page,p+1))} disabled={meta.current_page===meta.last_page} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <Drawer open={createOpen} onClose={() => setC(false)} title="New Supplier"><SupplierForm mode="create" onSuccess={() => setC(false)} onClose={() => setC(false)} /></Drawer>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Edit Supplier">
        {editing && <SupplierForm mode="edit" supplierId={editing.id} initial={{ name: editing.name, contact_name: editing.contact_name??'', phone: editing.phone??'', email: editing.email??'', address: editing.address??'', notes: editing.notes??'', is_active: editing.is_active }} onSuccess={() => setEditing(null)} onClose={() => setEditing(null)} />}
      </Drawer>
    </div>
  )
}

// ══ PURCHASE ORDERS TAB ══════════════════════════════════════════════════════

interface POLineItem { inventory_item_id: string; quantity_ordered: string; unit_cost: string }
const EMPTY_LINE: POLineItem = { inventory_item_id: '', quantity_ordered: '1', unit_cost: '' }

function NewPOForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ supplier_id: '', ordered_at: todayStr(), expected_at: '', notes: '' })
  const [lines, setLines] = useState<POLineItem[]>([{ ...EMPTY_LINE }])
  const [err, setErr] = useState('')
  const qc = useQueryClient()

  const { data: suppliers } = useQuery({ queryKey: ['suppliers-all'], queryFn: () => api.get<PaginatedResponse<Supplier>>('/suppliers', { params: { is_active: '1', per_page: '200' } }).then(r => r.data.data) })
  const { data: invItems }  = useQuery({ queryKey: ['inv-items-all'], queryFn: () => api.get<PaginatedResponse<InventoryItemOption>>('/inventory-items', { params: { is_active: '1', per_page: '200' } }).then(r => r.data.data) })

  const mutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/purchase-orders', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); onSuccess() },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create purchase order.'),
  })

  function updateLine(i: number, k: keyof POLineItem, v: string) {
    const next = [...lines]; next[i] = { ...next[i], [k]: v }
    // Auto-fill unit cost from inventory item
    if (k === 'inventory_item_id' && invItems) {
      const item = invItems.find(it => String(it.id) === v)
      if (item?.unit_cost !== null && item?.unit_cost !== undefined) next[i].unit_cost = String(item.unit_cost)
    }
    setLines(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!form.supplier_id) { setErr('Please select a supplier.'); return }
    if (!lines.length || lines.some(l => !l.inventory_item_id || !l.quantity_ordered || !l.unit_cost)) {
      setErr('All line items must have an item, quantity and unit cost.'); return
    }
    const payload: Record<string, unknown> = {
      supplier_id: Number(form.supplier_id),
      items: lines.map(l => ({ inventory_item_id: Number(l.inventory_item_id), quantity_ordered: parseInt(l.quantity_ordered), unit_cost: parseFloat(l.unit_cost) })),
    }
    if (form.ordered_at)  payload.ordered_at  = form.ordered_at
    if (form.expected_at) payload.expected_at = form.expected_at
    if (form.notes)       payload.notes       = form.notes
    mutation.mutate(payload)
  }

  const total = lines.reduce((s,l) => s + (parseInt(l.quantity_ordered||'0') * parseFloat(l.unit_cost||'0')), 0)

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Order Info</p>
        <Field label="Supplier" required>
          <select className={cn(iCls,'bg-[#0f1120]',!form.supplier_id&&'text-zinc-600')} value={form.supplier_id} onChange={e => setForm(f=>({...f,supplier_id:e.target.value}))}>
            <option value="">Select supplier…</option>
            {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Order Date"><input type="date" className={iCls} value={form.ordered_at} onChange={e => setForm(f=>({...f,ordered_at:e.target.value}))} /></Field>
          <Field label="Expected Date"><input type="date" className={iCls} value={form.expected_at} onChange={e => setForm(f=>({...f,expected_at:e.target.value}))} /></Field>
        </div>
        <Field label="Notes"><input className={iCls} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes…" /></Field>
      </section>

      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Items</p>
        <div className="grid grid-cols-12 gap-2 px-1">
          {['Item','Qty','Unit Cost','Total',''].map((h,i) => (
            <p key={i} className={cn('text-[10px] font-semibold text-zinc-600 uppercase tracking-wider', i===0?'col-span-5':i===1?'col-span-2':i===2?'col-span-2':i===3?'col-span-2':'col-span-1')}>{h}</p>
          ))}
        </div>
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-5">
              <select className={cn(iCls,'h-8 text-xs bg-[#0f1120]',!line.inventory_item_id&&'text-zinc-600')} value={line.inventory_item_id} onChange={e => updateLine(i,'inventory_item_id',e.target.value)}>
                <option value="">Select item…</option>
                {invItems?.map(it => <option key={it.id} value={it.id}>{it.name}{it.sku?` (${it.sku})`:''}</option>)}
              </select>
            </div>
            <div className="col-span-2"><input type="number" min="1" className={cn(iCls,'h-8 text-xs')} value={line.quantity_ordered} onChange={e => updateLine(i,'quantity_ordered',e.target.value)} /></div>
            <div className="col-span-2"><input type="number" min="0" step="0.01" className={cn(iCls,'h-8 text-xs')} value={line.unit_cost} onChange={e => updateLine(i,'unit_cost',e.target.value)} placeholder="0.00" /></div>
            <div className="col-span-2 h-8 flex items-center"><span className="text-xs text-zinc-400 font-mono">{fmtCurrency(parseInt(line.quantity_ordered||'0')*parseFloat(line.unit_cost||'0'))}</span></div>
            <div className="col-span-1 h-8 flex items-center justify-center">
              <button type="button" onClick={() => setLines(ls => ls.filter((_,j)=>j!==i))} className="w-6 h-6 rounded flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Minus className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setLines(ls=>[...ls,{...EMPTY_LINE}])}
          className="flex items-center gap-1.5 h-8 w-full px-3 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-dashed border-indigo-500/30 transition-colors justify-center">
          <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Add Item
        </button>
        {total > 0 && <div className="flex justify-end"><p className="text-xs text-zinc-500">Total: <span className="text-white font-semibold font-mono ml-1">{fmtCurrency(total)}</span></p></div>}
      </section>

      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mutation.isPending ? 'Creating…' : 'Create Purchase Order'}
        </button>
      </div>
    </form>
  )
}

function PODetail({ poId, onClose }: { poId: number; onClose: () => void }) {
  const [receiving, setReceiving] = useState(false)
  const [rcvQtys, setRcvQtys]     = useState<Record<number, string>>({})
  const qc = useQueryClient()

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', poId],
    queryFn: () => api.get<{ data: PurchaseOrder }>(`/purchase-orders/${poId}`).then(r => r.data.data),
  })

  const receiveMutation = useMutation({
    mutationFn: (items: { id: number; quantity_received: number }[]) => api.post(`/purchase-orders/${poId}/receive`, { items }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); qc.invalidateQueries({ queryKey: ['purchase-order', poId] }); qc.invalidateQueries({ queryKey: ['inventory'] }); setReceiving(false) },
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${poId}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); qc.invalidateQueries({ queryKey: ['purchase-order', poId] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/purchase-orders/${poId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); onClose() },
  })

  if (isLoading) return <div className="p-6 space-y-4 animate-pulse">{Array(4).fill(0).map((_,i) => <div key={i} className="h-10 bg-white/[0.05] rounded-lg" />)}</div>
  if (!po) return null

  const total = po.items.reduce((s,it) => s + it.quantity_ordered * it.unit_cost, 0)

  function startReceive() {
    const init: Record<number,string> = {}
    po.items.forEach(it => { init[it.id] = String(it.quantity_ordered) })
    setRcvQtys(init); setReceiving(true)
  }

  function submitReceive() {
    const items = po.items.map(it => ({ id: it.id, quantity_received: parseInt(rcvQtys[it.id] ?? '0') }))
    receiveMutation.mutate(items)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="text-white font-bold text-lg font-mono">{poNo(po.id)}</span><POStatusBadge status={po.status} /></div>
          <p className="text-sm text-zinc-300">{po.supplier.name}</p>
          <p className="text-xs text-zinc-600 mt-0.5">Created by {po.creator.name}</p>
        </div>
        <div className="text-right"><p className="text-white text-xl font-bold font-mono">{fmtCurrency(total)}</p></div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-3 gap-3">
        {[['Ordered', fmtDate(po.ordered_at)], ['Expected', fmtDate(po.expected_at)], ['Received', fmtDate(po.received_at)]].map(([l,v]) => (
          <div key={l}><p className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold mb-0.5">{l}</p><p className="text-sm text-zinc-200">{v}</p></div>
        ))}
      </div>

      {/* Items */}
      <div>
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Items</p>
        <div className="space-y-2">
          {po.items.map(it => (
            <div key={it.id} className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-white font-medium">{it.inventory_item.name}</p>
                  <p className="text-xs text-zinc-600">{it.quantity_ordered} {it.inventory_item.unit}s × {fmtCurrency(it.unit_cost)}</p>
                  {it.quantity_received !== null && it.quantity_received > 0 && (
                    <p className="text-xs text-emerald-400 mt-0.5">Received: {it.quantity_received}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-white font-mono">{fmtCurrency(it.quantity_ordered * it.unit_cost)}</p>
                </div>
              </div>
              {receiving && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-zinc-500 shrink-0">Qty received:</label>
                  <input type="number" min="0" max={it.quantity_ordered} className="w-24 h-7 px-2 rounded text-sm text-white bg-white/[0.06] border border-white/[0.1] outline-none focus:border-indigo-500/50"
                    value={rcvQtys[it.id] ?? String(it.quantity_ordered)} onChange={e => setRcvQtys(q => ({...q,[it.id]:e.target.value}))} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {po.notes && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Notes</p>
          <p className="text-sm text-zinc-400">{po.notes}</p>
        </div>
      )}

      {/* Receive confirm */}
      {receiving && (
        <div className="flex gap-2">
          <button onClick={submitReceive} disabled={receiveMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50">
            {receiveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.8} />}
            {receiveMutation.isPending ? 'Receiving…' : 'Confirm Receipt'}
          </button>
          <button onClick={() => setReceiving(false)} className="h-8 px-3 rounded-lg text-xs text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        </div>
      )}

      {/* Actions */}
      {!receiving && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
          {(po.status === 'draft' || po.status === 'sent') && (
            <button onClick={startReceive} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors">
              <Package className="w-3.5 h-3.5" strokeWidth={1.8} /> Receive
            </button>
          )}
          {(po.status === 'draft' || po.status === 'sent') && (
            <button onClick={() => { if (confirm('Cancel this order?')) cancelMutation.mutate() }} disabled={cancelMutation.isPending}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50">
              {cancelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" strokeWidth={1.8} />} Cancel
            </button>
          )}
          {po.status === 'draft' && (
            <button onClick={() => { if (confirm('Delete this draft?')) deleteMutation.mutate() }} disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50">
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />} Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const PO_FILTERS = [
  { value: '', label: 'All' }, { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' }, { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
]

function PurchaseOrdersTab() {
  const [status, setStatus]   = useState('')
  const [page, setPage]       = useState(1)
  const [createOpen, setC]    = useState(false)
  const [detailId, setDetail] = useState<number | null>(null)

  const params: Record<string,string> = { page: String(page) }
  if (status) params.status = status

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', params],
    queryFn: () => api.get<PaginatedResponse<PurchaseOrder>>('/purchase-orders', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const orders = data?.data ?? []
  const meta   = data?.meta

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">{(meta?.total ?? 0).toLocaleString()}</span>
        </div>
        <button onClick={() => setC(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" strokeWidth={2} /> New Purchase Order
        </button>
      </div>

      <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5 w-fit">
        {PO_FILTERS.map(f => (
          <button key={f.value} onClick={() => { setStatus(f.value); setPage(1) }}
            className={cn('h-7 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap', status===f.value?'bg-indigo-600 text-white':'text-zinc-400 hover:text-zinc-200')}>{f.label}</button>
        ))}
      </div>

      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['PO #','Supplier','Ordered','Expected','Items','Total','Status',''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array(5).fill(0).map((_,i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array(8).fill(0).map((_,j) => <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/[0.05] rounded animate-pulse w-20" /></td>)}
                </tr>
              ))}
              {!isLoading && orders.length === 0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-zinc-600 text-sm">No purchase orders found</td></tr>}
              {!isLoading && orders.map(po => {
                const total = po.items.reduce((s,it) => s + it.quantity_ordered * it.unit_cost, 0)
                return (
                  <tr key={po.id} onClick={() => setDetail(po.id)} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group">
                    <td className="px-4 py-3"><span className="text-white font-mono font-semibold text-xs">{poNo(po.id)}</span></td>
                    <td className="px-4 py-3 text-zinc-300 text-xs">{po.supplier.name}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(po.ordered_at)}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(po.expected_at)}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{po.items.length}</td>
                    <td className="px-4 py-3 text-white text-xs font-mono font-semibold">{fmtCurrency(total)}</td>
                    <td className="px-4 py-3"><POStatusBadge status={po.status} /></td>
                    <td className="px-4 py-3"><span className="text-zinc-600 group-hover:text-indigo-400 transition-colors text-xs opacity-0 group-hover:opacity-100">View →</span></td>
                  </tr>
                )
              })}
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

      <Drawer open={createOpen} onClose={() => setC(false)} title="New Purchase Order" wide><NewPOForm onSuccess={() => setC(false)} onClose={() => setC(false)} /></Drawer>
      <Drawer open={detailId !== null} onClose={() => setDetail(null)} title={detailId ? poNo(detailId) : ''}>{detailId !== null && <PODetail poId={detailId} onClose={() => setDetail(null)} />}</Drawer>
    </div>
  )
}

// ══ MAIN PAGE ════════════════════════════════════════════════════════════════

type MainTab = 'suppliers' | 'purchase-orders'

export default function SuppliersPage() {
  const [tab, setTab] = useState<MainTab>('suppliers')
  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">Suppliers</h2>
      </div>
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1 w-fit">
        {([['suppliers','Suppliers'],['purchase-orders','Purchase Orders']] as [MainTab,string][]).map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('h-8 px-5 rounded-lg text-sm font-medium transition-colors',
              tab===id ? 'bg-[#0f1120] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300',
            )}>{label}</button>
        ))}
      </div>
      {tab === 'suppliers'       && <SuppliersTab />}
      {tab === 'purchase-orders' && <PurchaseOrdersTab />}
    </div>
  )
}
