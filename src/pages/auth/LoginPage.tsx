import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Stethoscope, Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AuthResponse } from '@/types'

export default function LoginPage() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const navigate = useNavigate()
  const setAuth  = useAuthStore(s => s.setAuth)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, password })

      if (data.requires_2fa) {
        navigate('/2fa', { state: { two_factor_token: data.two_factor_token } })
        return
      }

      setAuth(data.token, data.user)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Invalid credentials.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(to right,#ffffff0a 1px,transparent 1px),linear-gradient(to bottom,#ffffff0a 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-sm">

        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8 select-none">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/10">
            <Stethoscope className="w-5 h-5 text-indigo-400" strokeWidth={1.8} />
          </div>
          <span className="text-white font-semibold tracking-tight">Dental Clinic PMS</span>
          <span className="text-zinc-500 text-xs mt-0.5">Staff portal</span>
        </div>

        {/* Card */}
        <div className="bg-[#0f1120] border border-white/[0.07] rounded-2xl p-7 shadow-2xl shadow-black/60">

          <h2 className="text-white text-lg font-semibold mb-5">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@clinic.com"
                required
                autoComplete="email"
                className={cn(
                  'w-full h-10 px-3 rounded-lg text-sm text-white',
                  'bg-white/[0.04] border border-white/[0.08]',
                  'placeholder:text-zinc-600',
                  'outline-none transition-all duration-150',
                  'focus:border-indigo-500/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-indigo-500/20',
                )}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className={cn(
                    'w-full h-10 px-3 pr-10 rounded-lg text-sm text-white',
                    'bg-white/[0.04] border border-white/[0.08]',
                    'placeholder:text-zinc-600',
                    'outline-none transition-all duration-150',
                    'focus:border-indigo-500/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-indigo-500/20',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPass
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full h-10 rounded-lg text-sm font-medium transition-all duration-150',
                'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white',
                'shadow-lg shadow-indigo-500/20',
                'flex items-center justify-center gap-2',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
              )}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-zinc-600 text-xs mt-5">
          Dental Clinic PMS &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
