import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight, Briefcase, User, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function AuthForm({ role }) {
  const isCEOFlow = role === 'ceo'
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(form.email, form.password, role)
        if (error) { showToast(error.message || 'Sign in failed', 'error') }
        else { showToast('Welcome back'); navigate('/') }
      } else {
        if (!isCEOFlow) { showToast('Team members must be invited by the CEO.', 'error'); setLoading(false); return }
        if (!form.name.trim()) { showToast('Please enter your name', 'error'); setLoading(false); return }
        const { error } = await signUp(form.email, form.password, form.name)
        if (error) { showToast(error.message || 'Sign up failed', 'error') }
        else { showToast('Account created. Check your email to verify if needed.'); setMode('signin') }
      }
    } catch (err) { showToast(err.message || 'Something went wrong', 'error') }
    setLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      showToast(error.message || 'Google sign in failed', 'error')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute top-0 right-0 pointer-events-none"
        style={{
          width: '700px', height: '700px',
          background: 'radial-gradient(circle at top right, rgba(197, 245, 66, 0.18) 0%, rgba(197, 245, 66, 0.05) 35%, transparent 70%)',
          transform: 'translate(15%, -15%)',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <Link to="/auth" className="text-white/60 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" strokeWidth={2} />Back
        </Link>

        <div className="text-center mb-8">
          <div className="text-5xl font-bold tracking-tight mb-3">
            <span style={{ color: '#C5F542' }}>A</span>xis
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#C5F542]/10 border border-[#C5F542]/30">
            {isCEOFlow ? (
              <Briefcase className="w-3.5 h-3.5" style={{ color: '#C5F542' }} strokeWidth={2.5} />
            ) : (
              <User className="w-3.5 h-3.5" style={{ color: '#C5F542' }} strokeWidth={2.5} />
            )}
            <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#C5F542' }}>
              {isCEOFlow ? 'CEO Access' : 'Team Member Access'}
            </span>
          </div>
        </div>

        <div className="bg-[#0a0a0a]/80 backdrop-blur-sm border border-white/10 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold" style={{ color: '#C5F542' }}>
              {mode === 'signin' ? 'Welcome back' : 'Create CEO Account'}
            </h2>
            <p className="text-sm mt-1" style={{ color: '#C5F542', opacity: 0.7 }}>
              {mode === 'signin' ? `Sign in as ${isCEOFlow ? 'CEO' : 'Team Member'}` : 'First time setup'}
            </p>
          </div>

          {/* Google Sign In Button */}
          {mode === 'signin' && (
            <>
              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-100 text-black font-medium rounded-lg transition-colors disabled:opacity-50 mb-4"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
                </svg>
                {googleLoading ? 'Redirecting...' : 'Sign in with Google'}
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-white/30 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <input
                type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white placeholder-white/40 focus:border-[#C5F542] focus:outline-none transition-colors"
                placeholder="Full Name" required
              />
            )}
            <input
              type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white placeholder-white/40 focus:border-[#C5F542] focus:outline-none transition-colors"
              placeholder="Email" required
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 pr-12 bg-black/40 border border-white/10 text-white placeholder-white/40 focus:border-[#C5F542] focus:outline-none transition-colors"
                placeholder="Password" required minLength={6}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors" tabIndex={-1}>
                {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.8} /> : <Eye className="w-5 h-5" strokeWidth={1.8} />}
              </button>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-white hover:bg-gray-100 text-black font-semibold py-3 flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              {!loading && <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
            </button>
          </form>

          {isCEOFlow && (
            <div className="mt-6 text-center">
              {mode === 'signin' ? (
                <p className="text-sm" style={{ color: '#C5F542' }}>
                  Don't have an account?{' '}
                  <button onClick={() => setMode('signup')} className="text-[#C5F542] hover:underline font-semibold">Sign up →</button>
                </p>
              ) : (
                <p className="text-sm" style={{ color: '#C5F542' }}>
                  Already have an account?{' '}
                  <button onClick={() => setMode('signin')} className="text-[#C5F542] hover:underline font-semibold">Sign in →</button>
                </p>
              )}
            </div>
          )}

          {!isCEOFlow && (
            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-xs text-white/50 leading-relaxed">
                Team Members can only sign in.<br />New members are invited by the CEO via email.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}