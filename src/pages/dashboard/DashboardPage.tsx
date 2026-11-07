import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays, CheckCircle2, Clock,
  TrendingUp, FileText, UserPlus,
  Users, Bell, Package, AlertCircle, RefreshCw,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardKpis {
  today: {
    appointments_total: number
    appointments_completed: number
    appointments_remaining: number
  }
  month: {
    revenue_collected: number
    invoices_created: number
    new_patients: number
  }
  totals: {
    active_patients: number
    pending_recalls: number
    low_stock_items: number
    outstanding_balance: number
  }
}

interface AppointmentsReport {
  total: number
  by_day: Record<string, number>
}

interface CollectionsReport {
  collection_rate: number
  by_day: Record<string, number>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n)
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string | number
  icon: React.ElementType
  iconColor: string
  iconBg: string
  sub?: string
  variant?: 'default' | 'warning' | 'danger'
}

function KpiCard({ label, value, icon: Icon, iconColor, iconBg, sub, variant = 'default' }: KpiCardProps) {
  return (
    <div
      className={cn(
        'bg-[#0f1120] border rounded-xl p-5 flex items-start gap-4',
        variant === 'warning' && 'border-yellow-500/20',
        variant === 'danger'  && 'border-red-500/20',
        variant === 'default' && 'border-white/[0.07]',
      )}
    >
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
        <Icon className={cn('w-4 h-4', iconColor)} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-zinc-500 text-xs font-medium mb-1 truncate">{label}</p>
        <p
          className={cn(
            'text-xl font-bold tracking-tight leading-none',
            variant === 'warning' && 'text-yellow-400',
            variant === 'danger'  && 'text-red-400',
            variant === 'default' && 'text-white',
          )}
        >
          {value}
        </p>
        {sub && <p className="text-zinc-600 text-xs mt-1.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5 flex items-start gap-4 animate-pulse">
      <div className="w-9 h-9 rounded-lg bg-white/[0.05] shrink-0" />
      <div className="flex-1 space-y-2.5 pt-0.5">
        <div className="h-2.5 bg-white/[0.05] rounded w-20" />
        <div className="h-5 bg-white/[0.05] rounded w-14" />
      </div>
    </div>
  )
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function BarChart({ data, color }: { data: Record<string, number>; color: string }) {
  const entries = Object.entries(data)
  if (!entries.length) return <EmptyChart />
  const max = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div className="flex items-end gap-px h-20 w-full">
      {entries.map(([date, value]) => (
        <div
          key={date}
          title={`${date}: ${value}`}
          className="flex-1 rounded-sm transition-opacity opacity-60 hover:opacity-100 cursor-default"
          style={{ height: `${Math.max(3, (value / max) * 80)}px`, backgroundColor: color }}
        />
      ))}
    </div>
  )
}

// ── Line Chart ────────────────────────────────────────────────────────────────

function LineChart({ data, color }: { data: Record<string, number>; color: string }) {
  const entries = Object.entries(data)
  if (entries.length < 2) return <EmptyChart />

  const W = 400
  const H = 80
  const vals = entries.map(([, v]) => v)
  const max  = Math.max(...vals, 1)
  const min  = Math.min(...vals, 0)
  const rng  = max - min || 1

  const pts = entries
    .map(([, v], i) => {
      const x = (i / (entries.length - 1)) * W
      const y = H - ((v - min) / rng) * (H - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const fill = `0,${H} ${pts} ${W},${H}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`lg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fill} fill={`url(#lg-${color.replace('#', '')})`} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EmptyChart() {
  return (
    <div className="h-20 flex items-center justify-center text-zinc-700 text-xs">
      No data for this period
    </div>
  )
}

// ── Section Label ─────────────────────────────────────────────────────────────

function Section({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/[0.05]" />
    </div>
  )
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const {
    data: kpis,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () =>
      api.get<{ data: DashboardKpis }>('/dashboard/kpis').then(r => r.data.data),
  })

  const { data: apptReport } = useQuery({
    queryKey: ['reports-appointments'],
    queryFn: () =>
      api.get<{ data: AppointmentsReport }>('/reports/appointments').then(r => r.data.data),
  })

  const { data: collectReport } = useQuery({
    queryKey: ['reports-collections'],
    queryFn: () =>
      api.get<{ data: CollectionsReport }>('/reports/collections').then(r => r.data.data),
  })

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-7 h-7 text-red-500/50" />
        <p className="text-zinc-500 text-sm">Failed to load dashboard.</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    )
  }

  const today  = kpis?.today
  const month  = kpis?.month
  const totals = kpis?.totals

  const completionRate =
    today?.appointments_total
      ? Math.round((today.appointments_completed / today.appointments_total) * 100)
      : 0

  return (
    <div className="max-w-6xl space-y-8">

      {/* ── Today ─────────────────────────────────────────────────────── */}
      <div>
        <Section label="Today" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isLoading ? Array(3).fill(0).map((_, i) => <SkeletonCard key={i} />) : (
            <>
              <KpiCard
                label="Total Appointments"
                value={fmtNum(today?.appointments_total ?? 0)}
                icon={CalendarDays}
                iconColor="text-indigo-400"
                iconBg="bg-indigo-500/15"
              />
              <KpiCard
                label="Completed"
                value={fmtNum(today?.appointments_completed ?? 0)}
                icon={CheckCircle2}
                iconColor="text-emerald-400"
                iconBg="bg-emerald-500/15"
                sub={`${completionRate}% completion rate`}
              />
              <KpiCard
                label="Remaining"
                value={fmtNum(today?.appointments_remaining ?? 0)}
                icon={Clock}
                iconColor="text-sky-400"
                iconBg="bg-sky-500/15"
              />
            </>
          )}
        </div>
      </div>

      {/* ── This Month ────────────────────────────────────────────────── */}
      <div>
        <Section label="This Month" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isLoading ? Array(3).fill(0).map((_, i) => <SkeletonCard key={i} />) : (
            <>
              <KpiCard
                label="Revenue Collected"
                value={fmtCurrency(month?.revenue_collected ?? 0)}
                icon={TrendingUp}
                iconColor="text-emerald-400"
                iconBg="bg-emerald-500/15"
              />
              <KpiCard
                label="Invoices Created"
                value={fmtNum(month?.invoices_created ?? 0)}
                icon={FileText}
                iconColor="text-indigo-400"
                iconBg="bg-indigo-500/15"
              />
              <KpiCard
                label="New Patients"
                value={fmtNum(month?.new_patients ?? 0)}
                icon={UserPlus}
                iconColor="text-violet-400"
                iconBg="bg-violet-500/15"
              />
            </>
          )}
        </div>
      </div>

      {/* ── Totals ────────────────────────────────────────────────────── */}
      <div>
        <Section label="Overview" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {isLoading ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />) : (
            <>
              <KpiCard
                label="Active Patients"
                value={fmtNum(totals?.active_patients ?? 0)}
                icon={Users}
                iconColor="text-indigo-400"
                iconBg="bg-indigo-500/15"
              />
              <KpiCard
                label="Pending Recalls"
                value={fmtNum(totals?.pending_recalls ?? 0)}
                icon={Bell}
                iconColor={totals?.pending_recalls ? 'text-yellow-400' : 'text-zinc-500'}
                iconBg={totals?.pending_recalls ? 'bg-yellow-500/15' : 'bg-white/[0.05]'}
                variant={totals?.pending_recalls ? 'warning' : 'default'}
              />
              <KpiCard
                label="Low Stock Items"
                value={fmtNum(totals?.low_stock_items ?? 0)}
                icon={Package}
                iconColor={totals?.low_stock_items ? 'text-orange-400' : 'text-zinc-500'}
                iconBg={totals?.low_stock_items ? 'bg-orange-500/15' : 'bg-white/[0.05]'}
                variant={totals?.low_stock_items ? 'warning' : 'default'}
              />
              <KpiCard
                label="Outstanding Balance"
                value={fmtCurrency(totals?.outstanding_balance ?? 0)}
                icon={AlertCircle}
                iconColor={totals?.outstanding_balance ? 'text-red-400' : 'text-zinc-500'}
                iconBg={totals?.outstanding_balance ? 'bg-red-500/15' : 'bg-white/[0.05]'}
                variant={totals?.outstanding_balance ? 'danger' : 'default'}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Charts ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Appointments by day */}
        <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-white text-sm font-semibold">Appointments</p>
              <p className="text-zinc-600 text-xs mt-0.5">This month · by day</p>
            </div>
            {apptReport && (
              <span className="text-zinc-500 text-xs font-medium">{apptReport.total} total</span>
            )}
          </div>
          {apptReport?.by_day
            ? <BarChart data={apptReport.by_day} color="#6366f1" />
            : <div className="h-20 bg-white/[0.03] rounded animate-pulse" />
          }
        </div>

        {/* Collections by day */}
        <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-white text-sm font-semibold">Collections</p>
              <p className="text-zinc-600 text-xs mt-0.5">This month · by day</p>
            </div>
            {collectReport && (
              <span className="text-zinc-500 text-xs font-medium">
                {collectReport.collection_rate}% rate
              </span>
            )}
          </div>
          {collectReport?.by_day
            ? <LineChart data={collectReport.by_day} color="#10b981" />
            : <div className="h-20 bg-white/[0.03] rounded animate-pulse" />
          }
        </div>

      </div>
    </div>
  )
}
