import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { PaginatedResponse } from '@/types'

interface AuditLog {
  id: number; action: string; model_type: string; model_id: number
  old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null
  ip_address: string | null; created_at: string
  user: { id: number; name: string; role: string } | null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const ACTION_CFG: Record<string, { cls: string }> = {
  created:  { cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  updated:  { cls: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'   },
  deleted:  { cls: 'text-red-400 bg-red-500/10 border-red-500/20'            },
  restored: { cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20'      },
}

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CFG[action] ?? { cls: 'text-zinc-400 bg-zinc-700/30 border-zinc-700' }
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize', cfg.cls)}>{action}</span>
}

function JsonDiff({ label, data, cls }: { label: string; data: Record<string, unknown> | null; cls: string }) {
  if (!data || !Object.keys(data).length) return null
  return (
    <div className={cn('rounded-lg border p-3 space-y-1', cls)}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2">{label}</p>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex items-start gap-2 text-xs font-mono">
          <span className="text-zinc-500 shrink-0">{k}:</span>
          <span className="text-zinc-200 break-all">{JSON.stringify(v)}</span>
        </div>
      ))}
    </div>
  )
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)
  const hasDiff = log.old_values || log.new_values

  return (
    <>
      <tr
        onClick={() => hasDiff && setExpanded(v => !v)}
        className={cn('border-b border-white/[0.04] transition-colors', hasDiff ? 'cursor-pointer hover:bg-white/[0.02]' : '')}
      >
        <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{fmtDate(log.created_at)}</td>
        <td className="px-4 py-3">
          {log.user
            ? <div><p className="text-zinc-200 text-xs">{log.user.name}</p><p className="text-zinc-600 text-[10px] capitalize">{log.user.role}</p></div>
            : <span className="text-zinc-700 text-xs">System</span>
          }
        </td>
        <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
        <td className="px-4 py-3">
          <div>
            <span className="text-zinc-300 text-xs font-medium">{log.model_type}</span>
            <span className="text-zinc-600 text-xs ml-1.5">#{log.model_id}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-zinc-700 text-xs">{log.ip_address ?? '—'}</td>
        <td className="px-4 py-3">
          {hasDiff && (
            <span className="text-zinc-600">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/[0.04] bg-white/[0.01]">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <JsonDiff label="Before" data={log.old_values} cls="border-red-500/15 bg-red-500/5" />
              <JsonDiff label="After"  data={log.new_values} cls="border-emerald-500/15 bg-emerald-500/5" />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

const ACTIONS = ['', 'created', 'updated', 'deleted', 'restored']
const MODELS  = ['', 'Patient', 'Appointment', 'Invoice', 'Payment', 'Provider', 'User', 'InventoryItem', 'PurchaseOrder', 'Supplier']

export default function AuditLogsPage() {
  const [action, setAction]     = useState('')
  const [model, setModel]       = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [page, setPage]         = useState(1)

  const params: Record<string,string> = { page: String(page) }
  if (action)   params.action    = action
  if (model)    params.model     = model
  if (dateFrom) params.date_from = dateFrom
  if (dateTo)   params.date_to   = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => api.get<PaginatedResponse<AuditLog>>('/audit-logs', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const logs = data?.data ?? []
  const meta = data?.meta

  const selectCls = 'h-9 px-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-zinc-300 outline-none focus:border-indigo-500/40 transition-all'

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">Audit Logs</h2>
          <span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">{(meta?.total ?? 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }} className={selectCls}>
          <option value="">All Actions</option>
          {ACTIONS.filter(Boolean).map(a => <option key={a} value={a} className="capitalize">{a}</option>)}
        </select>
        <select value={model} onChange={e => { setModel(e.target.value); setPage(1) }} className={selectCls}>
          <option value="">All Models</option>
          {MODELS.filter(Boolean).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          className="h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/40 transition-all" />
        <span className="text-zinc-600 text-xs">to</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
          className="h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/40 transition-all" />
        {(action || model || dateFrom || dateTo) && (
          <button onClick={() => { setAction(''); setModel(''); setDateFrom(''); setDateTo(''); setPage(1) }} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>
        )}
      </div>

      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Timestamp','User','Action','Record','IP',''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array(10).fill(0).map((_,i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array(6).fill(0).map((_,j) => <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/[0.05] rounded animate-pulse w-24" /></td>)}
                </tr>
              ))}
              {!isLoading && logs.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center text-zinc-600 text-sm">No logs found</td></tr>}
              {!isLoading && logs.map(log => <LogRow key={log.id} log={log} />)}
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
      <p className="text-zinc-700 text-xs">Click a row to expand the before/after diff.</p>
    </div>
  )
}
