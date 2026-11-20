import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, CheckCircle2, AlertCircle, User } from 'lucide-react'
import { portalApi } from '@/portal/lib/portalApi'
import { usePortalAuthStore } from '@/portal/store/portalAuthStore'
import { cn } from '@/lib/utils'

interface PatientProfile {
  id: number; first_name: string; last_name: string
  email: string | null; phone: string | null
  date_of_birth: string | null; address: string | null
  gender: string | null; blood_type: string | null
  medical_alerts: string | null
}

const iCls = 'w-full h-10 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-all'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

export default function PortalProfilePage() {
  const patient     = usePortalAuthStore(s => s.patient)
  const setAuth     = usePortalAuthStore(s => s.setAuth)
  const token       = usePortalAuthStore(s => s.token)
  const qc          = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [err, setErr]     = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['portal-me'],
    queryFn: () => portalApi.get<{ data: PatientProfile }>('/me').then(r => r.data.data),
  })

  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', email: '', address: '', date_of_birth: '',
  })

  useEffect(() => {
    if (data) {
      setForm({
        first_name:    data.first_name ?? '',
        last_name:     data.last_name  ?? '',
        phone:         data.phone      ?? '',
        email:         data.email      ?? '',
        address:       data.address    ?? '',
        date_of_birth: data.date_of_birth ?? '',
      })
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: (d: typeof form) => portalApi.patch('/me', d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['portal-me'] })
      // Update the portal auth store with new name
      if (patient && token) {
        const updated = res.data?.data ?? res.data
        setAuth(token, { ...patient, first_name: updated.first_name ?? patient.first_name, last_name: updated.last_name ?? patient.last_name })
      }
      setSaved(true); setErr(''); setTimeout(() => setSaved(false), 3000)
    },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Update failed.'),
  })

  function s(k: string) { return (v: string) => setForm(f => ({ ...f, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const payload: Record<string,string> = {}
    Object.entries(form).forEach(([k,v]) => { if (v) payload[k] = v })
    mutation.mutate(form)
  }

  if (isLoading) return <div className="space-y-3 animate-pulse">{Array(5).fill(0).map((_,i) => <div key={i} className="h-14 bg-white/[0.03] rounded-lg" />)}</div>

  return (
    <div className="space-y-6">
      <h1 className="text-white font-semibold">My Profile</h1>

      {/* Avatar card */}
      <div className="bg-gradient-to-br from-teal-500/15 to-teal-600/5 border border-teal-500/20 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shrink-0">
          <User className="w-6 h-6 text-teal-400" strokeWidth={1.6} />
        </div>
        <div>
          <p className="text-white font-semibold text-lg">{form.first_name} {form.last_name}</p>
          <p className="text-zinc-500 text-xs mt-0.5">{form.email || form.phone || 'Patient'}</p>
        </div>
      </div>

      {/* Read-only medical info */}
      {(data?.blood_type || data?.medical_alerts) && (
        <div className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-4 space-y-3">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Medical Info (read-only)</p>
          {data.blood_type && (
            <div><p className="text-[11px] text-zinc-600 uppercase tracking-wide mb-0.5">Blood Type</p>
              <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/15 rounded px-1.5 py-0.5">{data.blood_type}</span>
            </div>
          )}
          {data.medical_alerts && (
            <div><p className="text-[11px] text-zinc-600 uppercase tracking-wide mb-0.5">Medical Alerts</p>
              <p className="text-xs text-amber-300/80">{data.medical_alerts}</p>
            </div>
          )}
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={handleSubmit} className="bg-[#0f1120] border border-white/[0.07] rounded-xl p-5 space-y-4">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Personal Information</p>
        {err && <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /><span>{err}</span></div>}
        {saved && <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-3 py-2.5"><CheckCircle2 className="w-3.5 h-3.5" /> Profile updated successfully.</div>}

        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name"><input className={iCls} value={form.first_name} onChange={e => s('first_name')(e.target.value)} placeholder="Jane" /></Field>
          <Field label="Last Name"><input className={iCls} value={form.last_name} onChange={e => s('last_name')(e.target.value)} placeholder="Doe" /></Field>
          <Field label="Phone"><input type="tel" className={iCls} value={form.phone} onChange={e => s('phone')(e.target.value)} placeholder="+1 555 000 0000" /></Field>
          <Field label="Email"><input type="email" className={iCls} value={form.email} onChange={e => s('email')(e.target.value)} placeholder="jane@email.com" /></Field>
          <Field label="Date of Birth"><input type="date" className={iCls} value={form.date_of_birth} onChange={e => s('date_of_birth')(e.target.value)} /></Field>
        </div>

        <Field label="Address">
          <textarea
            className="w-full px-3 py-2.5 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none resize-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-all"
            rows={2} value={form.address} onChange={e => s('address')(e.target.value)} placeholder="Street, City, Country"
          />
        </Field>

        <button type="submit" disabled={mutation.isPending}
          className="w-full h-10 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-teal-500/20">
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {mutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
