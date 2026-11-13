import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Stethoscope, Mail, Phone, Loader2, AlertCircle } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { portalApi } from '@/portal/lib/portalApi'
import { usePortalAuthStore } from '@/portal/store/portalAuthStore'
import { cn } from '@/lib/utils'

type Step  = 'contact' | 'otp'
type Channel = 'email' | 'phone'

const iCls = 'w-full h-10 px-3 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder:text-zinc-600 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-all'

export default function PortalLoginPage() {
  const [step, setStep]       = useState<Step>('contact')
  const [channel, setChannel] = useState<Channel>('email')
  const [contact, setContact] = useState('')
  const [digits, setDigits]   = useState<string[]>(Array(6).fill(''))
  const [err, setErr]         = useState('')
  const inputRefs             = useRef<(HTMLInputElement | null)[]>([])
  const navigate              = useNavigate()
  const setAuth               = usePortalAuthStore(s => s.setAuth)

  const requestMutation = useMutation({
    mutationFn: (d: Record<string,string>) => portalApi.post('/auth/request-otp', d),
    onSuccess: () => { setStep('otp'); setErr('') },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Request failed.'),
  })

  const verifyMutation = useMutation({
    mutationFn: (d: Record<string,string>) => portalApi.post('/auth/verify-otp', d),
    onSuccess: (res) => {
      const { token, patient } = res.data
      setAuth(token, patient)
      navigate('/portal')
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Invalid code.'
      setErr(msg); setDigits(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    },
  })

  function handleRequest(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!contact.trim()) { setErr(`Please enter your ${channel}.`); return }
    requestMutation.mutate({ [channel]: contact })
  }

  function handleDigit(idx: number, val: string) {
    const char = val.replace(/\D/g,'').slice(-1)
    const next = [...digits]; next[idx] = char; setDigits(next)
    if (char && idx < 5) inputRefs.current[idx+1]?.focus()
    if (next.every(d => d)) {
      verifyMutation.mutate({ [channel]: contact, code: next.join(''), device_name: navigator.userAgent.slice(0,255) })
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) inputRefs.current[idx-1]?.focus()
  }

  return (
    <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Grid bg */}
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage:'linear-gradient(to right,#ffffff0a 1px,transparent 1px),linear-gradient(to bottom,#ffffff0a 1px,transparent 1px)', backgroundSize:'48px 48px' }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-teal-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8 select-none">
          <div className="w-11 h-11 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center mb-3 shadow-lg shadow-teal-500/10">
            <Stethoscope className="w-5 h-5 text-teal-400" strokeWidth={1.8} />
          </div>
          <span className="text-white font-semibold tracking-tight">Patient Portal</span>
          <span className="text-zinc-500 text-xs mt-0.5">Access your health records</span>
        </div>

        <div className="bg-[#0f1120] border border-white/[0.07] rounded-2xl p-7 shadow-2xl shadow-black/60">

          {/* ── Step 1: Contact ── */}
          {step === 'contact' && (
            <>
              <h2 className="text-white text-lg font-semibold mb-5">Sign in</h2>
              {/* Channel toggle */}
              <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5 gap-0.5 mb-5">
                {(['email','phone'] as Channel[]).map(c => (
                  <button key={c} onClick={() => { setChannel(c); setContact(''); setErr('') }}
                    className={cn('flex-1 h-8 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                      channel===c ? 'bg-teal-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
                    )}>
                    {c === 'email' ? <Mail className="w-3.5 h-3.5" strokeWidth={1.8} /> : <Phone className="w-3.5 h-3.5" strokeWidth={1.8} />}
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
              <form onSubmit={handleRequest} className="space-y-4" noValidate>
                {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{channel === 'email' ? 'Email Address' : 'Phone Number'}</label>
                  <input
                    type={channel === 'email' ? 'email' : 'tel'}
                    value={contact} onChange={e => setContact(e.target.value)}
                    placeholder={channel === 'email' ? 'your@email.com' : '+1 555 000 0000'}
                    className={iCls} required autoComplete={channel}
                  />
                </div>
                <button type="submit" disabled={requestMutation.isPending}
                  className="w-full h-10 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-teal-500/20">
                  {requestMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {requestMutation.isPending ? 'Sending code…' : 'Send code'}
                </button>
              </form>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <>
              <h2 className="text-white text-lg font-semibold mb-1">Enter your code</h2>
              <p className="text-zinc-500 text-sm mb-6">
                We sent a 6-digit code to <span className="text-zinc-300">{contact}</span>. It expires in 10 minutes.
              </p>
              {err && <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5 mb-4"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{err}</span></div>}
              <div className="flex gap-2 justify-center mb-6">
                {digits.map((d, i) => (
                  <input key={i} ref={el => { inputRefs.current[i] = el }}
                    type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={e => handleDigit(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className={cn('w-10 h-12 text-center text-white text-lg font-semibold rounded-lg bg-white/[0.04] border outline-none transition-all',
                      d ? 'border-teal-500/40 bg-white/[0.06]' : 'border-white/[0.08]',
                      'focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20',
                    )}
                  />
                ))}
              </div>
              {verifyMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm mb-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                </div>
              )}
              <button onClick={() => { setStep('contact'); setDigits(Array(6).fill('')); setErr('') }}
                className="w-full text-center text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
