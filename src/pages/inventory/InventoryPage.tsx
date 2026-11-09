import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, AlertTriangle, Package,
  Edit2, Loader2, X, AlertCircle, ArrowUpDown,
  TrendingUp, TrendingDown, RotateCcw, Skull,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import type { PaginatedResponse } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface Supplier { id: number; name: string }

interface InventoryItem {
  id: number; name: string; sku: string | null; category: string | null
  unit: string; current_stock: number; reorder_level: number
  is_low_stock: boolean; unit_cost: number | null; is_active: boolean
  supplier: Supplier | null
}

interface StockMovement {
  id: number; movement_type: string; quantity: number; stock_after: number
  reason: string | null; reference: string | null; performed_at: string
  performed_by: { id: number; name: string } | null
}

// ── Movement type config ──────────────────────────────────────────────────────

const MOVEMENT_CFG = {
  in:         { label: 'Stock In',    icon: TrendingUp,   cls: 'text-emerald-400', hint: 'Positive number (e.g. +50)' },
  out:        { label: 'Stock Out',   icon: TrendingDown, cls: 'text-red-400',     hint: 'Negative number (e.g. -10)' },
  adjustment: { label: 'Adjustment',  icon: RotateCcw,    cls: 'text-indigo-400',  hint: 'Positive or negative' },
  expired:    { label: 'Expired',     icon: Skull,        cls: 'text-orange-400',  hint: 'Negative number (e.g. -5)' },
} as const

type MovementType = keyof typeof MOVEMENT_CFG

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number | null) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function todayStr() { return new Date().toISOString().slice(0, 10) }

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

// ── Item Form ─────────────────────────────────────────────────────────────────

type FormMode = 'create' | 'edit'
const EMPTY_ITEM_FORM = { name: '', sku: '', category: '', unit: 'unit', supplier_id: '', current_stock: '0', reorder_level: '5', unit_cost: '', is_active: true }

function ItemForm({ mode, initial, itemId, onSuccess, onClose }: {
  mode: FormMode; initial?: typeof EMPTY_ITEM_FORM; itemId?: number; onSuccess: () => void; onClose: () => void
}) {
  const [form, setForm] = useState(initial ?? EMPTY_ITEM_FORM)
  const [err, setErr]   = useState('')
  const [fieldErr, setFE] = useState<Record<string, string>>({})
  const qc = useQueryClient()

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => api.get<{ data: Supplier[] }>('/suppliers', { params: { per_page: '100' } }).then(r => r.data.data),
  })

  const mutation = useMutation({
    mutationFn: (d: Record<string, string | boolean | number>) =>
      mode === 'create' ? api.post('/inventory-items', d) : api.patch(`/inventory-items/${itemId}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); onSuccess() },
    onError: (e: unknown) => {
      const r = (e as { response?: { data?: { message?: string; errors?: Record<string,string[]> } } })?.response?.data
      if (r?.errors) { const flat: Record<string,string>={}; Object.entries(r.errors).forEach(([k,v])=>{flat[k]=v[0]}); setFE(flat) }
      else setErr(r?.message ?? 'Operation failed.')
    },
  })

  function s(k: string) { return (v: string | boolean) => { setForm(f => ({ ...f, [k]: v })); setFE(fe => ({ ...fe, [k]: '' })) } }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setFE({})
    if (!form.name.trim()) { setFE(fe => ({ ...fe, name: 'Required' })); return }
    const payload: Record<string, string | boolean | number> = {
      name: form.name, unit: form.unit || 'unit', is_active: form.is_active,
      current_stock: parseInt(form.current_stock || '0'),
      reorder_level: parseInt(form.reorder_level || '0'),
    }
    if (form.sku)         payload.sku         = form.sku
    if (form.category)    payload.category    = form.category
    if (form.supplier_id) payload.supplier_id = Number(form.supplier_id)
    if (form.unit_cost)   payload.unit_cost   = parseFloat(form.unit_cost)
    mutation.mutate(payload)
  }

  const CATEGORIES = ['Consumables', 'Equipment', 'Medications', 'Disposables', 'PPE', 'Dental Materials', 'Other']

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}

      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Item Info</p>
        <Field label="Name" required error={fieldErr.name}>
          <input className={cn(iCls, fieldErr.name && 'border-red-500/40')} value={form.name} onChange={e => s('name')(e.target.value)} placeholder="e.g. Nitrile Gloves (M)" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU" error={fieldErr.sku}>
            <input className={iCls} value={form.sku} onChange={e => s('sku')(e.target.value)} placeholder="e.g. GLV-M-100" />
          </Field>
          <Field label="Category">
            <select className={cn(iCls, 'bg-[#0f1120]', !form.category && 'text-zinc-600')} value={form.category} onChange={e => s('category')(e.target.value)}>
              <option value="">No category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Unit">
            <input className={iCls} value={form.unit} onChange={e => s('unit')(e.target.value)} placeholder="e.g. box, pair, unit" />
          </Field>
          <Field label="Supplier">
            <select className={cn(iCls, 'bg-[#0f1120]', !form.supplier_id && 'text-zinc-600')} value={form.supplier_id} onChange={e => s('supplier_id')(e.target.value)}>
              <option value="">No supplier</option>
              {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Stock & Pricing</p>
        <div className="grid grid-cols-3 gap-3">
          {mode === 'create' && (
            <Field label="Opening Stock">
              <input type="number" min="0" className={iCls} value={form.current_stock} onChange={e => s('current_stock')(e.target.value)} />
            </Field>
          )}
          <Field label="Reorder Level">
            <input type="number" min="0" className={iCls} value={form.reorder_level} onChange={e => s('reorder_level')(e.target.value)} />
          </Field>
          <Field label="Unit Cost ($)">
            <input type="number" min="0" step="0.01" className={iCls} value={form.unit_cost} onChange={e => s('unit_cost')(e.target.value)} placeholder="0.00" />
          </Field>
        </div>
      </section>

      <label className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg cursor-pointer select-none">
        <div>
          <p className="text-sm text-white font-medium">Active</p>
          <p className="text-xs text-zinc-500 mt-0.5">Include in inventory tracking</p>
        </div>
        <button type="button" onClick={() => s('is_active')(!form.is_active)}
          className={cn('w-10 h-5 rounded-full transition-colors relative shrink-0', form.is_active ? 'bg-indigo-600' : 'bg-zinc-700')}>
          <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', form.is_active ? 'translate-x-5' : 'translate-x-0.5')} />
        </button>
      </label>

      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mutation.isPending ? 'Saving…' : mode === 'create' ? 'Create Item' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

// ── Adjust Stock Drawer ───────────────────────────────────────────────────────

function AdjustStockPanel({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [form, setForm] = useState({ movement_type: 'in' as MovementType, quantity: '', reason: '', reference: '', performed_at: todayStr() })
  const [err, setErr]   = useState('')
  const [tab, setTab]   = useState<'adjust' | 'history'>('adjust')
  const qc = useQueryClient()

  const { data: movements, isLoading: movLoading } = useQuery({
    queryKey: ['stock-movements', item.id],
    queryFn: () => api.get<PaginatedResponse<StockMovement>>(`/inventory-items/${item.id}/movements`).then(r => r.data.data),
    enabled: tab === 'history',
  })

  const mutation = useMutation({
    mutationFn: (d: Record<string, string | number>) => api.post(`/inventory-items/${item.id}/adjust-stock`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['stock-movements', item.id] }); setForm(f => ({ ...f, quantity: '', reason: '', reference: '' })); setErr('') },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Adjustment failed.'),
  })

  function s(k: string) { return (v: string) => setForm(f => ({ ...f, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!form.quantity || form.quantity === '0') { setErr('Quantity cannot be zero.'); return }
    const payload: Record<string, string | number> = {
      movement_type: form.movement_type,
      quantity: parseInt(form.quantity),
      performed_at: form.performed_at,
    }
    if (form.reason)    payload.reason    = form.reason
    if (form.reference) payload.reference = form.reference
    mutation.mutate(payload)
  }

  const cfg = MOVEMENT_CFG[form.movement_type]
  const Icon = cfg.icon

  return (
    <div className="p-6 space-y-5">
      {/* Item summary */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{item.name}</p>
          {item.sku && <p className="text-zinc-500 text-xs font-mono">{item.sku}</p>}
        </div>
        <div className="text-right">
          <p className={cn('text-xl font-bold font-mono', item.is_low_stock ? 'text-amber-400' : 'text-white')}>
            {item.current_stock}
          </p>
          <p className="text-zinc-600 text-xs">{item.unit}s in stock</p>
        </div>
      </div>

      {item.is_low_stock && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
          Low stock — reorder level is {item.reorder_level} {item.unit}s
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5">
        {(['adjust', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 h-7 rounded-md text-xs font-medium transition-colors capitalize',
              tab === t ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
            )}>{t === 'adjust' ? 'Adjust Stock' : 'History'}</button>
        ))}
      </div>

      {tab === 'adjust' && (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {err && <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /><span>{err}</span></div>}
          {mutation.isSuccess && <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-3 py-2.5">✓ Stock adjusted successfully.</div>}

          {/* Movement type */}
          <Field label="Movement Type">
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(MOVEMENT_CFG) as [MovementType, typeof MOVEMENT_CFG['in']][]).map(([type, c]) => {
                const Ico = c.icon
                return (
                  <button key={type} type="button" onClick={() => setForm(f => ({ ...f, movement_type: type }))}
                    className={cn('flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-colors',
                      form.movement_type === type
                        ? `${c.cls} bg-white/[0.06] border-current`
                        : 'text-zinc-500 border-white/[0.08] hover:bg-white/[0.04]',
                    )}>
                    <Ico className="w-3.5 h-3.5" strokeWidth={1.8} />{c.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-zinc-600 mt-1 flex items-center gap-1"><Icon className={cn('w-3 h-3', cfg.cls)} strokeWidth={1.8} />{cfg.hint}</p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" required>
              <input type="number" className={iCls} value={form.quantity} onChange={e => s('quantity')(e.target.value)} placeholder="e.g. 50 or -5" />
            </Field>
            <Field label="Date">
              <input type="date" className={iCls} value={form.performed_at} onChange={e => s('performed_at')(e.target.value)} />
            </Field>
            <Field label="Reason">
              <input className={iCls} value={form.reason} onChange={e => s('reason')(e.target.value)} placeholder="e.g. Monthly restock" />
            </Field>
            <Field label="Reference">
              <input className={iCls} value={form.reference} onChange={e => s('reference')(e.target.value)} placeholder="PO #, lot #…" />
            </Field>
          </div>

          <button type="submit" disabled={mutation.isPending}
            className="w-full h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
            {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {mutation.isPending ? 'Adjusting…' : 'Apply Adjustment'}
          </button>
        </form>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {movLoading && Array(4).fill(0).map((_,i) => <div key={i} className="h-14 bg-white/[0.03] rounded-lg animate-pulse" />)}
          {!movLoading && (!movements || movements.length === 0) && (
            <p className="text-zinc-700 text-sm text-center py-8">No movements recorded</p>
          )}
          {movements?.map(m => {
            const c = MOVEMENT_CFG[m.movement_type as MovementType]
            const Ico = c?.icon ?? Package
            return (
              <div key={m.id} className="flex items-start justify-between bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5 gap-3">
                <div className="flex items-start gap-2.5">
                  <div className={cn('w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5', c?.cls ?? 'text-zinc-500')}>
                    <Ico className="w-3.5 h-3.5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-sm font-semibold font-mono', m.quantity > 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </span>
                      <span className="text-zinc-600 text-xs">{c?.label ?? m.movement_type}</span>
                    </div>
                    {m.reason && <p className="text-xs text-zinc-500 mt-0.5">{m.reason}</p>}
                    {m.reference && <p className="text-xs text-zinc-600 font-mono">Ref: {m.reference}</p>}
                    <p className="text-xs text-zinc-700 mt-0.5">{fmtDate(m.performed_at)}{m.performed_by && ` · ${m.performed_by.name}`}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-500">After</p>
                  <p className="text-sm font-mono text-white font-semibold">{m.stock_after}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('')
  const [lowStock, setLowStock] = useState(false)
  const [page, setPage]         = useState(1)
  const [createOpen, setCreate] = useState(false)
  const [editing, setEditing]   = useState<InventoryItem | null>(null)
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null)
  const dSearch = useDebounce(search, 350)

  const params: Record<string, string> = { page: String(page), per_page: '20' }
  if (dSearch)  params.search   = dSearch
  if (category) params.category = category
  if (lowStock) params.low_stock = '1'

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', params],
    queryFn: () => api.get<PaginatedResponse<InventoryItem>>('/inventory-items', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  function onSearch(v: string) { setSearch(v); setPage(1) }

  const items = data?.data ?? []
  const meta  = data?.meta

  const CATEGORIES = ['Consumables', 'Equipment', 'Medications', 'Disposables', 'PPE', 'Dental Materials', 'Other']

  return (
    <div className="max-w-7xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">Inventory</h2>
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">
            {(meta?.total ?? 0).toLocaleString()}
          </span>
        </div>
        <button onClick={() => setCreate(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" strokeWidth={2} /> New Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search name, SKU…"
            className="w-full h-9 pl-9 pr-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/40 transition-all" />
        </div>
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}
          className="h-9 px-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-zinc-300 outline-none focus:border-indigo-500/40 transition-all">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => { setLowStock(v => !v); setPage(1) }}
          className={cn('flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border transition-colors',
            lowStock ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-zinc-400 border-white/[0.08] hover:bg-white/[0.04]',
          )}>
          <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} /> Low Stock
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Item', 'Category', 'Supplier', 'Stock', 'Unit Cost', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array(8).fill(0).map((_,i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array(7).fill(0).map((_,j) => <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/[0.05] rounded animate-pulse w-20" /></td>)}
                </tr>
              ))}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-zinc-600 text-sm">No items found</td></tr>
              )}
              {!isLoading && items.map(item => (
                <tr key={item.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                        item.is_low_stock ? 'bg-amber-500/15' : 'bg-indigo-500/15',
                      )}>
                        <Package className={cn('w-3.5 h-3.5', item.is_low_stock ? 'text-amber-400' : 'text-indigo-400')} strokeWidth={1.8} />
                      </div>
                      <div>
                        <p className="text-white text-xs font-medium">{item.name}</p>
                        {item.sku && <p className="text-zinc-600 text-xs font-mono">{item.sku}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.category
                      ? <span className="text-xs text-zinc-400 bg-white/[0.04] border border-white/[0.07] rounded px-2 py-0.5">{item.category}</span>
                      : <span className="text-zinc-700 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{item.supplier?.name ?? <span className="text-zinc-700">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-semibold font-mono', item.is_low_stock ? 'text-amber-400' : 'text-white')}>
                        {item.current_stock}
                      </span>
                      <span className="text-zinc-600 text-xs">{item.unit}s</span>
                      {item.is_low_stock && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-0.5 font-semibold">
                          <AlertTriangle className="w-2.5 h-2.5" strokeWidth={2} /> Low
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-700 text-xs mt-0.5">Reorder at {item.reorder_level}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{fmtCurrency(item.unit_cost)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                      item.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-700/30 border-zinc-700/50',
                    )}>{item.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => setAdjusting(item)}
                        className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-indigo-400 hover:bg-indigo-500/10 transition-colors border border-transparent hover:border-indigo-500/20">
                        <ArrowUpDown className="w-3.5 h-3.5" strokeWidth={1.8} /> Adjust
                      </button>
                      <button onClick={() => setEditing(item)}
                        className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors">
                        <Edit2 className="w-3.5 h-3.5" strokeWidth={1.8} /> Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
      <Drawer open={createOpen} onClose={() => setCreate(false)} title="New Inventory Item">
        <ItemForm mode="create" onSuccess={() => setCreate(false)} onClose={() => setCreate(false)} />
      </Drawer>

      {/* Edit Drawer */}
      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Edit Item">
        {editing && (
          <ItemForm mode="edit" itemId={editing.id} initial={{
            name: editing.name, sku: editing.sku ?? '', category: editing.category ?? '',
            unit: editing.unit, supplier_id: editing.supplier ? String(editing.supplier.id) : '',
            current_stock: String(editing.current_stock), reorder_level: String(editing.reorder_level),
            unit_cost: editing.unit_cost !== null ? String(editing.unit_cost) : '',
            is_active: editing.is_active,
          }} onSuccess={() => setEditing(null)} onClose={() => setEditing(null)} />
        )}
      </Drawer>

      {/* Adjust Stock Drawer */}
      <Drawer open={!!adjusting} onClose={() => setAdjusting(null)} title="Adjust Stock">
        {adjusting && <AdjustStockPanel item={adjusting} onClose={() => setAdjusting(null)} />}
      </Drawer>
    </div>
  )
}
