import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, CalendarDays, Stethoscope,
  FileText, ClipboardList, Pill, Receipt, CreditCard,
  Package, Truck, BarChart2, UserCog, Settings, Shield,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

interface NavItem {
  label: string
  icon: React.ElementType
  to: string
  roles: string[]
}

interface NavSection {
  section: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard',   icon: LayoutDashboard, to: '/dashboard',   roles: ['owner', 'provider', 'receptionist'] },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Patients',     icon: Users,       to: '/patients',     roles: ['owner', 'provider', 'receptionist'] },
      { label: 'Appointments', icon: CalendarDays, to: '/appointments', roles: ['owner', 'provider', 'receptionist'] },
      { label: 'Providers',    icon: Stethoscope, to: '/providers',    roles: ['owner'] },
    ],
  },
  {
    section: 'Clinical',
    items: [
      { label: 'Encounters',      icon: FileText,     to: '/encounters',      roles: ['owner', 'provider'] },
      { label: 'Treatment Plans', icon: ClipboardList, to: '/treatment-plans', roles: ['owner', 'provider'] },
      { label: 'Prescriptions',   icon: Pill,         to: '/prescriptions',   roles: ['owner', 'provider'] },
    ],
  },
  {
    section: 'Billing',
    items: [
      { label: 'Invoices', icon: Receipt,    to: '/invoices', roles: ['owner', 'receptionist'] },
      { label: 'Payments', icon: CreditCard, to: '/payments', roles: ['owner', 'receptionist'] },
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

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const user = useAuthStore(s => s.user)
  const role = user?.role ?? ''

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen flex flex-col',
        'bg-[#0d0f1c] border-r border-white/[0.06] z-30',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center h-14 border-b border-white/[0.06] shrink-0',
          collapsed ? 'justify-center' : 'px-4 gap-3',
        )}
      >
        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <Stethoscope className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
        </div>
        {!collapsed && (
          <span className="text-white font-semibold text-sm tracking-tight truncate">
            Dental PMS
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-px">
        {NAV.map(({ section, items }) => {
          const visible = items.filter(i => i.roles.includes(role))
          if (!visible.length) return null

          return (
            <div key={section}>
              {!collapsed ? (
                <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-medium px-2 pt-4 pb-1.5 select-none">
                  {section}
                </p>
              ) : (
                <div className="h-3" />
              )}
              {visible.map(({ label, icon: Icon, to }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors duration-150',
                      collapsed && 'justify-center',
                      isActive
                        ? 'bg-indigo-500/15 text-indigo-300'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]',
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-white/[0.06] p-2">
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center rounded-lg px-2 py-2',
            'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors',
            collapsed ? 'justify-center' : 'gap-3',
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" strokeWidth={1.8} />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" strokeWidth={1.8} />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
