import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ChevronLeft, ChevronRight, Loader2, X,
  AlertCircle, FileText, Minus, Download,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import type { PaginatedResponse } from '@/types'

type TPStatus = 'draft' | 'presented' | 'accepted' | 'rejected'

interface TPItem { id: number; description: string; tooth_number: number | null; surface: string | null; fee: number; sort_order: number }
interface TreatmentPlan {
  id: number; title: string; status: TPStatus; total_fee: number; notes: string | null
  presented_at: string | null; accepted_at: string | null; rejected_at: string | null
  patient: { id: number; full_name: string }; provider: { id: number; name: string }
  creator: { id: number; name: string }; items: TPItem[]
  created_at: string
}
interface Provider { id: number; name: string; is_active: boolean }

const STATUS_CFG: Record<TPStatus, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'text-zinc-400 bg-zinc-700/30 border-zinc-700/60' },
  presented: { label: 'Presented', cls: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  accepted:  { label: 'Accepted',  cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rejected:  { label: 'Rejected',  cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
}
function StatusBadge({ status }: { status: TPStatus }) {
  const { label, cls } = STATUS_CFG[status]
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', cls)}>{label}</span>
}

const iCls = 'w-full h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>
}
function Drawer({ open, onClose, title, wide, children }: { open: boolean; onClose: () => void; title: string; wide?: boolean; children: React.ReactNode }) {
  return (<><div onClick={onClose} className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0 pointer-events-none')} /><div className={cn('fixed top-0 right-0 h-full z-50 flex flex-col bg-[#0d0f1c] border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-in-out w-full', wide ? 'max-w-2xl' : 'max-w-lg', open ? 'translate-x-0' : 'translate-x-full')}><div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0"><h2 className="text-white font-semibold">{title}</h2><button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button></div><div className="flex-1 overflow-y-auto">{children}</div></div></>)
}
function PatientSearch({ value, onChange }: { value: { id: number; name: string } | null; onChange: (v: { id: number; name: string } | null) => void }) {
  const [q, setQ] = useState(value?.name ?? ''); const [open, setOpen] = useState(false); const dq = useDebounce(q, 300); const ref = useRef<HTMLDivElement>(null)
  const { data, isFetching } = useQuery({ queryKey: ['ps-tp', dq], queryFn: () => api.get<PaginatedResponse<{ id: number; full_name: string }>>('/patients', { params: { search: dq, is_active: '1', per_page: '8' } }).then(r => r.data.data), enabled: open && dq.length > 0 })
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  return (<div ref={ref} className="relative"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" /><input className={cn(iCls,'pl-9 pr-8')} value={q} placeholder="Search patient…" onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }} onFocus={() => setOpen(true)} />{value && <button onClick={() => { onChange(null); setQ('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>}</div>{open && q.length > 0 && (<div className="absolute top-full mt-1 w-full bg-[#141626] border border-white/[0.08] rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">{isFetching && <div className="px-4 py-3 text-xs text-zinc-500">Searching…</div>}{!isFetching && !data?.length && <div className="px-4 py-3 text-xs text-zinc-600">No patients found</div>}{data?.map(p => <button key={p.id} onClick={() => { onChange({id:p.id,name:p.full_name}); setQ(p.full_name); setOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left"><div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">{p.full_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div><p className="text-sm text-white">{p.full_name}</p></button>)}</div>)}</div>)
}

function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function fmtCurrency(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) }
function getToken() { try { return JSON.parse(localStorage.getItem('dental-auth')||'{}')?.state?.token??'' } catch { return '' } }

interface LineItem { description: string; tooth_number: string; surface: string; fee: string }
const EMPTY_LINE: LineItem = { description: '', tooth_number: '', surface: '', fee: '' }

function TPForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(null)
  const [form, setForm] = useState({ provider_id: '', title: '', notes: '' })
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }])
  const [err, setErr] = useState('')
  const qc = useQueryClient()
  const { data: providers } = useQuery({ queryKey: ['providers-list'], queryFn: () => api.get<{ data: Provider[] }>('/providers', { params: { is_active: '1', per_page: '100' } }).then(r => r.data.data) })
  const mutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/treatment-plans', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['treatment-plans'] }); onSuccess() },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create plan.'),
  })
  function updateLine(i: number, k: keyof LineItem, v: string) { const next = [...lines]; next[i] = { ...next[i], [k]: v }; setLines(next) }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!patient) { setErr('Patient is required.'); return }
    if (!form.provider_id) { setErr('Provider is required.'); return }
    if (!form.title.trim()) { setErr('Title is required.'); return }
    if (!lines.length || lines.some(l => !l.description || !l.fee)) { setErr('All items must have a description and fee.'); return }
    const payload: Record<string, unknown> = {
      patient_id: patient.id, provider_id: Number(form.provider_id), title: form.title,
      items: lines.map(l => ({ description: l.description, fee: parseFloat(l.fee), ...(l.tooth_number && { tooth_number: parseInt(l.tooth_number) }), ...(l.surface && { surface: l.surface }) })),
    }
    if (form.notes) payload.notes = form.notes
    mutation.mutate(payload)
  }
  const total = lines.reduce((s,l) => s + parseFloat(l.fee||'0'), 0)
  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Plan Info</p>
        <Field label="Patient" required><PatientSearch value={patient} onChange={setPatient} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider" required>
            <select className={cn(iCls,'bg-[#0f1120]',!form.provider_id&&'text-zinc-600')} value={form.provider_id} onChange={e => setForm(f=>({...f,provider_id:e.target.value}))}>
              <option value="">Select provider…</option>
              {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Title" required>
            <input className={iCls} value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Full Mouth Restoration" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none resize-none focus:border-indigo-500/50 transition-all" rows={2} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes…" />
        </Field>
      </section>
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Treatment Items</p>
        <div className="grid grid-cols-12 gap-2 px-1">{['Description','Tooth','Surface','Fee',''].map((h,i) => <p key={i} className={cn('text-[10px] font-semibold text-zinc-600 uppercase tracking-wider', i===0?'col-span-5':i===1?'col-span-2':i===2?'col-span-2':i===3?'col-span-2':'col-span-1')}>{h}</p>)}</div>
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-5"><input className={cn(iCls,'h-8 text-xs')} value={line.description} onChange={e => updateLine(i,'description',e.target.value)} placeholder="Procedure description" /></div>
            <div className="col-span-2"><input className={cn(iCls,'h-8 text-xs')} value={line.tooth_number} onChange={e => updateLine(i,'tooth_number',e.target.value)} placeholder="e.g. 21" /></div>
            <div className="col-span-2"><input className={cn(iCls,'h-8 text-xs')} value={line.surface} onChange={e => updateLine(i,'surface',e.target.value)} placeholder="MO, DO…" /></div>
            <div className="col-span-2"><input type="number" min="0" step="0.01" className={cn(iCls,'h-8 text-xs')} value={line.fee} onChange={e => updateLine(i,'fee',e.target.value)} placeholder="0.00" /></div>
            <div className="col-span-1 h-8 flex items-center justify-center"><button type="button" onClick={() => setLines(ls=>ls.filter((_,j)=>j!==i))} className="w-6 h-6 rounded flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Minus className="w-3.5 h-3.5" strokeWidth={2} /></button></div>
          </div>
        ))}
        <button type="button" onClick={() => setLines(ls=>[...ls,{...EMPTY_LINE}])} className="flex items-center gap-1.5 h-8 w-full px-3 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-dashed border-indigo-500/30 transition-colors justify-center"><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Add Item</button>
        {total > 0 && <div className="flex justify-end"><p className="text-xs text-zinc-500">Total: <span className="text-white font-semibold font-mono ml-1">{fmtCurrency(total)}</span></p></div>}
      </section>
      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{mutation.isPending ? 'Creating…' : 'Create Plan'}
        </button>
      </div>
    </form>
  )
}

function TPDetail({ plan, onClose }: { plan: TreatmentPlan; onClose: () => void }) {
  const qc = useQueryClient()
  const [dlLoading, setDlLoading] = useState(false)
  const { data: full, isLoading } = useQuery({ queryKey: ['treatment-plan', plan.id], queryFn: () => api.get<{ data: TreatmentPlan }>(`/treatment-plans/${plan.id}`).then(r => r.data.data) })
  const presentMutation = useMutation({ mutationFn: () => api.post(`/treatment-plans/${plan.id}/present`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['treatment-plans'] }); qc.invalidateQueries({ queryKey: ['treatment-plan', plan.id] }) } })
  const acceptMutation  = useMutation({ mutationFn: () => api.post(`/treatment-plans/${plan.id}/accept`),  onSuccess: () => { qc.invalidateQueries({ queryKey: ['treatment-plans'] }); qc.invalidateQueries({ queryKey: ['treatment-plan', plan.id] }) } })
  const rejectMutation  = useMutation({ mutationFn: () => api.post(`/treatment-plans/${plan.id}/reject`),  onSuccess: () => { qc.invalidateQueries({ queryKey: ['treatment-plans'] }); qc.invalidateQueries({ queryKey: ['treatment-plan', plan.id] }) } })
  const p = full ?? plan
  async function dlPdf() { setDlLoading(true); const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'; const res = await fetch(`${base}/treatment-plans/${plan.id}/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } }); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tp-${plan.id}.pdf`; a.click(); setDlLoading(false) }
  if (isLoading) return <div className="p-6 space-y-4 animate-pulse">{Array(4).fill(0).map((_,i) => <div key={i} className="h-10 bg-white/[0.05] rounded-lg" />)}</div>
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-white font-semibold">{p.title}</p><p className="text-zinc-500 text-xs mt-0.5">{p.patient.full_name} · {p.provider.name}</p></div>
        <div className="text-right"><StatusBadge status={p.status} /><p className="text-white font-bold font-mono text-lg mt-1">{fmtCurrency(p.total_fee)}</p></div>
      </div>
      {p.notes && <p className="text-sm text-zinc-500 bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">{p.notes}</p>}
      <div>
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Treatment Items</p>
        <div className="space-y-2">
          {p.items?.map(it => (
            <div key={it.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
              <div><p className="text-sm text-white">{it.description}</p>{(it.tooth_number || it.surface) && <p className="text-xs text-zinc-600">{it.tooth_number && `Tooth ${it.tooth_number}`}{it.tooth_number && it.surface && ' · '}{it.surface}</p>}</div>
              <span className="text-sm text-white font-mono font-semibold">{fmtCurrency(it.fee)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
        {p.status === 'draft' && <button onClick={() => presentMutation.mutate()} disabled={presentMutation.isPending} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/10 transition-colors disabled:opacity-50">{presentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" strokeWidth={1.8} />} Present to Patient</button>}
        {p.status === 'presented' && <>
          <button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors disabled:opacity-50">{acceptMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '✓'} Accept</button>
          <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50">{rejectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '✕'} Reject</button>
        </>}
        {p.status !== 'draft' && <button onClick={dlPdf} disabled={dlLoading} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-zinc-400 border border-white/[0.08] hover:bg-white/[0.06] transition-colors disabled:opacity-50">{dlLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" strokeWidth={1.8} />} PDF</button>}
      </div>
    </div>
  )
}

const TP_FILTERS = [['','All'],['draft','Draft'],['presented','Presented'],['accepted','Accepted'],['rejected','Rejected']]

export default function TreatmentPlansPage() {
  const [status, setStatus] = useState(''); const [page, setPage] = useState(1); const [createOpen, setC] = useState(false); const [detail, setDetail] = useState<TreatmentPlan | null>(null)
  const params: Record<string,string> = { page: String(page) }; if (status) params.status = status
  const { data, isLoading } = useQuery({ queryKey: ['treatment-plans', params], queryFn: () => api.get<PaginatedResponse<TreatmentPlan>>('/treatment-plans', { params }).then(r => r.data), placeholderData: prev => prev })
  const plans = data?.data ?? []; const meta = data?.meta
  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><h2 className="text-white font-semibold">Treatment Plans</h2><span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">{(meta?.total??0).toLocaleString()}</span></div><button onClick={() => setC(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"><Plus className="w-4 h-4" strokeWidth={2} /> New Plan</button></div>
      <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5 w-fit">{TP_FILTERS.map(([v,l]) => <button key={v} onClick={() => { setStatus(v); setPage(1) }} className={cn('h-7 px-3 rounded-md text-xs font-medium transition-colors', status===v?'bg-indigo-600 text-white':'text-zinc-400 hover:text-zinc-200')}>{l}</button>)}</div>
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06]">{['Title','Patient','Provider','Items','Total','Status',''].map(h => <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {isLoading && Array(5).fill(0).map((_,i) => <tr key={i} className="border-b border-white/[0.04]">{Array(7).fill(0).map((_,j) => <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/[0.05] rounded animate-pulse w-20" /></td>)}</tr>)}
              {!isLoading && plans.length === 0 && <tr><td colSpan={7} className="px-4 py-16 text-center text-zinc-600 text-sm">No treatment plans found</td></tr>}
              {!isLoading && plans.map(p => (
                <tr key={p.id} onClick={() => setDetail(p)} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group">
                  <td className="px-4 py-3 text-white text-xs font-medium max-w-xs truncate">{p.title}</td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{p.patient.full_name}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{p.provider.name}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{p.items?.length ?? '—'}</td>
                  <td className="px-4 py-3 text-white text-xs font-semibold font-mono">{fmtCurrency(p.total_fee)}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3"><span className="text-zinc-600 group-hover:text-indigo-400 transition-colors text-xs opacity-0 group-hover:opacity-100">View →</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 && (<div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]"><p className="text-zinc-600 text-xs">{((meta.current_page-1)*meta.per_page)+1}–{Math.min(meta.current_page*meta.per_page,meta.total)} of {meta.total}</p><div className="flex items-center gap-1"><button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={meta.current_page===1} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button><span className="text-zinc-500 text-xs px-2">{meta.current_page} / {meta.last_page}</span><button onClick={() => setPage(p=>Math.min(meta.last_page,p+1))} disabled={meta.current_page===meta.last_page} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button></div></div>)}
      </div>
      <Drawer open={createOpen} onClose={() => setC(false)} title="New Treatment Plan" wide><TPForm onSuccess={() => setC(false)} onClose={() => setC(false)} /></Drawer>
      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail ? detail.title : ''} wide>{detail && <TPDetail plan={detail} onClose={() => setDetail(null)} />}</Drawer>
    </div>
  )
}

function getToken() { try { return JSON.parse(localStorage.getItem('dental-auth')||'{}')?.state?.token??'' } catch { return '' } }
