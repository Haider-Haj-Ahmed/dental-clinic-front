import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Trash2, Loader2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { PaginatedResponse } from '@/types'

interface Payment {
  id: number; amount: number; paid_at: string
  reference: string | null; notes: string | null
  invoice_id: number; patient_id: number
  payment_method: { id: number; name: string } | null
  recorded_by: { id: number; name: string } | null
  patient: { id: number; full_name: string } | null
  invoice: { id: number } | null
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function invoiceNo(id: number) { return `#${String(id).padStart(5,'0')}` }

export default function PaymentsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [page, setPage]         = useState(1)
  const qc = useQueryClient()

  const params: Record<string,string> = { page: String(page) }
  if (dateFrom) params.date_from = dateFrom
  if (dateTo)   params.date_to   = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ['payments', params],
    queryFn: () => api.get<PaginatedResponse<Payment>>('/payments', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/payments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['invoices'] }) },
  })

  const payments = data?.data ?? []
  const meta     = data?.meta
  const total    = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">Payments</h2>
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">{(meta?.total ?? 0).toLocaleString()}</span>
        </div>
        {payments.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-zinc-500">Page total</p>
            <p className="text-white font-semibold font-mono text-sm">{fmtCurrency(total)}</p>
          </div>
        )}
      </div>

      {/* Date filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          className="h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/40 transition-all" />
        <span className="text-zinc-600 text-xs">to</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
          className="h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/40 transition-all" />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>
        )}
      </div>

      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['ID','Patient','Invoice','Amount','Method','Date','Recorded By',''].map(h => (
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
              {!isLoading && payments.length === 0 && <tr><td colSpan={8} className="px-4 py-16 text-center text-zinc-600 text-sm">No payments found</td></tr>}
              {!isLoading && payments.map(p => (
                <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-3 text-zinc-600 text-xs font-mono">#{p.id}</td>
                  <td className="px-4 py-3 text-zinc-300 text-xs whitespace-nowrap">{p.patient?.full_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {p.invoice ? <span className="text-indigo-400 text-xs font-mono">{invoiceNo(p.invoice.id)}</span> : <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="px-4 py-3 text-white text-sm font-semibold font-mono whitespace-nowrap">{fmtCurrency(p.amount)}</td>
                  <td className="px-4 py-3">
                    {p.payment_method
                      ? <span className="text-xs text-zinc-300 bg-white/[0.05] border border-white/[0.07] rounded px-2 py-0.5">{p.payment_method.name}</span>
                      : <span className="text-zinc-700 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(p.paid_at)}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{p.recorded_by?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { if (confirm('Delete this payment? The invoice status will be recalculated.')) deleteMutation.mutate(p.id) }}
                      disabled={deleteMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                    </button>
                  </td>
                </tr>
              ))}
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
    </div>
  )
}
