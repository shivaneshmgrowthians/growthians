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
        {/* Home route differs by role */}
        <Route path="/" element={isCEO ? <CEODashboard /> : <EmployeeTodaySheet />} />

        {/* Shared routes */}
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/profile" element={<Profile />} />

        {/* CEO-only routes */}
        {isCEO && (
          <>
            <Route path="/approvals" element={<CEOApprovals />} />
            <Route path="/team" element={<CEOTeam />} />
            <Route path="/team/:userId" element={<CEOMemberView />} />
          </>
        )}

        {/* Employee-only routes */}
        {!isCEO && (
          <>
            <Route path="/lists" element={<EmployeeLists />} />
            <Route path="/leave" element={<EmployeeLeave />} />
            <Route path="/logoff" element={<EmployeeLogoff />} />
            <Route path="/history" element={<EmployeeHistory />} />
          </>
        )}

        {/* Catch-all redirects to home */}
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
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  )
}

function AppRouter() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader label="Starting Axis" />
      </div>
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
