import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, Calendar,
  FileText, ClipboardList, Pill, Receipt, CreditCard, Calendar,
  Package, Truck, BarChart2, UserCog, Settings, Shield,
  ChevronLeft, ChevronRight, Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

interface NavItem  { label: string; icon: React.ElementType; to: string; roles: string[] }
interface NavGroup { section: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', roles: ['owner','provider','receptionist'] },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Patients',      icon: Users,       to: '/patients',      roles: ['owner','provider','receptionist'] },
      { label: 'Appointments',  icon: CalendarDays, to: '/appointments',  roles: ['owner','provider','receptionist'] },
      { label: 'Providers',     icon: Stethoscope, to: '/providers',     roles: ['owner'] },
      { label: 'Recalls',       icon: Bell,        to: '/recalls',       roles: ['owner','provider','receptionist'] },
    ],
  },
  {
    section: 'Clinical',
    items: [
      { label: 'Encounters',      icon: FileText,      to: '/encounters',      roles: ['owner','provider'] },
      { label: 'Treatment Plans', icon: ClipboardList, to: '/treatment-plans', roles: ['owner','provider'] },
      { label: 'Prescriptions',   icon: Pill,          to: '/prescriptions',   roles: ['owner','provider'] },
    ],
  },
  {
    section: 'Billing',
    items: [
      { label: 'Invoices', icon: Receipt,    to: '/invoices', roles: ['owner','receptionist'] },
      { label: 'Payments',       icon: CreditCard, to: '/payments',       roles: ['owner','receptionist'] },
      { label: 'Payment Plans', icon: Calendar,   to: '/payment-plans', roles: ['owner','receptionist'] },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { label: 'Inventory', icon: Package, to: '/inventory', roles: ['owner'] },
      { label: 'Suppliers', icon: Truck,   to: '/suppliers', roles: ['owner'] },
    ],
  },
  {
    section: 'Admin',
    items: [
      { label: 'Reports',    icon: BarChart2, to: '/reports',    roles: ['owner'] },
      { label: 'Staff',      icon: UserCog,  to: '/users',      roles: ['owner'] },
      { label: 'Settings',   icon: Settings, to: '/settings',   roles: ['owner'] },
      { label: 'Audit Logs', icon: Shield,   to: '/audit-logs', roles: ['owner'] },
    ],
  },
]

interface SidebarProps { collapsed: boolean; onToggle: () => void }

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const user = useAuthStore(s => s.user)
  const role = user?.role ?? ''

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-screen flex flex-col z-30',
      'bg-[#0b0d1a] border-r border-white/[0.06]',
      'transition-all duration-300 ease-in-out',
      collapsed ? 'w-[68px]' : 'w-64',
    )}>

      {/* Brand */}
      <div className={cn(
        'flex items-center gap-3 h-14 border-b border-white/[0.06] shrink-0 px-4',
        collapsed && 'justify-center px-0',
      )}>
        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <Stethoscope className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold tracking-tight truncate">Dental PMS</p>
            <p className="text-zinc-600 text-[10px]">Staff Portal</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2.5 space-y-0.5"
        style={{ scrollbarWidth: 'none' }}>
        {NAV.map(({ section, items }) => {
          const visible = items.filter(i => i.roles.includes(role))
          if (!visible.length) return null
          return (
            <div key={section} className="mb-1">
              {!collapsed && (
                <p className="text-zinc-700 text-[10px] font-semibold uppercase tracking-widest px-2.5 pt-4 pb-1 select-none">
                  {section}
                </p>
              )}
              {collapsed && <div className="h-3" />}
              {visible.map(({ label, icon: Icon, to }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) => cn(
                    'relative flex items-center rounded-lg text-sm transition-all duration-150 group',
                    collapsed ? 'justify-center h-9 w-full' : 'gap-2.5 px-2.5 py-2',
                    isActive
                      ? 'bg-indigo-500/[0.1] text-indigo-300'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]',
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {/* Active left-border pill */}
                      {isActive && !collapsed && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-indigo-400 rounded-r-full" />
                      )}
                      <Icon
                        className={cn('shrink-0 transition-colors', collapsed ? 'w-[18px] h-[18px]' : 'w-4 h-4')}
                        strokeWidth={isActive ? 2.2 : 1.7}
                      />
                      {!collapsed && (
                        <span className={cn('truncate font-medium', isActive ? 'text-indigo-200' : '')}>{label}</span>
                      )}
                      {/* Tooltip when collapsed */}
                      {collapsed && (
                        <span className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-[#1a1d2e] border border-white/[0.1] rounded-lg text-xs text-white whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                          {label}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-white/[0.06] p-2.5">
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center rounded-lg px-2.5 py-2',
            'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors',
            collapsed ? 'justify-center' : 'gap-2.5',
          )}
        >
          <div className={cn('transition-transform duration-300', collapsed ? 'rotate-0' : 'rotate-0')}>
            {collapsed
              ? <ChevronRight className="w-4 h-4" strokeWidth={1.8} />
              : <ChevronLeft  className="w-4 h-4" strokeWidth={1.8} />
            }
          </div>
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
