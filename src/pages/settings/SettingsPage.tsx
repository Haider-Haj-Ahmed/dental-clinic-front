import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, Plus, Trash2, AlertCircle, CheckCircle2, X, Edit2, Power } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkingHour  { id?: number; day_of_week: number; is_closed: boolean; open_time: string | null; close_time: string | null }
interface Closure      { id: number; date: string; reason: string | null }
interface Operatory    { id: number; name: string; description: string | null; is_active: boolean }
interface ApptType     { id: number; name: string; default_duration_minutes: number; color: string | null; is_active: boolean }
interface PayMethod    { id: number; name: string; is_active: boolean }

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
function fmtDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }) }
function todayStr()         { return new Date().toISOString().slice(0,10) }

const iCls = 'w-full h-9 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</label>{children}</div>
}

function SaveBar({ onSave, loading, saved }: { onSave: () => void; loading: boolean; saved: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {saved && <span className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Saved</span>}
      <button onClick={onSave} disabled={loading}
        className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.8} />}
        {loading ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={cn('w-10 h-5 rounded-full transition-colors relative shrink-0', value ? 'bg-indigo-600' : 'bg-zinc-700')}>
      <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', value ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  )
}

// ── General Tab ───────────────────────────────────────────────────────────────

function GeneralTab() {
  const [form, setForm] = useState<Record<string,string>>({})
  const [saved, setSaved] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<{ data: Record<string,string> }>('/settings').then(r => r.data.data) })
  useEffect(() => { if (data) setForm(data) }, [data])

  const mutation = useMutation({
    mutationFn: (d: Record<string,string>) => api.patch('/settings', d),  // ← PATCH not PUT
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setSaved(true); setTimeout(() => setSaved(false), 3000) },
  })

  const FIELDS = [
    { key: 'clinic_name',    label: 'Clinic Name',    placeholder: 'My Dental Clinic' },
    { key: 'clinic_email',   label: 'Clinic Email',   placeholder: 'info@clinic.com'  },
    { key: 'clinic_phone',   label: 'Clinic Phone',   placeholder: '+1 555 000 0000'  },
    { key: 'clinic_website', label: 'Website',        placeholder: 'https://…'        },
    { key: 'clinic_address', label: 'Address',        placeholder: 'Street, City'     },
    { key: 'timezone',       label: 'Timezone',       placeholder: 'UTC'              },
    { key: 'currency',       label: 'Currency',       placeholder: 'USD'              },
    { key: 'date_format',    label: 'Date Format',    placeholder: 'Y-m-d'            },
    { key: 'invoice_prefix', label: 'Invoice Prefix', placeholder: 'INV-'             },
  ]

  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_,i) => <div key={i} className="h-14 bg-white/[0.03] rounded-lg animate-pulse" />)}</div>

  return (
    <div className="space-y-5">
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5 space-y-4">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Clinic Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(f => <Field key={f.key} label={f.label}><input className={iCls} value={form[f.key]??''} onChange={e => setForm(ff=>({...ff,[f.key]:e.target.value}))} placeholder={f.placeholder} /></Field>)}
        </div>
      </div>
      <div className="flex justify-end"><SaveBar onSave={() => mutation.mutate(form)} loading={mutation.isPending} saved={saved} /></div>
    </div>
  )
}

// ── Working Hours Tab ─────────────────────────────────────────────────────────

function WorkingHoursTab() {
  const [hours, setHours] = useState<WorkingHour[]>([])
  const [saved, setSaved] = useState(false)
  const [err, setErr]     = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['working-hours'], queryFn: () => api.get<{ data: WorkingHour[] }>('/working-hours').then(r => r.data.data) })
  useEffect(() => {
    if (data && data.length > 0) setHours(data)
    else setHours(DAYS.map((_,i) => ({ day_of_week:i, is_closed: i===0||i===6, open_time: (i===0||i===6)?null:'09:00', close_time: (i===0||i===6)?null:'17:00' })))
  }, [data])

  const mutation = useMutation({
    mutationFn: (d: WorkingHour[]) => api.put('/working-hours', { hours: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['working-hours'] }); setSaved(true); setErr(''); setTimeout(() => setSaved(false), 3000) },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed.'),
  })

  function update(i: number, k: keyof WorkingHour, v: boolean|string|null) { setHours(hs => hs.map((h,j) => j===i ? {...h,[k]:v} : h)) }
  function toggleClosed(i: number) { const h = hours[i]; if (!h.is_closed) { update(i,'is_closed',true); update(i,'open_time',null); update(i,'close_time',null) } else { update(i,'is_closed',false); update(i,'open_time','09:00'); update(i,'close_time','17:00') } }

  if (isLoading) return <div className="space-y-2">{Array(7).fill(0).map((_,i) => <div key={i} className="h-12 bg-white/[0.03] rounded-lg animate-pulse" />)}</div>

  return (
    <div className="space-y-5">
      {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-0 px-5 py-3 border-b border-white/[0.06]">
          {['Day','Status','Open','Close'].map((h,i) => <p key={i} className={cn('text-[11px] font-semibold text-zinc-500 uppercase tracking-wider', i===0?'col-span-3':i===1?'col-span-2':i===2?'col-span-3':'col-span-3')}>{h}</p>)}
          <p className="col-span-1"></p>
        </div>
        {hours.map((h,i) => (
          <div key={i} className={cn('grid grid-cols-12 items-center px-5 py-3.5 border-b border-white/[0.04] last:border-b-0', h.is_closed && 'opacity-50')}>
            <div className="col-span-3"><p className="text-sm text-white font-medium">{DAYS[h.day_of_week]}</p></div>
            <div className="col-span-2">
              <button onClick={() => toggleClosed(i)} className={cn('h-6 px-2.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border transition-colors',
                h.is_closed ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              )}>{h.is_closed ? 'Closed' : 'Open'}</button>
            </div>
            <div className="col-span-3 pr-3">{!h.is_closed && <input type="time" className="h-8 px-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/50 transition-all w-full" value={h.open_time??''} onChange={e => update(i,'open_time',e.target.value)} />}</div>
            <div className="col-span-3 pr-3">{!h.is_closed && <input type="time" className="h-8 px-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] outline-none focus:border-indigo-500/50 transition-all w-full" value={h.close_time??''} onChange={e => update(i,'close_time',e.target.value)} />}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end"><SaveBar onSave={() => mutation.mutate(hours)} loading={mutation.isPending} saved={saved} /></div>
    </div>
  )
}

// ── Closures Tab ──────────────────────────────────────────────────────────────

function ClosuresTab() {
  const [form, setForm] = useState({ date: todayStr(), reason: '' })
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['closures'], queryFn: () => api.get<{ data: Closure[] }>('/closures').then(r => r.data.data) })
  const addMutation = useMutation({ mutationFn: (d: typeof form) => api.post('/closures', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['closures'] }); setAdding(false); setForm({ date: todayStr(), reason: '' }); setErr('') }, onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.') })
  const delMutation = useMutation({ mutationFn: (id: number) => api.delete(`/closures/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['closures'] }) })

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Dates when the clinic is closed.</p>
        <button onClick={() => setAdding(v=>!v)} className={cn('flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors', adding ? 'text-zinc-400 border-white/[0.08]' : 'text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10')}>
          {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}{adding ? 'Cancel' : 'Add Closure'}
        </button>
      </div>
      {adding && (
        <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5 space-y-3">
          {err && <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /><span>{err}</span></div>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className={iCls} value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} /></Field>
            <Field label="Reason"><input className={iCls} value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} placeholder="e.g. National Holiday" /></Field>
          </div>
          <button onClick={() => addMutation.mutate(form)} disabled={addMutation.isPending} className="h-8 px-4 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-1.5 disabled:opacity-50">
            {addMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}{addMutation.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        {isLoading && Array(3).fill(0).map((_,i) => <div key={i} className="h-12 bg-white/[0.03] m-4 rounded-lg animate-pulse" />)}
        {!isLoading && (!data || data.length === 0) && <div className="px-5 py-10 text-center text-zinc-600 text-sm">No closures scheduled</div>}
        {data?.map((c,i) => (
          <div key={c.id} className={cn('flex items-center justify-between px-5 py-3.5', i < (data?.length??0)-1 && 'border-b border-white/[0.05]')}>
            <div><p className="text-sm text-white font-medium">{fmtDate(c.date)}</p>{c.reason && <p className="text-xs text-zinc-500 mt-0.5">{c.reason}</p>}</div>
            <button onClick={() => { if (confirm('Remove?')) delMutation.mutate(c.id) }} disabled={delMutation.isPending} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Generic list+CRUD tab (Operatories, AppTypes, PayMethods) ─────────────────

interface SimpleItem { id: number; name: string; is_active: boolean; [k: string]: unknown }

function SimpleListTab({ endpoint, label, extraFields }: {
  endpoint: string; label: string
  extraFields?: { key: string; label: string; type?: string; placeholder?: string }[]
}) {
  const [adding, setAdding]   = useState(false)
  const [editing, setEditing] = useState<SimpleItem | null>(null)
  const [form, setForm]       = useState<Record<string,string>>({})
  const [err, setErr]         = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: [endpoint], queryFn: () => api.get<{ data: SimpleItem[] }>(`/${endpoint}`, { params: { per_page: '100' } }).then(r => r.data.data) })

  const createMutation = useMutation({
    mutationFn: (d: Record<string,string|number|boolean>) => api.post(`/${endpoint}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [endpoint] }); setAdding(false); setForm({}); setErr('') },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Record<string,string|number|boolean> }) => api.patch(`/${endpoint}/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [endpoint] }); setEditing(null); setForm({}); setErr('') },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed.'),
  })
  const toggleMutation = useMutation({
    mutationFn: (item: SimpleItem) => api.patch(`/${endpoint}/${item.id}`, { is_active: !item.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [endpoint] }),
  })

  function openAdd()         { setAdding(true); setEditing(null); setForm({}); setErr('') }
  function openEdit(item: SimpleItem) { setEditing(item); setAdding(false); const f: Record<string,string> = { name: item.name }; extraFields?.forEach(ef => { f[ef.key] = String(item[ef.key]??'') }); setForm(f); setErr('') }
  function cancel()          { setAdding(false); setEditing(null); setForm({}); setErr('') }

  function submit() {
    if (!form.name?.trim()) { setErr('Name is required.'); return }
    const d: Record<string,string|number|boolean> = { name: form.name, is_active: true }
    extraFields?.forEach(ef => { if (form[ef.key]) d[ef.key] = ef.type === 'number' ? Number(form[ef.key]) : form[ef.key] })
    if (editing) updateMutation.mutate({ id: editing.id, d })
    else createMutation.mutate(d)
  }

  const items = data ?? []
  const isPending = createMutation.isPending || updateMutation.isPending
  const isFormOpen = adding || !!editing

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-end">
        <button onClick={openAdd} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/10 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New {label}
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5 space-y-3">
          <p className="text-xs font-semibold text-white">{editing ? `Edit ${label}` : `New ${label}`}</p>
          {err && <div className="text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2">{err}</div>}
          <Field label="Name"><input className={iCls} value={form.name??''} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder={`${label} name`} /></Field>
          {extraFields?.map(ef => (
            <Field key={ef.key} label={ef.label}>
              <input type={ef.type??'text'} className={iCls} value={form[ef.key]??''} onChange={e => setForm(f=>({...f,[ef.key]:e.target.value}))} placeholder={ef.placeholder} />
            </Field>
          ))}
          <div className="flex gap-2">
            <button onClick={cancel} className="h-8 px-3 rounded-lg text-xs text-zinc-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors">Cancel</button>
            <button onClick={submit} disabled={isPending} className="h-8 px-4 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}{isPending ? 'Saving…' : editing ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl overflow-hidden">
        {isLoading && Array(4).fill(0).map((_,i) => <div key={i} className="h-12 bg-white/[0.03] m-3 rounded-lg animate-pulse" />)}
        {!isLoading && items.length === 0 && <div className="px-5 py-8 text-center text-zinc-600 text-sm">No {label.toLowerCase()}s yet</div>}
        {items.map((item, i) => (
          <div key={item.id} className={cn('flex items-center justify-between px-4 py-3', i < items.length-1 && 'border-b border-white/[0.05]')}>
            <div>
              <p className={cn('text-sm font-medium', item.is_active ? 'text-white' : 'text-zinc-500')}>{item.name}</p>
              {extraFields?.map(ef => item[ef.key] !== null && item[ef.key] !== undefined && (
                <p key={ef.key} className="text-xs text-zinc-600 mt-0.5">{ef.label}: {String(item[ef.key])}</p>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => openEdit(item)} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <Edit2 className="w-3.5 h-3.5" strokeWidth={1.8} />
              </button>
              <button onClick={() => toggleMutation.mutate(item)} disabled={toggleMutation.isPending}
                className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-colors', item.is_active ? 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10' : 'text-zinc-700 hover:text-emerald-400 hover:bg-emerald-500/10')}>
                <Power className="w-3.5 h-3.5" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabId = 'general' | 'hours' | 'closures' | 'operatories' | 'appt-types' | 'pay-methods'

const TABS: { id: TabId; label: string }[] = [
  { id: 'general',      label: 'Clinic Info'        },
  { id: 'hours',        label: 'Working Hours'       },
  { id: 'closures',     label: 'Closures'            },
  { id: 'operatories',  label: 'Operatories'         },
  { id: 'appt-types',   label: 'Appointment Types'  },
  { id: 'pay-methods',  label: 'Payment Methods'    },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('general')
  return (
    <div className="max-w-4xl space-y-5">
      <h2 className="text-white font-semibold">Settings</h2>
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('h-8 px-4 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
              tab===t.id ? 'bg-[#0f1120] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300',
            )}>{t.label}</button>
        ))}
      </div>
      {tab === 'general'     && <GeneralTab />}
      {tab === 'hours'       && <WorkingHoursTab />}
      {tab === 'closures'    && <ClosuresTab />}
      {tab === 'operatories' && <SimpleListTab endpoint="operatories" label="Operatory" extraFields={[{ key: 'description', label: 'Description', placeholder: 'e.g. Main treatment room' }]} />}
      {tab === 'appt-types'  && <SimpleListTab endpoint="appointment-types" label="Appointment Type" extraFields={[{ key: 'default_duration_minutes', label: 'Duration (min)', type: 'number', placeholder: '30' }, { key: 'color', label: 'Color (hex)', placeholder: '#6366f1' }]} />}
      {tab === 'pay-methods' && <SimpleListTab endpoint="payment-methods" label="Payment Method" />}
    </div>
  )
}
