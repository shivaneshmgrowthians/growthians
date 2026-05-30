import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotifProvider } from './contexts/NotifContext'
import { ToastProvider } from './contexts/ToastContext'
import { Loader } from './components/ui'
import Layout from './components/Layout'

// Auth pages
import AuthRoleSelector from './pages/AuthRoleSelector'
import AuthCEO from './pages/AuthCEO'
import AuthEmployee from './pages/AuthEmployee'
import AuthSetPassword from './pages/AuthSetPassword'

// Employee pages
import EmployeeTodaySheet from './pages/EmployeeTodaySheet'
import EmployeeLists from './pages/EmployeeLists'
import EmployeeLeave from './pages/EmployeeLeave'
import EmployeeLogoff from './pages/EmployeeLogoff'
import EmployeeHistory from './pages/EmployeeHistory'

// Shared pages
import CalendarPage from './pages/CalendarPage'
import Profile from './pages/Profile'

// CEO pages
import CEODashboard from './pages/CEODashboard'
import CEOApprovals from './pages/CEOApprovals'
import CEOTeam from './pages/CEOTeam'
import CEOMemberView from './pages/CEOMemberView'

function ProtectedRoutes() {
  const { profile, loading } = useAuth()

  if (loading) return <Loader label="Loading session" />
  if (!profile) return <Navigate to="/auth" replace />

  const isCEO = profile.role === 'ceo'

  return (
    <Layout>
      <Routes>
        <Route path="/" element={isCEO ? <CEODashboard /> : <EmployeeTodaySheet />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/profile" element={<Profile />} />

        {isCEO && (
          <>
            <Route path="/sheet" element={<EmployeeTodaySheet />} />
            <Route path="/approvals" element={<CEOApprovals />} />
            <Route path="/team" element={<CEOTeam />} />
            <Route path="/team/:userId" element={<CEOMemberView />} />
          </>
        )}

        {!isCEO && (
          <>
            <Route path="/lists" element={<EmployeeLists />} />
            <Route path="/leave" element={<EmployeeLeave />} />
            <Route path="/logoff" element={<EmployeeLogoff />} />
            <Route path="/history" element={<EmployeeHistory />} />
          </>
        )}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

function AuthRoutes() {
  const { profile, loading } = useAuth()

  if (loading) return <Loader label="Loading" />
  if (profile) return <Navigate to="/" replace />

  return (
    <Routes>
      <Route path="/auth" element={<AuthRoleSelector />} />
      <Route path="/auth/ceo" element={<AuthCEO />} />
      <Route path="/auth/team" element={<AuthEmployee />} />
      <Route path="/auth/set-password" element={<AuthSetPassword />} />
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  )
}

function AppRouter() {
  const { profile, loading } = useAuth()
  const path = window.location.pathname
  const hash = window.location.hash

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader label="Starting Axis" />
      </div>
    )
  }

  if (hash && hash.includes('type=invite')) {
    window.history.replaceState(null, '', '/auth/set-password' + hash)
    return (
      <Routes>
        <Route path="*" element={<AuthSetPassword />} />
      </Routes>
    )
  }

  if (path === '/auth/set-password') {
    return (
      <Routes>
        <Route path="/auth/set-password" element={<AuthSetPassword />} />
      </Routes>
    )
  }

  return profile ? <ProtectedRoutes /> : <AuthRoutes />
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <NotifProvider>
          <AppRouter />
        </NotifProvider>
      </AuthProvider>
    </ToastProvider>
  )
}