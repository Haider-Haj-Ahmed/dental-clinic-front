import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Edit2, UserX, AlertCircle, Loader2,
  Plus, X, Shield, Activity, Pill, Users, FileText,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: number
  first_name: string; last_name: string; full_name: string
  gender: string | null; date_of_birth: string | null
  phone: string | null; email: string | null; address: string | null
  emergency_contact_name: string | null; emergency_contact_phone: string | null
  blood_type: string | null; medical_alerts: string | null; notes: string | null
  is_active: boolean; created_at: string
}
interface Allergy   { id: number; allergen: string; reaction: string | null; severity: 'mild'|'moderate'|'severe'|null; notes: string | null }
interface Condition { id: number; condition: string; icd_code: string | null; status: 'active'|'resolved'; onset_date: string | null; notes: string | null }
interface Medication{ id: number; drug_name: string; dose: string | null; frequency: string | null; start_date: string | null; end_date: string | null; notes: string | null }
interface Contact   { id: number; label: string; name: string; phone: string | null; relationship: string | null; is_emergency: boolean }
interface Consent   { id: number; consent_type: string; signed_at: string | null; signed_by_patient: boolean }

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
function getAge(dob: string | null) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}
function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const iCls = 'w-full h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'
const tCls = 'w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none resize-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold mb-0.5">{label}</p>
      <div className="text-sm text-zinc-200">{value ?? <span className="text-zinc-700">—</span>}</div>
    </div>
  )
}

function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0 pointer-events-none')} />
      <div className={cn('fixed top-0 right-0 h-full w-full max-w-lg z-50 flex flex-col bg-[#0d0f1c] border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-in-out', open ? 'translate-x-0' : 'translate-x-full')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  )
}

function AddForm({ onCancel, onSubmit, loading, children }: { onCancel: () => void; onSubmit: (e: React.FormEvent) => void; loading: boolean; children: React.ReactNode }) {
  return (
    <form onSubmit={onSubmit} className="mt-3 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-3">
      {children}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="h-8 px-3 rounded-lg text-xs text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={loading} className="h-8 px-4 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-1.5 disabled:opacity-50">
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}{loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

function SeverityBadge({ s }: { s: string | null }) {
  if (!s) return null
  return <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border',
    s === 'severe'   && 'text-red-400 bg-red-500/10 border-red-500/20',
    s === 'moderate' && 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    s === 'mild'     && 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  )}>{s}</span>
}

function ConditionBadge({ s }: { s: string }) {
  return <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border',
    s === 'active'   && 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    s === 'resolved' && 'text-zinc-500 bg-zinc-700/30 border-zinc-700/50',
  )}>{s}</span>
}

function SectionHeader({ icon: Icon, label, count, onAdd, adding }: { icon: React.ElementType; label: string; count?: number; onAdd: () => void; adding: boolean }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-zinc-500" strokeWidth={1.8} />
        <span className="text-sm font-medium text-white">{label}</span>
        {count !== undefined && <span className="text-xs text-zinc-600 bg-white/[0.04] border border-white/[0.07] rounded-full px-2 py-0.5">{count}</span>}
      </div>
      <button onClick={onAdd} className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors">
        {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        {adding ? 'Cancel' : 'Add'}
      </button>
    </div>
  )
}

function SkeletonRows() {
  return <div className="space-y-2 mt-2">{Array(2).fill(0).map((_,i) => <div key={i} className="h-10 bg-white/[0.03] rounded-lg animate-pulse" />)}</div>
}

// ── Allergies ─────────────────────────────────────────────────────────────────

function AllergiesSection({ pid }: { pid: number }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ allergen: '', reaction: '', severity: '', notes: '' })
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['allergies', pid], queryFn: () => api.get<{ data: Allergy[] }>(`/patients/${pid}/allergies`).then(r => r.data.data) })
  const add = useMutation({
    mutationFn: (d: Record<string,string>) => api.post(`/patients/${pid}/allergies`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allergies', pid] }); setAdding(false); setForm({ allergen: '', reaction: '', severity: '', notes: '' }) },
  })
  const s = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div>
      <SectionHeader icon={Shield} label="Allergies" count={data?.length} onAdd={() => setAdding(v => !v)} adding={adding} />
      {adding && (
        <AddForm onCancel={() => setAdding(false)} onSubmit={e => { e.preventDefault(); const p: Record<string,string>={}; Object.entries(form).forEach(([k,v])=>{if(v)p[k]=v}); add.mutate(p) }} loading={add.isPending}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Allergen" required><input className={iCls} value={form.allergen} onChange={e => s('allergen')(e.target.value)} placeholder="e.g. Penicillin" /></Field>
            <Field label="Reaction"><input className={iCls} value={form.reaction} onChange={e => s('reaction')(e.target.value)} placeholder="e.g. Rash" /></Field>
            <Field label="Severity">
              <select className={cn(iCls,'bg-[#0f1120]',!form.severity&&'text-zinc-600')} value={form.severity} onChange={e => s('severity')(e.target.value)}>
                <option value="">Select…</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option>
              </select>
            </Field>
            <Field label="Notes"><input className={iCls} value={form.notes} onChange={e => s('notes')(e.target.value)} placeholder="Notes" /></Field>
          </div>
        </AddForm>
      )}
      {isLoading && <SkeletonRows />}
      {!isLoading && !data?.length && !adding && <p className="text-zinc-700 text-xs py-3">No allergies recorded</p>}
      {!isLoading && !!data?.length && (
        <div className="space-y-2">
          {data.map(a => (
            <div key={a.id} className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2"><span className="text-sm text-white font-medium">{a.allergen}</span><SeverityBadge s={a.severity} /></div>
              {a.reaction && <p className="text-xs text-zinc-500 mt-0.5">Reaction: {a.reaction}</p>}
              {a.notes && <p className="text-xs text-zinc-600 mt-0.5">{a.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Conditions ────────────────────────────────────────────────────────────────

function ConditionsSection({ pid }: { pid: number }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ condition: '', icd_code: '', status: 'active', onset_date: '', notes: '' })
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['conditions', pid], queryFn: () => api.get<{ data: Condition[] }>(`/patients/${pid}/conditions`).then(r => r.data.data) })
  const add = useMutation({
    mutationFn: (d: Record<string,string>) => api.post(`/patients/${pid}/conditions`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conditions', pid] }); setAdding(false); setForm({ condition: '', icd_code: '', status: 'active', onset_date: '', notes: '' }) },
  })
  const s = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div>
      <SectionHeader icon={Activity} label="Conditions" count={data?.length} onAdd={() => setAdding(v => !v)} adding={adding} />
      {adding && (
        <AddForm onCancel={() => setAdding(false)} onSubmit={e => { e.preventDefault(); const p: Record<string,string>={}; Object.entries(form).forEach(([k,v])=>{if(v)p[k]=v}); add.mutate(p) }} loading={add.isPending}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Condition" required><input className={iCls} value={form.condition} onChange={e => s('condition')(e.target.value)} placeholder="e.g. Hypertension" /></Field>
            <Field label="ICD Code"><input className={iCls} value={form.icd_code} onChange={e => s('icd_code')(e.target.value)} placeholder="e.g. I10" /></Field>
            <Field label="Status">
              <select className={cn(iCls,'bg-[#0f1120]')} value={form.status} onChange={e => s('status')(e.target.value)}>
                <option value="active">Active</option><option value="resolved">Resolved</option>
              </select>
            </Field>
            <Field label="Onset Date"><input type="date" className={iCls} value={form.onset_date} onChange={e => s('onset_date')(e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Notes"><input className={iCls} value={form.notes} onChange={e => s('notes')(e.target.value)} placeholder="Notes" /></Field></div>
          </div>
        </AddForm>
      )}
      {isLoading && <SkeletonRows />}
      {!isLoading && !data?.length && !adding && <p className="text-zinc-700 text-xs py-3">No conditions recorded</p>}
      {!isLoading && !!data?.length && (
        <div className="space-y-2">
          {data.map(c => (
            <div key={c.id} className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-white font-medium">{c.condition}</span>
                <ConditionBadge s={c.status} />
                {c.icd_code && <span className="text-[10px] text-zinc-600 font-mono">{c.icd_code}</span>}
              </div>
              {c.onset_date && <p className="text-xs text-zinc-500 mt-0.5">Onset: {fmtDate(c.onset_date)}</p>}
              {c.notes && <p className="text-xs text-zinc-600 mt-0.5">{c.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Medications ───────────────────────────────────────────────────────────────

function MedicationsSection({ pid }: { pid: number }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ drug_name: '', dose: '', frequency: '', start_date: '', end_date: '', notes: '' })
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['medications', pid], queryFn: () => api.get<{ data: Medication[] }>(`/patients/${pid}/medications`).then(r => r.data.data) })
  const add = useMutation({
    mutationFn: (d: Record<string,string>) => api.post(`/patients/${pid}/medications`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['medications', pid] }); setAdding(false); setForm({ drug_name: '', dose: '', frequency: '', start_date: '', end_date: '', notes: '' }) },
  })
  const s = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div>
      <SectionHeader icon={Pill} label="Medications" count={data?.length} onAdd={() => setAdding(v => !v)} adding={adding} />
      {adding && (
        <AddForm onCancel={() => setAdding(false)} onSubmit={e => { e.preventDefault(); const p: Record<string,string>={}; Object.entries(form).forEach(([k,v])=>{if(v)p[k]=v}); add.mutate(p) }} loading={add.isPending}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Drug Name" required><input className={iCls} value={form.drug_name} onChange={e => s('drug_name')(e.target.value)} placeholder="e.g. Amoxicillin" /></Field>
            <Field label="Dose"><input className={iCls} value={form.dose} onChange={e => s('dose')(e.target.value)} placeholder="e.g. 500mg" /></Field>
            <Field label="Frequency"><input className={iCls} value={form.frequency} onChange={e => s('frequency')(e.target.value)} placeholder="e.g. 3x daily" /></Field>
            <Field label="Start Date"><input type="date" className={iCls} value={form.start_date} onChange={e => s('start_date')(e.target.value)} /></Field>
            <Field label="End Date"><input type="date" className={iCls} value={form.end_date} onChange={e => s('end_date')(e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Notes"><input className={iCls} value={form.notes} onChange={e => s('notes')(e.target.value)} placeholder="Notes" /></Field></div>
          </div>
        </AddForm>
      )}
      {isLoading && <SkeletonRows />}
      {!isLoading && !data?.length && !adding && <p className="text-zinc-700 text-xs py-3">No medications recorded</p>}
      {!isLoading && !!data?.length && (
        <div className="space-y-2">
          {data.map(m => (
            <div key={m.id} className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-white font-medium">{m.drug_name}</span>
                {m.dose && <span className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5">{m.dose}</span>}
                {m.frequency && <span className="text-xs text-zinc-500">{m.frequency}</span>}
              </div>
              {(m.start_date || m.end_date) && <p className="text-xs text-zinc-600 mt-0.5">{m.start_date && fmtDate(m.start_date)}{m.end_date && ` → ${fmtDate(m.end_date)}`}</p>}
              {m.notes && <p className="text-xs text-zinc-600 mt-0.5">{m.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function OverviewTab({ p }: { p: Patient }) {
  const age = getAge(p.date_of_birth)
  return (
    <div className="space-y-4">
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-4">Demographics</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <InfoRow label="Date of Birth" value={p.date_of_birth ? `${fmtDate(p.date_of_birth)}${age ? ` (${age}y)` : ''}` : null} />
          <InfoRow label="Gender" value={p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : null} />
          <InfoRow label="Blood Type" value={p.blood_type ? <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/15 rounded px-1.5 py-0.5">{p.blood_type}</span> : null} />
          <InfoRow label="Phone" value={p.phone} />
          <InfoRow label="Email" value={p.email} />
          <InfoRow label="Address" value={p.address} />
        </div>
      </div>
      {(p.emergency_contact_name || p.emergency_contact_phone) && (
        <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-4">Emergency Contact</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Name" value={p.emergency_contact_name} />
            <InfoRow label="Phone" value={p.emergency_contact_phone} />
          </div>
        </div>
      )}
      {p.medical_alerts && (
        <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-red-400" strokeWidth={1.8} /><p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Medical Alerts</p></div>
          <p className="text-sm text-zinc-300 leading-relaxed">{p.medical_alerts}</p>
        </div>
      )}
      {p.notes && (
        <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Notes</p>
          <p className="text-sm text-zinc-400 leading-relaxed">{p.notes}</p>
        </div>
      )}
    </div>
  )
}

function MedicalTab({ pid }: { pid: number }) {
  return (
    <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5 space-y-6">
      <AllergiesSection pid={pid} />
      <div className="border-t border-white/[0.05]" />
      <ConditionsSection pid={pid} />
      <div className="border-t border-white/[0.05]" />
      <MedicationsSection pid={pid} />
    </div>
  )
}

function ContactsTab({ pid }: { pid: number }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ label: '', name: '', phone: '', relationship: '', is_emergency: false })
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['contacts', pid], queryFn: () => api.get<{ data: Contact[] }>(`/patients/${pid}/contacts`).then(r => r.data.data) })
  const add = useMutation({
    mutationFn: (d: typeof form) => api.post(`/patients/${pid}/contacts`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts', pid] }); setAdding(false); setForm({ label: '', name: '', phone: '', relationship: '', is_emergency: false }) },
  })
  const s = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5">
      <SectionHeader icon={Users} label="Contacts" count={data?.length} onAdd={() => setAdding(v => !v)} adding={adding} />
      {adding && (
        <AddForm onCancel={() => setAdding(false)} onSubmit={e => { e.preventDefault(); add.mutate(form) }} loading={add.isPending}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label" required><input className={iCls} value={form.label} onChange={e => s('label')(e.target.value)} placeholder="e.g. Spouse" /></Field>
            <Field label="Name" required><input className={iCls} value={form.name} onChange={e => s('name')(e.target.value)} placeholder="Full name" /></Field>
            <Field label="Phone"><input className={iCls} value={form.phone} onChange={e => s('phone')(e.target.value)} /></Field>
            <Field label="Relationship"><input className={iCls} value={form.relationship} onChange={e => s('relationship')(e.target.value)} placeholder="e.g. Wife" /></Field>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
            <input type="checkbox" checked={form.is_emergency} onChange={e => setForm(f => ({...f, is_emergency: e.target.checked}))} className="w-3.5 h-3.5 accent-indigo-500" />
            <span className="text-xs text-zinc-400">Emergency contact</span>
          </label>
        </AddForm>
      )}
      {isLoading && <SkeletonRows />}
      {!isLoading && !data?.length && !adding && <p className="text-zinc-700 text-sm py-6 text-center">No contacts recorded</p>}
      {!isLoading && !!data?.length && (
        <div className="space-y-2">
          {data.map(c => (
            <div key={c.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                {c.name.split(' ').map((n: string) => n[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">{c.name}</span>
                  {c.is_emergency && <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-1.5 py-0.5">Emergency</span>}
                </div>
                <p className="text-xs text-zinc-500">{c.label}{c.relationship ? ` · ${c.relationship}` : ''}{c.phone ? ` · ${c.phone}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ConsentsTab({ pid }: { pid: number }) {
  const { data, isLoading } = useQuery({ queryKey: ['consents', pid], queryFn: () => api.get<{ data: Consent[] }>(`/patients/${pid}/consents`).then(r => r.data.data) })
  return (
    <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-zinc-500" strokeWidth={1.8} />
        <span className="text-sm font-medium text-white">Consents</span>
        {data && <span className="text-xs text-zinc-600 bg-white/[0.04] border border-white/[0.07] rounded-full px-2 py-0.5">{data.length}</span>}
      </div>
      {isLoading && <SkeletonRows />}
      {!isLoading && !data?.length && <p className="text-zinc-700 text-sm py-6 text-center">No consents recorded</p>}
      {!isLoading && !!data?.length && (
        <div className="space-y-2">
          {data.map(c => (
            <div key={c.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-3">
              <div>
                <p className="text-sm text-white font-medium">{c.consent_type}</p>
                {c.signed_at && <p className="text-xs text-zinc-500 mt-0.5">Signed {fmtDate(c.signed_at)}</p>}
              </div>
              <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border',
                c.signed_by_patient ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-700/30 border-zinc-700/50',
              )}>{c.signed_by_patient ? 'Signed' : 'Unsigned'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Edit Form ─────────────────────────────────────────────────────────────────

function EditPatientForm({ patient, onSuccess, onClose }: { patient: Patient; onSuccess: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    first_name: patient.first_name, last_name: patient.last_name,
    gender: patient.gender ?? '', date_of_birth: patient.date_of_birth ?? '',
    phone: patient.phone ?? '', email: patient.email ?? '', address: patient.address ?? '',
    emergency_contact_name: patient.emergency_contact_name ?? '',
    emergency_contact_phone: patient.emergency_contact_phone ?? '',
    blood_type: patient.blood_type ?? '',
    medical_alerts: patient.medical_alerts ?? '', notes: patient.notes ?? '',
  })
  const [err, setErr] = useState('')
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (d: typeof form) => api.patch(`/patients/${patient.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patient', patient.id] }); onSuccess() },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Update failed.'),
  })
  const s = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <form onSubmit={e => { e.preventDefault(); setErr(''); mutation.mutate(form) }} className="p-6 space-y-6" noValidate>
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Basic Info</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" required><input className={iCls} value={form.first_name} onChange={e => s('first_name')(e.target.value)} /></Field>
          <Field label="Last Name" required><input className={iCls} value={form.last_name} onChange={e => s('last_name')(e.target.value)} /></Field>
          <Field label="Gender"><select className={cn(iCls,'bg-[#0f1120]')} value={form.gender} onChange={e => s('gender')(e.target.value)}><option value="">Select…</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
          <Field label="Date of Birth"><input type="date" className={iCls} value={form.date_of_birth} onChange={e => s('date_of_birth')(e.target.value)} /></Field>
          <Field label="Blood Type"><select className={cn(iCls,'bg-[#0f1120]')} value={form.blood_type} onChange={e => s('blood_type')(e.target.value)}><option value="">Select…</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(v=><option key={v} value={v}>{v}</option>)}</select></Field>
        </div>
      </section>
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={iCls} value={form.phone} onChange={e => s('phone')(e.target.value)} /></Field>
          <Field label="Email"><input type="email" className={iCls} value={form.email} onChange={e => s('email')(e.target.value)} /></Field>
        </div>
        <Field label="Address"><textarea className={tCls} rows={2} value={form.address} onChange={e => s('address')(e.target.value)} /></Field>
      </section>
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Emergency Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input className={iCls} value={form.emergency_contact_name} onChange={e => s('emergency_contact_name')(e.target.value)} /></Field>
          <Field label="Phone"><input className={iCls} value={form.emergency_contact_phone} onChange={e => s('emergency_contact_phone')(e.target.value)} /></Field>
        </div>
      </section>
      <section className="space-y-3">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Medical</p>
        <Field label="Medical Alerts"><textarea className={tCls} rows={2} value={form.medical_alerts} onChange={e => s('medical_alerts')(e.target.value)} /></Field>
        <Field label="Notes"><textarea className={tCls} rows={2} value={form.notes} onChange={e => s('notes')(e.target.value)} /></Field>
      </section>
      <div className="flex gap-3 pt-2 pb-2">
        <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
          {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{mutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'medical' | 'contacts' | 'consents'
const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'medical',  label: 'Medical'  },
  { id: 'contacts', label: 'Contacts' },
  { id: 'consents', label: 'Consents' },
]

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab]       = useState<TabId>('overview')
  const [editOpen, setEdit] = useState(false)
  const qc = useQueryClient()

  const { data: patient, isLoading, isError } = useQuery({
    queryKey: ['patient', Number(id)],
    queryFn: () => api.get<{ data: Patient }>(`/patients/${id}`).then(r => r.data.data),
    enabled: !!id,
  })

  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/patients/${id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', Number(id)] })
      qc.invalidateQueries({ queryKey: ['patients'] })
    },
  })

  if (isLoading) return (
    <div className="max-w-4xl space-y-5 animate-pulse">
      <div className="h-4 w-28 bg-white/[0.05] rounded" />
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-6 h-32" />
    </div>
  )

  if (isError || !patient) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertCircle className="w-7 h-7 text-red-500/50" />
      <p className="text-zinc-500 text-sm">Patient not found.</p>
      <button onClick={() => navigate('/patients')} className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">← Back to Patients</button>
    </div>
  )

  const age = getAge(patient.date_of_birth)

  return (
    <div className="max-w-4xl space-y-5">

      {/* Back */}
      <button onClick={() => navigate('/patients')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.8} /> Patients
      </button>

      {/* Header */}
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold shrink-0',
              patient.is_active ? 'bg-indigo-500/15 text-indigo-300' : 'bg-zinc-700/40 text-zinc-500',
            )}>{initials(patient.full_name)}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white text-lg font-semibold">{patient.full_name}</h2>
                <span className={cn('text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border',
                  patient.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-700/30 border-zinc-700/50',
                )}>{patient.is_active ? 'Active' : 'Archived'}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs text-zinc-500">
                {patient.gender && <span className="capitalize">{patient.gender}</span>}
                {age !== null && <><span>·</span><span>{age}y</span></>}
                {patient.blood_type && <><span>·</span><span className="text-red-400 font-semibold">{patient.blood_type}</span></>}
                {patient.phone && <><span>·</span><span>{patient.phone}</span></>}
                {patient.email && <><span>·</span><span>{patient.email}</span></>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEdit(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-zinc-300 border border-white/[0.08] hover:bg-white/[0.06] transition-colors">
              <Edit2 className="w-3.5 h-3.5" strokeWidth={1.8} /> Edit
            </button>
            {patient.is_active && (
              <button onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                {archiveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" strokeWidth={1.8} />} Archive
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex-1 h-8 rounded-lg text-sm font-medium transition-colors',
              tab === t.id ? 'bg-[#0f1120] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >{t.label}</button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview' && <OverviewTab p={patient} />}
      {tab === 'medical'  && <MedicalTab pid={patient.id} />}
      {tab === 'contacts' && <ContactsTab pid={patient.id} />}
      {tab === 'consents' && <ConsentsTab pid={patient.id} />}

      {/* Edit Drawer */}
      <Drawer open={editOpen} onClose={() => setEdit(false)} title="Edit Patient">
        <EditPatientForm patient={patient} onSuccess={() => setEdit(false)} onClose={() => setEdit(false)} />
      </Drawer>
    </div>
  )
}
