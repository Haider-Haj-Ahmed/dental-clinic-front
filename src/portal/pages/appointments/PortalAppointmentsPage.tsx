import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { portalApi } from '@/portal/lib/portalApi'
import { cn } from '@/lib/utils'

interface Appt {
  id: number; start_at: string; end_at: string
  status: string; type: string | null; provider: string | null; operatory: string | null; notes: string | null
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Scheduled', cls: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  confirmed: { label: 'Confirmed', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20'         },
  completed: { label: 'Completed', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  cancelled: { label: 'Cancelled', cls: 'text-red-400 bg-red-500/10 border-red-500/20'         },
  no_show:   { label: 'No Show',   cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20'   },
}

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) }
function duration(s: string, e: string) { const m = Math.round((new Date(e).getTime()-new Date(s).getTime())/60000); return m >= 60 ? `${Math.floor(m/60)}h${m%60?` ${m%60}m`:''}` : `${m}m` }

export default function PortalAppointmentsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['portal-appointments', page],
    queryFn: () => portalApi.get<{ data: Appt[]; total: number; current_page: number; last_page: number }>('/appointments', { params: { page } }).then(r => r.data),
    placeholderData: prev => prev,
  })
  const appts = data?.data ?? []; const lastPage = data?.last_page ?? 1
  return (
    <div className="space-y-4">
      <h1 className="text-white font-semibold">My Appointments</h1>
      {isLoading && Array(4).fill(0).map((_,i) => <div key={i} className="h-24 bg-white/[0.03] rounded-xl animate-pulse" />)}
      {!isLoading && appts.length === 0 && (
        <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl px-5 py-12 text-center">
          <CalendarDays className="w-10 h-10 text-zinc-700 mx-auto mb-3" strokeWidth={1.4} />
          <p className="text-zinc-600">No appointments found</p>
        </div>
      )}
      {appts.map(appt => {
        const cfg = STATUS_CFG[appt.status] ?? { label: appt.status, cls: 'text-zinc-400 bg-zinc-700/30 border-zinc-700' }
        return (
          <div key={appt.id} className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-semibold">{appt.type ?? 'Appointment'}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{appt.provider ? `With ${appt.provider}` : ''}{appt.operatory ? ` · ${appt.operatory}` : ''}</p>
              </div>
              <span className={cn('text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0', cfg.cls)}>{cfg.label}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" strokeWidth={1.8} />{fmtDate(appt.start_at)}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" strokeWidth={1.8} />{fmtTime(appt.start_at)} – {fmtTime(appt.end_at)} ({duration(appt.start_at, appt.end_at)})</span>
            </div>
            {appt.notes && <p className="text-zinc-600 text-xs bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">{appt.notes}</p>}
          </div>
        )
      })}
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
