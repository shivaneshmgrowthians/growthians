import { Link } from 'react-router-dom'
import { Briefcase, User, ArrowRight } from 'lucide-react'

export default function AuthRoleSelector() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Lime glow */}
      <div
        className="absolute top-0 right-0 pointer-events-none"
        style={{
          width: '700px',
          height: '700px',
          background:
            'radial-gradient(circle at top right, rgba(197, 245, 66, 0.18) 0%, rgba(197, 245, 66, 0.05) 35%, transparent 70%)',
          transform: 'translate(15%, -15%)',
        }}
      />

      <div className="w-full max-w-2xl relative z-10">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="text-5xl font-bold tracking-tight mb-4">
            <span style={{ color: '#C5F542' }}>A</span>xis
          </div>
          <h1 className="text-2xl font-semibold mb-2">Welcome to Axis</h1>
          <p className="text-white/60 text-sm">
            Daily Task Tracker · Built for{' '}
            <span style={{ color: '#C5F542' }}>Growthians</span>
          </p>
        </div>

        {/* Role selector */}
        <div className="mb-8">
          <p className="text-center text-xs uppercase tracking-widest text-white/40 font-medium mb-6">
            Choose your role to continue
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CEO Card */}
            <Link
              to="/auth/ceo"
              className="group bg-[#0a0a0a] hover:bg-[#1a1a1a] border-2 border-white/10 hover:border-[#C5F542] p-8 transition-all text-left block"
            >
              <div
                className="w-14 h-14 mb-4 flex items-center justify-center"
                style={{ background: '#C5F542' }}
              >
                <Briefcase className="w-7 h-7 text-black" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold mb-2">CEO</h3>
              <p className="text-sm text-white/60 mb-4">
                Manage your team, approve requests, and view all submissions
              </p>
              <div
                className="flex items-center gap-1 text-xs uppercase tracking-widest font-semibold"
                style={{ color: '#C5F542' }}
              >
                Continue
                <ArrowRight
                  className="w-3 h-3 group-hover:translate-x-1 transition-transform"
                  strokeWidth={2.5}
                />
              </div>
            </Link>

            {/* Team Member Card */}
            <Link
              to="/auth/team"
              className="group bg-[#0a0a0a] hover:bg-[#1a1a1a] border-2 border-white/10 hover:border-[#C5F542] p-8 transition-all text-left block"
            >
              <div className="w-14 h-14 mb-4 flex items-center justify-center bg-white">
                <User className="w-7 h-7 text-black" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold mb-2">Team Member</h3>
              <p className="text-sm text-white/60 mb-4">
                Track your daily tasks, request leaves, and view your schedule
              </p>
              <div
                className="flex items-center gap-1 text-xs uppercase tracking-widest font-semibold"
                style={{ color: '#C5F542' }}
              >
                Continue
                <ArrowRight
                  className="w-3 h-3 group-hover:translate-x-1 transition-transform"
                  strokeWidth={2.5}
                />
              </div>
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-white/40">
          Team members can only sign in. New members are invited by the CEO.
        </p>
      </div>
    </div>
  )
}
