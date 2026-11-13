import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pill, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { portalApi } from '@/portal/lib/portalApi'

interface DrugItem { drug_name: string; dose: string | null; frequency: string | null; duration: string | null; instructions: string | null }
interface PortalRx { id: number; issued_at: string; provider: string | null; notes: string | null; items: DrugItem[] }

function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }
function rxNo(id: number) { return `RX-${String(id).padStart(5,'0')}` }

function RxCard({ rx }: { rx: PortalRx }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(v=>!v)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <div>
          <div className="flex items-center gap-2"><span className="text-white font-semibold font-mono text-sm">{rxNo(rx.id)}</span><span className="text-xs text-zinc-600 bg-white/[0.04] border border-white/[0.07] rounded-full px-2 py-0.5">{rx.items.length} drug{rx.items.length !== 1 ? 's' : ''}</span></div>
          <p className="text-zinc-500 text-xs mt-0.5">{fmtDate(rx.issued_at)}{rx.provider ? ` · ${rx.provider}` : ''}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      {expanded && (
        <div className="border-t border-white/[0.06] p-5 space-y-3">
          {rx.notes && <p className="text-zinc-500 text-xs bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">{rx.notes}</p>}
          {rx.items.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-teal-500/15 border border-teal-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Pill className="w-3.5 h-3.5 text-teal-400" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{item.drug_name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {[['Dose',item.dose],['Frequency',item.frequency],['Duration',item.duration]].filter(([,v])=>v).map(([l,v]) => (
                    <p key={l as string} className="text-xs text-zinc-500"><span className="text-zinc-700">{l}: </span>{v}</p>
                  ))}
                </div>
                {item.instructions && <p className="text-xs text-zinc-600 mt-0.5 italic">{item.instructions}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PortalPrescriptionsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['portal-prescriptions', page],
    queryFn: () => portalApi.get<{ data: PortalRx[]; total: number; current_page: number; last_page: number }>('/prescriptions', { params: { page } }).then(r => r.data),
    placeholderData: prev => prev,
  })
  const rxs = data?.data ?? []; const lastPage = data?.last_page ?? 1
  return (
    <div className="space-y-4">
      <h1 className="text-white font-semibold">My Prescriptions</h1>
      {isLoading && Array(3).fill(0).map((_,i) => <div key={i} className="h-24 bg-white/[0.03] rounded-xl animate-pulse" />)}
      {!isLoading && rxs.length === 0 && (
        <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl px-5 py-12 text-center">
          <Pill className="w-10 h-10 text-zinc-700 mx-auto mb-3" strokeWidth={1.4} />
          <p className="text-zinc-600">No prescriptions found</p>
        </div>
      )}
      {rxs.map(rx => <RxCard key={rx.id} rx={rx} />)}
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
