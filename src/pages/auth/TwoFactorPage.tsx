import { useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AuthResponse } from '@/types'

export default function TwoFactorPage() {
  const [digits, setDigits]   = useState<string[]>(Array(6).fill(''))
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const inputRefs             = useRef<(HTMLInputElement | null)[]>([])
  const navigate              = useNavigate()
  const location              = useLocation()
  const setAuth               = useAuthStore(s => s.setAuth)

  const twoFactorToken = (location.state as { two_factor_token?: string })?.two_factor_token

  function handleChange(idx: number, val: string) {
    const char = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = char
    setDigits(next)
    if (char && idx < 5) inputRefs.current[idx + 1]?.focus()
    if (next.every(d => d)) submitCode(next.join(''))
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
  }

  async function submitCode(code: string) {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post<AuthResponse>('/auth/2fa/challenge', {
        code,
        two_factor_token: twoFactorToken,
      })
      setAuth(data.token, data.user)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Invalid code. Try again.'
      setError(msg)
      setDigits(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(to right,#ffffff0a 1px,transparent 1px),linear-gradient(to bottom,#ffffff0a 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 select-none">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/10">
            <ShieldCheck className="w-5 h-5 text-indigo-400" strokeWidth={1.8} />
          </div>
          <span className="text-white font-semibold tracking-tight">Two-factor auth</span>
          <span className="text-zinc-500 text-xs mt-0.5">Enter the 6-digit code from your app</span>
        </div>

        <div className="bg-[#0f1120] border border-white/[0.07] rounded-2xl p-7 shadow-2xl shadow-black/60">
          <div className="flex gap-2.5 justify-center mb-5">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className={cn(
                  'w-10 h-12 text-center text-white text-lg font-semibold rounded-lg',
                  'bg-white/[0.04] border border-white/[0.08]',
                  'outline-none transition-all duration-150',
                  'focus:border-indigo-500/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-indigo-500/20',
                  d && 'border-indigo-500/40',
                )}
              />
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying…
            </div>
          )}
        </div>

        <button
          onClick={() => navigate('/login')}
          className="w-full text-center text-zinc-500 hover:text-zinc-300 text-sm mt-5 transition-colors"
        >
          ← Back to sign in
        </button>
      </div>
    </div>
  )
}
