import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, Loader2, RefreshCw, BarChart2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function fmtNum(n: number) { return new Intl.NumberFormat('en-US').format(n) }

function pastMonthStart() {
  const d = new Date(); d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
function todayStr() { return new Date().toISOString().slice(0, 10) }

function getToken() {
  try { return JSON.parse(localStorage.getItem('dental-auth') || '{}')?.state?.token ?? '' } catch { return '' }
}

async function downloadReport(type: string, format: 'pdf' | 'xlsx', params: Record<string, string>) {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
  const q    = new URLSearchParams({ ...params, format }).toString()
  const res  = await fetch(`${base}/reports/${type}?${q}`, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!res.ok) return
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `${type}-report.${format}`; a.click()
  URL.revokeObjectURL(url)
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
      <p className="text-xs text-zinc-600 uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className="text-white text-xl font-bold font-mono">{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (!rows.length) return <p className="text-zinc-700 text-xs py-4 text-center">No data</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {headers.map(h => <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn('border-b border-white/[0.04] last:border-b-0', i % 2 === 0 ? '' : 'bg-white/[0.01]')}>
              {row.map((cell, j) => <td key={j} className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BarMini({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data)
  if (!entries.length) return null
  const max = Math.max(...entries.map(([,v])=>v), 1)
  return (
    <div className="flex items-end gap-px h-16 w-full mt-2">
      {entries.map(([date, value]) => (
        <div key={date} title={`${date}: ${value}`}
          className="flex-1 rounded-sm bg-indigo-500/50 hover:bg-indigo-500/80 transition-colors cursor-default"
          style={{ height: `${Math.max(2, (value/max)*64)}px` }} />
      ))}
    </div>
  )
}

function ExportButtons({ type, params, loading, setLoading }: { type: string; params: Record<string,string>; loading: boolean; setLoading: (v: boolean) => void }) {
  async function dl(fmt: 'pdf' | 'xlsx') {
    setLoading(true)
    await downloadReport(type, fmt, params).catch(() => {})
    setLoading(false)
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => dl('pdf')} disabled={loading}
        className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs text-zinc-400 border border-white/[0.08] hover:bg-white/[0.06] transition-colors disabled:opacity-50">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" strokeWidth={1.8} />} PDF
      </button>
      <button onClick={() => dl('xlsx')} disabled={loading}
        className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs text-zinc-400 border border-white/[0.08] hover:bg-white/[0.06] transition-colors disabled:opacity-50">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" strokeWidth={1.8} />} Excel
      </button>
    </div>
  )
}

// ── Report Components ─────────────────────────────────────────────────────────

function AppointmentsReport({ params }: { params: Record<string,string> }) {
  const [dlLoading, setDlLoading] = useState(false)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report-appointments', params],
    queryFn: () => api.get<{ data: { total: number; by_status: Record<string,number>; by_provider: { provider_name: string; count: number }[]; by_day: Record<string,number> } }>('/reports/appointments', { params }).then(r => r.data.data),
  })
  if (isLoading) return <div className="h-40 bg-white/[0.03] rounded-xl animate-pulse" />
  if (!data) return null
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
          <KpiCard label="Total" value={fmtNum(data.total)} />
          {Object.entries(data.by_status ?? {}).map(([s,n]) => <KpiCard key={s} label={s.replace('_',' ')} value={fmtNum(n)} />)}
        </div>
      </div>
      <BarMini data={data.by_day ?? {}} />
      {data.by_provider?.length > 0 && (
        <SimpleTable headers={['Provider','Appointments']} rows={data.by_provider.map(p => [p.provider_name, fmtNum(p.count)])} />
      )}
      <div className="flex justify-end"><ExportButtons type="appointments" params={params} loading={dlLoading} setLoading={setDlLoading} /></div>
    </div>
  )
}

function ProductionReport({ params }: { params: Record<string,string> }) {
  const [dlLoading, setDlLoading] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['report-production', params],
    queryFn: () => api.get<{ data: { total_billed: number; by_provider: { provider_name: string; total: number }[]; by_day: Record<string,number> } }>('/reports/production', { params }).then(r => r.data.data),
  })
  if (isLoading) return <div className="h-40 bg-white/[0.03] rounded-xl animate-pulse" />
  if (!data) return null
  return (
    <div className="space-y-4">
      <KpiCard label="Total Billed" value={fmtCurrency(data.total_billed)} />
      <BarMini data={data.by_day ?? {}} />
      {data.by_provider?.length > 0 && (
        <SimpleTable headers={['Provider','Billed']} rows={data.by_provider.map(p => [p.provider_name, fmtCurrency(p.total)])} />
      )}
      <div className="flex justify-end"><ExportButtons type="production" params={params} loading={dlLoading} setLoading={setDlLoading} /></div>
    </div>
  )
}

function CollectionsReport({ params }: { params: Record<string,string> }) {
  const [dlLoading, setDlLoading] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['report-collections', params],
    queryFn: () => api.get<{ data: { total_collected: number; total_billed: number; collection_rate: number; by_payment_method: { method: string; total: number; count: number }[]; by_day: Record<string,number> } }>('/reports/collections', { params }).then(r => r.data.data),
  })
  if (isLoading) return <div className="h-40 bg-white/[0.03] rounded-xl animate-pulse" />
  if (!data) return null
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Collected" value={fmtCurrency(data.total_collected)} />
        <KpiCard label="Billed" value={fmtCurrency(data.total_billed)} />
        <KpiCard label="Collection Rate" value={`${data.collection_rate}%`} />
      </div>
      <BarMini data={data.by_day ?? {}} />
      {data.by_payment_method?.length > 0 && (
        <SimpleTable headers={['Method','Amount','Transactions']} rows={data.by_payment_method.map(m => [m.method, fmtCurrency(m.total), fmtNum(m.count)])} />
      )}
      <div className="flex justify-end"><ExportButtons type="collections" params={params} loading={dlLoading} setLoading={setDlLoading} /></div>
    </div>
  )
}

function RecallReport({ params }: { params: Record<string,string> }) {
  const [dlLoading, setDlLoading] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['report-recall', params],
    queryFn: () => api.get<{ data: { total_due: number; contacted: number; confirmed: number; completed: number } }>('/reports/recall-performance', { params }).then(r => r.data.data),
  })
  if (isLoading) return <div className="h-24 bg-white/[0.03] rounded-xl animate-pulse" />
  if (!data) return null
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Due" value={fmtNum(data.total_due)} />
        <KpiCard label="Contacted" value={fmtNum(data.contacted)} />
        <KpiCard label="Confirmed" value={fmtNum(data.confirmed)} />
        <KpiCard label="Completed" value={fmtNum(data.completed)} />
      </div>
      <div className="flex justify-end"><ExportButtons type="recall-performance" params={params} loading={dlLoading} setLoading={setDlLoading} /></div>
    </div>
  )
}

function InventoryReport({ params }: { params: Record<string,string> }) {
  const [dlLoading, setDlLoading] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['report-inventory', params],
    queryFn: () => api.get<{ data: { total_items: number; low_stock_items: number; by_category: { category: string; count: number; value: number }[]; low_stock_list: { name: string; current_stock: number; reorder_level: number }[] } }>('/reports/inventory', { params }).then(r => r.data.data),
  })
  if (isLoading) return <div className="h-40 bg-white/[0.03] rounded-xl animate-pulse" />
  if (!data) return null
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total Items" value={fmtNum(data.total_items)} />
        <KpiCard label="Low Stock" value={fmtNum(data.low_stock_items)} sub={data.low_stock_items > 0 ? 'Need reordering' : 'All good'} />
      </div>
      {data.by_category?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">By Category</p>
          <SimpleTable headers={['Category','Items','Value']} rows={data.by_category.map(c => [c.category ?? 'Uncategorized', fmtNum(c.count), fmtCurrency(c.value)])} />
        </div>
      )}
      {data.low_stock_list?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">Low Stock Items</p>
          <SimpleTable headers={['Item','Stock','Reorder At']} rows={data.low_stock_list.map(i => [i.name, i.current_stock, i.reorder_level])} />
        </div>
      )}
      <div className="flex justify-end"><ExportButtons type="inventory" params={params} loading={dlLoading} setLoading={setDlLoading} /></div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabId = 'appointments' | 'production' | 'collections' | 'recalls' | 'inventory'

const TABS: { id: TabId; label: string }[] = [
  { id: 'appointments', label: 'Appointments' },
  { id: 'production',   label: 'Production'   },
  { id: 'collections',  label: 'Collections'  },
  { id: 'recalls',      label: 'Recalls'      },
  { id: 'inventory',    label: 'Inventory'    },
]

export default function ReportsPage() {
  const [tab, setTab]           = useState<TabId>('appointments')
  const [dateFrom, setDateFrom] = useState(pastMonthStart())
  const [dateTo, setDateTo]     = useState(todayStr())

  const params: Record<string,string> = {}
  if (dateFrom) params.date_from = dateFrom
  if (dateTo)   params.date_to   = dateTo

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-indigo-400" strokeWidth={1.8} />
          <h2 className="text-white font-semibold">Reports</h2>
        </div>
        {/* Date range */}
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/40 transition-all" />
          <span className="text-zinc-600 text-xs">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/40 transition-all" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('h-8 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              tab===t.id ? 'bg-[#0f1120] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300',
            )}>{t.label}</button>
        ))}
      </div>

      {/* Report content */}
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5">
        {tab === 'appointments' && <AppointmentsReport params={params} />}
        {tab === 'production'   && <ProductionReport params={params} />}
        {tab === 'collections'  && <CollectionsReport params={params} />}
        {tab === 'recalls'      && <RecallReport params={params} />}
        {tab === 'inventory'    && <InventoryReport params={params} />}
      </div>
    </div>
  )
}
