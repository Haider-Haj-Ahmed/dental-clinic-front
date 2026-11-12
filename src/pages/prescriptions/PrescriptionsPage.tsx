import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ChevronLeft, ChevronRight, Loader2, X,
  AlertCircle, Download, Pill, CheckCircle2, Minus,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import type { PaginatedResponse } from '@/types'

interface RxItem { id: number; drug_name: string; dose: string | null; frequency: string | null; duration: string | null; quantity: string | null; instructions: string | null }
interface Prescription {
  id: number; issued_at: string; notes: string | null
  is_printed: boolean; printed_at: string | null
  patient: { id: number; full_name: string }
  provider: { id: number; name: string }
  items: RxItem[]; created_at: string
}
interface Provider { id: number; name: string; is_active: boolean }

const iCls = 'w-full h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>
}
function Drawer({ open, onClose, title, wide, children }: { open: boolean; onClose: () => void; title: string; wide?: boolean; children: React.ReactNode }) {
  return (<><div onClick={onClose} className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0 pointer-events-none')} /><div className={cn('fixed top-0 right-0 h-full z-50 flex flex-col bg-[#0d0f1c] border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-in-out w-full', wide ? 'max-w-2xl' : 'max-w-lg', open ? 'translate-x-0' : 'translate-x-full')}><div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0"><h2 className="text-white font-semibold">{title}</h2><button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button></div><div className="flex-1 overflow-y-auto">{children}</div></div></>)
}
function PatientSearch({ value, onChange }: { value: { id: number; name: string } | null; onChange: (v: { id: number; name: string } | null) => void }) {
  const [q, setQ] = useState(value?.name ?? ''); const [open, setOpen] = useState(false); const dq = useDebounce(q, 300); const ref = useRef<HTMLDivElement>(null)
  const { data, isFetching } = useQuery({ queryKey: ['ps-rx', dq], queryFn: () => api.get<PaginatedResponse<{ id: number; full_name: string }>>('/patients', { params: { search: dq, is_active: '1', per_page: '8' } }).then(r => r.data.data), enabled: open && dq.length > 0 })
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  return (<div ref={ref} className="relative"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" /><input className={cn(iCls,'pl-9 pr-8')} value={q} placeholder="Search patient…" onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }} onFocus={() => setOpen(true)} />{value && <button onClick={() => { onChange(null); setQ('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>}</div>{open && q.length > 0 && (<div className="absolute top-full mt-1 w-full bg-[#141626] border border-white/[0.08] rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">{isFetching && <div className="px-4 py-3 text-xs text-zinc-500">Searching…</div>}{!isFetching && !data?.length && <div className="px-4 py-3 text-xs text-zinc-600">No patients found</div>}{data?.map(p => <button key={p.id} onClick={() => { onChange({id:p.id,name:p.full_name}); setQ(p.full_name); setOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left"><div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">{p.full_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div><p className="text-sm text-white">{p.full_name}</p></button>)}</div>)}</div>)
}

function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function todayStr() { return new Date().toISOString().slice(0,10) }
function getToken() { try { return JSON.parse(localStorage.getItem('dental-auth')||'{}')?.state?.token??'' } catch { return '' } }
function rxNo(id: number) { return `RX-${String(id).padStart(5,'0')}` }

interface DrugLine { drug_name: string; dose: string; frequency: string; duration: string; quantity: string; instructions: string }
const EMPTY_DRUG: DrugLine = { drug_name: '', dose: '', frequency: '', duration: '', quantity: '', instructions: '' }

function RxForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(null)
  const [form, setForm] = useState({ provider_id: '', issued_at: todayStr(), notes: '' })
  const [drugs, setDrugs] = useState<DrugLine[]>([{ ...EMPTY_DRUG }])
  const [err, setErr] = useState('')
  const qc = useQueryClient()
  const { data: providers } = useQuery({ queryKey: ['providers-list'], queryFn: () => api.get<{ data: Provider[] }>('/providers', { params: { is_active: '1', per_page: '100' } }).then(r => r.data.data) })
  const mutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/prescriptions', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prescriptions'] }); onSuccess() },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create prescription.'),
  })
  function updateDrug(i: number, k: keyof DrugLine, v: string) { const next = [...drugs]; next[i] = { ...next[i], [k]: v }; setDrugs(next) }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!patient) { setErr('Patient is required.'); return }
    if (!drugs.length || drugs.some(d => !d.drug_name)) { setErr('All items must have a drug name.'); return }
    const payload: Record<string, unknown> = {
      patient_id: patient.id, issued_at: form.issued_at,
      items: drugs.map(d => { const o: Record<string,string> = { drug_name: d.drug_name }; if (d.dose) o.dose=d.dose; if (d.frequency) o.frequency=d.frequency; if (d.duration) o.duration=d.duration; if (d.quantity) o.quantity=d.quantity; if (d.instructions) o.instructions=d.instructions; return o }),
    }
    if (form.provider_id) payload.provider_id = Number(form.provider_id)
    if (form.notes) payload.notes = form.notes
    mutation.mutate(payload)
  }
  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Prescription Info</p>
        <Field label="Patient" required><PatientSearch value={patient} onChange={setPatient} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider">
            <select className={cn(iCls,'bg-[#0f1120]',!form.provider_id&&'text-zinc-600')} value={form.provider_id} onChange={e => setForm(f=>({...f,provider_id:e.target.value}))}>
              <option value="">Select provider…</option>
              {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Issued Date" required><input type="date" className={iCls} value={form.issued_at} onChange={e => setForm(f=>({...f,issued_at:e.target.value}))} /></Field>
        </div>
        <Field label="Notes"><input className={iCls} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes…" /></Field>
      </section>
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Medications</p>
        {drugs.map((drug, i) => (
          <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Drug {i+1}</p>
              {drugs.length > 1 && <button type="button" onClick={() => setDrugs(ds=>ds.filter((_,j)=>j!==i))} className="w-6 h-6 rounded flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Minus className="w-3.5 h-3.5" strokeWidth={2} /></button>}
            </div>
            <Field label="Drug Name" required><input className={iCls} value={drug.drug_name} onChange={e => updateDrug(i,'drug_name',e.target.value)} placeholder="e.g. Amoxicillin 500mg" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dose"><input className={iCls} value={drug.dose} onChange={e => updateDrug(i,'dose',e.target.value)} placeholder="e.g. 1 tablet" /></Field>
              <Field label="Frequency"><input className={iCls} value={drug.frequency} onChange={e => updateDrug(i,'frequency',e.target.value)} placeholder="e.g. 3 times daily" /></Field>
              <Field label="Duration"><input className={iCls} value={drug.duration} onChange={e => updateDrug(i,'duration',e.target.value)} placeholder="e.g. 7 days" /></Field>
              <Field label="Quantity"><input className={iCls} value={drug.quantity} onChange={e => updateDrug(i,'quantity',e.target.value)} placeholder="e.g. 21 tablets" /></Field>
            </div>
            <Field label="Instructions"><input className={iCls} value={drug.instructions} onChange={e => updateDrug(i,'instructions',e.target.value)} placeholder="Take after meals…" /></Field>
          </div>
        ))}
        <button type="button" onClick={() => setDrugs(ds=>[...ds,{...EMPTY_DRUG}])} className="flex items-center gap-1.5 h-8 w-full px-3 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-dashed border-indigo-500/30 transition-colors justify-center"><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Add Medication</button>
      </section>
      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{mutation.isPending ? 'Issuing…' : 'Issue Prescription'}
        </button>
      </div>
    </form>
  )
}

function RxDetail({ rx }: { rx: Prescription }) {
  const [dlLoading, setDlLoading] = useState(false)
  async function dlPdf() { setDlLoading(true); const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'; const res = await fetch(`${base}/prescriptions/${rx.id}/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } }); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rx-${rx.id}.pdf`; a.click(); setDlLoading(false) }
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-white font-semibold">{rx.patient.full_name}</p><p className="text-zinc-500 text-xs mt-0.5">{rx.provider.name} · {fmtDate(rx.issued_at)}</p></div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-white font-mono text-xs font-semibold">{rxNo(rx.id)}</span>
          {rx.is_printed ? <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="w-3 h-3" />Printed</span> : <span className="text-[10px] text-zinc-600">Not printed</span>}
        </div>
      </div>
      {rx.notes && <p className="text-sm text-zinc-500 bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">{rx.notes}</p>}
      <div>
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Medications</p>
        <div className="space-y-3">
          {rx.items.map((item, i) => (
            <div key={item.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><div className="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0"><Pill className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} /></div><p className="text-sm text-white font-semibold">{item.drug_name}</p></div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 ml-8">
                {[['Dose',item.dose],['Frequency',item.frequency],['Duration',item.duration],['Quantity',item.quantity]].filter(([,v])=>v).map(([l,v]) => <div key={l}><span className="text-[10px] text-zinc-600 uppercase tracking-wide">{l}: </span><span className="text-xs text-zinc-300">{v}</span></div>)}
                {item.instructions && <div className="col-span-2 mt-1"><span className="text-[10px] text-zinc-600 uppercase tracking-wide">Instructions: </span><span className="text-xs text-zinc-400">{item.instructions}</span></div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
        <button onClick={dlPdf} disabled={dlLoading} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-zinc-400 border border-white/[0.08] hover:bg-white/[0.06] transition-colors disabled:opacity-50">
          {dlLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" strokeWidth={1.8} />} Print / PDF
        </button>
      </div>
    </div>
  )
}

export default function PrescriptionsPage() {
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState(''); const [page, setPage] = useState(1); const [createOpen, setC] = useState(false); const [detail, setDetail] = useState<Prescription | null>(null)
  const params: Record<string,string> = { page: String(page) }; if (dateFrom) params.date_from = dateFrom; if (dateTo) params.date_to = dateTo
  const { data, isLoading } = useQuery({ queryKey: ['prescriptions', params], queryFn: () => api.get<PaginatedResponse<Prescription>>('/prescriptions', { params }).then(r => r.data), placeholderData: prev => prev })
  const prescriptions = data?.data ?? []; const meta = data?.meta
  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><h2 className="text-white font-semibold">Prescriptions</h2><span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">{(meta?.total??0).toLocaleString()}</span></div><button onClick={() => setC(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"><Plus className="w-4 h-4" strokeWidth={2} /> New Prescription</button></div>
      <div className="flex items-center gap-2">
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} className="h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/40 transition-all" />
        <span className="text-zinc-600 text-xs">to</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} className="h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/40 transition-all" />
        {(dateFrom||dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-4 h-4" /></button>}
      </div>
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06]">{['Rx #','Patient','Provider','Issued','Drugs','Printed',''].map(h => <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {isLoading && Array(5).fill(0).map((_,i) => <tr key={i} className="border-b border-white/[0.04]">{Array(7).fill(0).map((_,j) => <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/[0.05] rounded animate-pulse w-20" /></td>)}</tr>)}
              {!isLoading && prescriptions.length === 0 && <tr><td colSpan={7} className="px-4 py-16 text-center text-zinc-600 text-sm">No prescriptions found</td></tr>}
              {!isLoading && prescriptions.map(rx => (
                <tr key={rx.id} onClick={() => setDetail(rx)} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group">
                  <td className="px-4 py-3 text-white font-mono text-xs font-semibold">{rxNo(rx.id)}</td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{rx.patient.full_name}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{rx.provider.name}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(rx.issued_at)}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{rx.items.length}</td>
                  <td className="px-4 py-3">{rx.is_printed ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Yes</span> : <span className="text-zinc-700 text-xs">No</span>}</td>
                  <td className="px-4 py-3"><span className="text-zinc-600 group-hover:text-indigo-400 transition-colors text-xs opacity-0 group-hover:opacity-100">View →</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 && (<div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]"><p className="text-zinc-600 text-xs">{((meta.current_page-1)*meta.per_page)+1}–{Math.min(meta.current_page*meta.per_page,meta.total)} of {meta.total}</p><div className="flex items-center gap-1"><button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={meta.current_page===1} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button><span className="text-zinc-500 text-xs px-2">{meta.current_page} / {meta.last_page}</span><button onClick={() => setPage(p=>Math.min(meta.last_page,p+1))} disabled={meta.current_page===meta.last_page} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button></div></div>)}
      </div>
      <Drawer open={createOpen} onClose={() => setC(false)} title="New Prescription" wide><RxForm onSuccess={() => setC(false)} onClose={() => setC(false)} /></Drawer>
      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail ? rxNo(detail.id) : ''}>{detail && <RxDetail rx={detail} />}</Drawer>
    </div>
  )
}
