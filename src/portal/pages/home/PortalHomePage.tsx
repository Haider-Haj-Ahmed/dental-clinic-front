import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Clock, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { portalApi } from '@/portal/lib/portalApi'
import { usePortalAuthStore } from '@/portal/store/portalAuthStore'
import { cn } from '@/lib/utils'

interface UpcomingAppt {
  id: number; start_at: string; end_at: string
  status: string; type: string | null; provider: string | null
}

const STATUS_CLS: Record<string, string> = {
  scheduled: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  confirmed: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
  }
}

export default function PortalHomePage() {
  const patient = usePortalAuthStore(s => s.patient)

  const { data, isLoading } = useQuery({
    queryKey: ['portal-upcoming'],
    queryFn: () => portalApi.get<{ data: UpcomingAppt[] }>('/appointments/upcoming').then(r => r.data.data),
  })

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-br from-teal-500/15 to-teal-600/5 border border-teal-500/20 rounded-2xl p-6">
        <p className="text-zinc-400 text-sm">Welcome back,</p>
        <p className="text-white text-2xl font-bold mt-0.5">{patient?.first_name} {patient?.last_name}</p>
        <p className="text-zinc-500 text-xs mt-2">{patient?.email ?? patient?.phone}</p>
      </div>

      {/* Upcoming Appointments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-sm">Upcoming Appointments</h2>
          <Link to="/portal/appointments" className="text-teal-400 hover:text-teal-300 text-xs flex items-center gap-0.5 transition-colors">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading && Array(2).fill(0).map((_,i) => <div key={i} className="h-16 bg-white/[0.03] rounded-xl mb-2 animate-pulse" />)}

        {!isLoading && (!data || data.length === 0) && (
          <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl px-5 py-8 text-center">
            <CalendarDays className="w-8 h-8 text-zinc-700 mx-auto mb-2" strokeWidth={1.4} />
            <p className="text-zinc-600 text-sm">No upcoming appointments</p>
          </div>
        )}

        {data?.map(appt => {
          const { date, time } = fmtDateTime(appt.start_at)
          return (
            <div key={appt.id} className="bg-[#0f1120] border border-white/[0.07] rounded-xl px-4 py-3.5 mb-2 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-teal-500/15 border border-teal-500/20 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4.5 h-4.5 text-teal-400" style={{ width: '1.125rem', height: '1.125rem' }} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{appt.type ?? 'Appointment'}</p>
                <p className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1.5">
                  <span>{date}</span>
                  <span>·</span>
                  <Clock className="w-3 h-3" strokeWidth={1.8} />
                  <span>{time}</span>
                  {appt.provider && <><span>·</span><span>{appt.provider}</span></>}
                </p>
              </div>
              <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0',
                STATUS_CLS[appt.status] ?? 'text-zinc-400 bg-zinc-700/30 border-zinc-700',
              )}>{appt.status}</span>
            </div>
          )
        })}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { to: '/portal/invoices',      label: 'My Invoices',      icon: '🧾', desc: 'View & download' },
          { to: '/portal/prescriptions', label: 'Prescriptions',    icon: '💊', desc: 'Your medications' },
        ].map(({ to, label, icon, desc }) => (
          <Link key={to} to={to} className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-4 hover:border-teal-500/30 transition-colors group">
            <span className="text-2xl">{icon}</span>
            <p className="text-white text-sm font-medium mt-2">{label}</p>
            <p className="text-zinc-600 text-xs mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
