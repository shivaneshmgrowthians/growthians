import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

export default function AuthSetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [validSession, setValidSession] = useState(false)
  const { showToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    const verifyInvite = async () => {
      const hash = window.location.hash
      const params = new URLSearchParams(hash.replace('#', ''))
      const accessToken = params.get('access_token')
      const type = params.get('type')

      if (accessToken && type === 'invite') {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: accessToken,
          type: 'email',
        })
        if (error) {
          showToast('Invalid or expired invitation link', 'error')
          setTimeout(() => navigate('/auth'), 2000)
          return
        }
        setUserEmail(data.user?.email || '')
        setValidSession(true)
        return
      }

      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        showToast('Invalid or expired invitation link', 'error')
        setTimeout(() => navigate('/auth'), 2000)
        return
      }
      setUserEmail(data.session.user.email)
      setValidSession(true)
    }

    verifyInvite()
  }, [navigate, showToast])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      showToast(error.message || 'Failed to set password', 'error')
      setLoading(false)
      return
    }
    showToast('Password set! Welcome to Axis')
    setTimeout(() => navigate('/'), 1000)
  }

  if (!validSession) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-white/60">Verifying invitation...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute top-0 right-0 pointer-events-none"
        style={{
          width: '700px',
          height: '700px',
          background: 'radial-gradient(circle at top right, rgba(197, 245, 66, 0.18) 0%, rgba(197, 245, 66, 0.05) 35%, transparent 70%)',
          transform: 'translate(15%, -15%)',
        }}
      />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="text-5xl font-bold tracking-tight mb-3">
            <span style={{ color: '#C5F542' }}>A</span>xis
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#C5F542]/10 border border-[#C5F542]/30">
            <KeyRound className="w-3.5 h-3.5" style={{ color: '#C5F542' }} strokeWidth={2.5} />
            <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#C5F542' }}>
              Set Your Password
            </span>
          </div>
        </div>

        <div className="bg-[#0a0a0a]/80 backdrop-blur-sm border border-white/10 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold" style={{ color: '#C5F542' }}>
              Welcome to Axis!
            </h2>
            <p className="text-sm mt-1" style={{ color: '#C5F542', opacity: 0.7 }}>
              Set your password to complete your account setup
            </p>
          </div>

          {userEmail && (
            <div className="mb-4 p-3 bg-white/5 border border-white/10">
              <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Account</div>
              <div className="text-sm font-medium">{userEmail}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 bg-black/40 border border-white/10 text-white placeholder-white/40 focus:border-[#C5F542] focus:outline-none transition-colors"
                placeholder="New Password (min 6 characters)"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.8} /> : <Eye className="w-5 h-5" strokeWidth={1.8} />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 bg-black/40 border border-white/10 text-white placeholder-white/40 focus:border-[#C5F542] focus:outline-none transition-colors"
                placeholder="Confirm Password"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-gray-100 text-black font-semibold py-3 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? 'Setting password...' : 'Set Password & Continue'}
              {!loading && <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
            </button>
          </form>

          <p className="text-xs text-white/40 mt-6 text-center leading-relaxed">
            After setting your password, you'll be signed in automatically.
            <br />
            Use this password for future sign-ins.
          </p>
        </div>
      </div>
    </div>
  )
}