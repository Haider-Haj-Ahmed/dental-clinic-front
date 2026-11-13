import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { portalApi, getPortalToken } from '@/portal/lib/portalApi'
import { cn } from '@/lib/utils'

interface PortalInvoice {
  id: number; number: string; issued_at: string; status: string
  total: number; amount_paid: number; balance_due: number; currency: string
}

function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function fmtCurrency(n: number, sym = '$') { return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function DownloadBtn({ invoiceId }: { invoiceId: number }) {
  const [loading, setLoading] = useState(false)
  async function download() {
    setLoading(true)
    try {
      const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
      const res  = await fetch(`${base}/portal/invoices/${invoiceId}/pdf`, { headers: { Authorization: `Bearer ${getPortalToken()}` } })
      const blob = await res.blob()
      const a    = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `invoice-${invoiceId}.pdf`; a.click()
    } finally { setLoading(false) }
  }
  return (
    <button onClick={download} disabled={loading}
      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-teal-400 border border-teal-500/20 hover:bg-teal-500/10 transition-colors disabled:opacity-50">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" strokeWidth={1.8} />}
      PDF
    </button>
  )
}

export default function PortalInvoicesPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['portal-invoices', page],
    queryFn: () => portalApi.get<{ data: PortalInvoice[]; total: number; current_page: number; last_page: number }>('/invoices', { params: { page } }).then(r => r.data),
    placeholderData: prev => prev,
  })
  const invoices = data?.data ?? []; const lastPage = data?.last_page ?? 1
  return (
    <div className="space-y-4">
      <h1 className="text-white font-semibold">My Invoices</h1>
      {isLoading && Array(4).fill(0).map((_,i) => <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />)}
      {!isLoading && invoices.length === 0 && (
        <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl px-5 py-12 text-center">
          <FileText className="w-10 h-10 text-zinc-700 mx-auto mb-3" strokeWidth={1.4} />
          <p className="text-zinc-600">No invoices found</p>
        </div>
      )}
      {invoices.map(inv => (
        <div key={inv.id} className={cn('bg-[#0f1120] border rounded-xl p-5 space-y-3', inv.balance_due > 0 ? 'border-amber-500/20' : 'border-white/[0.07]')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-white font-semibold font-mono">{inv.number}</p>
              <p className="text-zinc-500 text-xs mt-0.5">Issued {fmtDate(inv.issued_at)}</p>
            </div>
            <p className="text-white text-xl font-bold font-mono">{fmtCurrency(inv.total, inv.currency)}</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div><p className="text-zinc-600">Paid</p><p className="text-emerald-400 font-mono font-semibold">{fmtCurrency(inv.amount_paid, inv.currency)}</p></div>
            {inv.balance_due > 0 && <div><p className="text-zinc-600">Balance Due</p><p className="text-amber-400 font-mono font-semibold">{fmtCurrency(inv.balance_due, inv.currency)}</p></div>}
          </div>
          <DownloadBtn invoiceId={inv.id} />
        </div>
      ))}
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-zinc-500 text-sm">{page} / {lastPage}</span>
          <button onClick={() => setPage(p=>Math.min(lastPage,p+1))} disabled={page===lastPage} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  )
}
