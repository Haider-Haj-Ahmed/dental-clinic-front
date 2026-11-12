import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ChevronLeft, ChevronRight, Loader2, X,
  Lock, Unlock, AlertCircle, FileText, Trash2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import type { PaginatedResponse } from '@/types'

interface Encounter {
  id: number; encounter_date: string; appointment_id: number | null
  patient_id: number; provider_id: number
  subjective: string | null; objective: string | null
  assessment: string | null; plan: string | null
  is_locked: boolean; locked_at: string | null
  patient: { id: number; full_name: string }
  provider: { id: number; name: string }
  locked_by_user?: { id: number; name: string } | null
}
interface Provider { id: number; name: string; is_active: boolean }

const iCls = 'w-full h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'
const tCls = 'w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none resize-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>
}

function Drawer({ open, onClose, title, wide, children }: { open: boolean; onClose: () => void; title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0 pointer-events-none')} />
      <div className={cn('fixed top-0 right-0 h-full z-50 flex flex-col bg-[#0d0f1c] border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-in-out w-full', wide ? 'max-w-2xl' : 'max-w-lg', open ? 'translate-x-0' : 'translate-x-full')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0"><h2 className="text-white font-semibold">{title}</h2><button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button></div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  )
}

function PatientSearch({ value, onChange }: { value: { id: number; name: string } | null; onChange: (v: { id: number; name: string } | null) => void }) {
  const [q, setQ] = useState(value?.name ?? ''); const [open, setOpen] = useState(false); const dq = useDebounce(q, 300); const ref = useRef<HTMLDivElement>(null)
  const { data, isFetching } = useQuery({ queryKey: ['ps-enc', dq], queryFn: () => api.get<PaginatedResponse<{ id: number; full_name: string }>>('/patients', { params: { search: dq, is_active: '1', per_page: '8' } }).then(r => r.data.data), enabled: open && dq.length > 0 })
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  return (
    <div ref={ref} className="relative">
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" /><input className={cn(iCls,'pl-9 pr-8')} value={q} placeholder="Search patient…" onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }} onFocus={() => setOpen(true)} />{value && <button onClick={() => { onChange(null); setQ('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>}</div>
      {open && q.length > 0 && (<div className="absolute top-full mt-1 w-full bg-[#141626] border border-white/[0.08] rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">{isFetching && <div className="px-4 py-3 text-xs text-zinc-500">Searching…</div>}{!isFetching && !data?.length && <div className="px-4 py-3 text-xs text-zinc-600">No patients found</div>}{data?.map(p => <button key={p.id} onClick={() => { onChange({id:p.id,name:p.full_name}); setQ(p.full_name); setOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left"><div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">{p.full_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div><p className="text-sm text-white">{p.full_name}</p></button>)}</div>)}
    </div>
  )
}

function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function todayStr() { return new Date().toISOString().slice(0,10) }

const SOAP = [
  { key: 'subjective', label: 'S — Subjective', placeholder: "Patient's chief complaint and history…", color: 'text-sky-400' },
  { key: 'objective',  label: 'O — Objective',  placeholder: 'Clinical findings and examination notes…', color: 'text-emerald-400' },
  { key: 'assessment', label: 'A — Assessment', placeholder: 'Diagnosis and clinical assessment…', color: 'text-amber-400' },
  { key: 'plan',       label: 'P — Plan',        placeholder: 'Treatment plan and follow-up…', color: 'text-violet-400' },
] as const

function EncounterForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(null)
  const [form, setForm] = useState({ provider_id: '', encounter_date: todayStr(), subjective: '', objective: '', assessment: '', plan: '' })
  const [err, setErr] = useState('')
  const qc = useQueryClient()
  const { data: providers } = useQuery({ queryKey: ['providers-list'], queryFn: () => api.get<{ data: Provider[] }>('/providers', { params: { is_active: '1', per_page: '100' } }).then(r => r.data.data) })
  const mutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/encounters', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['encounters'] }); onSuccess() },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create encounter.'),
  })
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!patient) { setErr('Patient is required.'); return }
    if (!form.provider_id) { setErr('Provider is required.'); return }
    const p: Record<string, unknown> = { patient_id: patient.id, provider_id: Number(form.provider_id), encounter_date: form.encounter_date }
    if (form.subjective) p.subjective = form.subjective
    if (form.objective)  p.objective  = form.objective
    if (form.assessment) p.assessment = form.assessment
    if (form.plan)       p.plan       = form.plan
    mutation.mutate(p)
  }
  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Info</p>
        <Field label="Patient" required><PatientSearch value={patient} onChange={setPatient} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider" required>
            <select className={cn(iCls,'bg-[#0f1120]',!form.provider_id&&'text-zinc-600')} value={form.provider_id} onChange={e => setForm(f=>({...f,provider_id:e.target.value}))}>
              <option value="">Select provider…</option>
              {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Date" required>
            <input type="date" className={iCls} value={form.encounter_date} max={todayStr()} onChange={e => setForm(f=>({...f,encounter_date:e.target.value}))} />
          </Field>
        </div>
      </section>
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">SOAP Notes</p>
        {SOAP.map(s => (
          <div key={s.key}>
            <label className={cn('text-xs font-semibold mb-1.5 block', s.color)}>{s.label}</label>
            <textarea className={tCls} rows={3} value={form[s.key]} onChange={e => setForm(f=>({...f,[s.key]:e.target.value}))} placeholder={s.placeholder} />
          </div>
        ))}
      </section>
      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{mutation.isPending ? 'Saving…' : 'Create Encounter'}
        </button>
      </div>
    </form>
  )
}

function EncounterDetail({ enc, onClose }: { enc: Encounter; onClose: () => void }) {
  const qc = useQueryClient()
  const lockMutation   = useMutation({ mutationFn: () => api.post(`/encounters/${enc.id}/lock`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['encounters'] }); onClose() } })
  const unlockMutation = useMutation({ mutationFn: () => api.post(`/encounters/${enc.id}/unlock`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['encounters'] }); onClose() } })
  const delMutation    = useMutation({ mutationFn: () => api.delete(`/encounters/${enc.id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['encounters'] }); onClose() } })
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-semibold">{enc.patient.full_name}</p>
          <p className="text-zinc-500 text-xs mt-0.5">{enc.provider.name} · {fmtDate(enc.encounter_date)}</p>
        </div>
        <span className={cn('text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0',
          enc.is_locked ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        )}>{enc.is_locked ? 'Locked' : 'Open'}</span>
      </div>
      {enc.is_locked && enc.locked_by_user && (
        <p className="text-xs text-zinc-600">Locked by {enc.locked_by_user.name} on {fmtDate(enc.locked_at)}</p>
      )}
      <div className="space-y-4">
        {SOAP.map(s => enc[s.key as keyof Encounter] && (
          <div key={s.key}>
            <p className={cn('text-xs font-semibold mb-1.5', s.color)}>{s.label}</p>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{enc[s.key as keyof Encounter] as string}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
        {!enc.is_locked && (
          <button onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 transition-colors disabled:opacity-50">
            {lockMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" strokeWidth={1.8} />} Lock
          </button>
        )}
        {enc.is_locked && (
          <button onClick={() => unlockMutation.mutate()} disabled={unlockMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-sky-400 border border-sky-500/20 hover:bg-sky-500/10 transition-colors disabled:opacity-50">
            {unlockMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" strokeWidth={1.8} />} Unlock
          </button>
        )}
        {!enc.is_locked && (
          <button onClick={() => { if (confirm('Delete this encounter?')) delMutation.mutate() }} disabled={delMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50">
            {delMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />} Delete
          </button>
        )}
      </div>
    </div>
  )
}

export default function EncountersPage() {
  const [page, setPage] = useState(1); const [locked, setLocked] = useState(''); const [createOpen, setC] = useState(false); const [detail, setDetail] = useState<Encounter | null>(null)
  const params: Record<string,string> = { page: String(page) }; if (locked) params.is_locked = locked
  const { data, isLoading } = useQuery({ queryKey: ['encounters', params], queryFn: () => api.get<PaginatedResponse<Encounter>>('/encounters', { params }).then(r => r.data), placeholderData: prev => prev })
  const encounters = data?.data ?? []; const meta = data?.meta
  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><h2 className="text-white font-semibold">Encounters</h2><span className="text-zinc-600 text-xs bg-white/[0.05] border border-white/[0.07] rounded-full px-2.5 py-0.5">{(meta?.total??0).toLocaleString()}</span></div>
        <button onClick={() => setC(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"><Plus className="w-4 h-4" strokeWidth={2} /> New Encounter</button>
      </div>
      <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5 w-fit">
        {[['','All'],['0','Open'],['1','Locked']].map(([v,l]) => <button key={v} onClick={() => { setLocked(v); setPage(1) }} className={cn('h-7 px-3 rounded-md text-xs font-medium transition-colors', locked===v?'bg-indigo-600 text-white':'text-zinc-400 hover:text-zinc-200')}>{l}</button>)}
      </div>
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]">{['Date','Patient','Provider','SOAP Preview','Status',''].map(h => <th key={h} className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {isLoading && Array(6).fill(0).map((_,i) => <tr key={i} className="border-b border-white/[0.04]">{Array(6).fill(0).map((_,j) => <td key={j} className="px-4 py-3.5"><div className="h-3 bg-white/[0.05] rounded animate-pulse w-24" /></td>)}</tr>)}
              {!isLoading && encounters.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center text-zinc-600 text-sm">No encounters found</td></tr>}
              {!isLoading && encounters.map(enc => (
                <tr key={enc.id} onClick={() => setDetail(enc)} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group">
                  <td className="px-4 py-3 text-zinc-300 text-xs whitespace-nowrap">{fmtDate(enc.encounter_date)}</td>
                  <td className="px-4 py-3 text-white text-xs font-medium">{enc.patient.full_name}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{enc.provider.name}</td>
                  <td className="px-4 py-3 text-zinc-600 text-xs max-w-xs truncate">{enc.subjective || enc.assessment || enc.plan || <span className="text-zinc-700">No notes</span>}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                      enc.is_locked ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                    )}>{enc.is_locked ? <><Lock className="w-2.5 h-2.5" />Locked</> : <><Unlock className="w-2.5 h-2.5" />Open</>}</span>
                  </td>
                  <td className="px-4 py-3"><span className="text-zinc-600 group-hover:text-indigo-400 transition-colors text-xs opacity-0 group-hover:opacity-100">View →</span></td>
                </tr>
              ))}
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
      <Drawer open={createOpen} onClose={() => setC(false)} title="New Encounter" wide><EncounterForm onSuccess={() => setC(false)} onClose={() => setC(false)} /></Drawer>
      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail ? `Encounter — ${fmtDate(detail.encounter_date)}` : ''} wide>{detail && <EncounterDetail enc={detail} onClose={() => setDetail(null)} />}</Drawer>
    </div>
  )
}
