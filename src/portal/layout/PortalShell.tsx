import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { CalendarDays, FileText, Pill, Home, LogOut } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { portalApi } from '@/portal/lib/portalApi'
import { usePortalAuthStore } from '@/portal/store/portalAuthStore'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/portal',              label: 'Home',            icon: Home         },
  { to: '/portal/appointments', label: 'Appointments',    icon: CalendarDays },
  { to: '/portal/invoices',     label: 'Invoices',        icon: FileText     },
  { to: '/portal/prescriptions',label: 'Prescriptions',   icon: Pill         },
]

export default function PortalShell() {
  const patient  = usePortalAuthStore(s => s.patient)
  const logout   = usePortalAuthStore(s => s.logout)
  const navigate = useNavigate()

  const logoutMutation = useMutation({
    mutationFn: () => portalApi.post('/auth/logout'),
    onSettled: () => { logout(); navigate('/portal/login') },
  })

  return (
    <div className="min-h-screen bg-[#0a0c14] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-[#0d0f1c]/90 backdrop-blur-md border-b border-white/[0.07] flex items-center justify-between px-5 h-14 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
            <span className="text-teal-400 text-[10px] font-bold">
              {patient?.first_name?.[0]}{patient?.last_name?.[0]}
            </span>
          </div>
          <div>
            <p className="text-white text-xs font-semibold leading-none">{patient?.first_name} {patient?.last_name}</p>
            <p className="text-zinc-600 text-[10px] mt-0.5">Patient Portal</p>
          </div>
        </div>
        <button onClick={() => logoutMutation.mutate()}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <LogOut className="w-3.5 h-3.5" strokeWidth={1.8} /> Sign out
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-[#0d0f1c]/95 backdrop-blur-md border-t border-white/[0.07]">
        <div className="flex items-center max-w-2xl mx-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/portal'}
              className={({ isActive }) => cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-teal-400' : 'text-zinc-600 hover:text-zinc-400',
              )}>
              {({ isActive }) => (
                <>
                  <Icon className="w-4.5 h-4.5" style={{ width: '1.125rem', height: '1.125rem' }} strokeWidth={isActive ? 2 : 1.6} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
