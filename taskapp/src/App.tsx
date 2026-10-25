import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DataProvider, useData } from './contexts/DataContext'
import { ToastProvider } from './contexts/ToastContext'
import { TaskEditorProvider } from './components/TaskEditor'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { PersonalPage } from './pages/PersonalPage'
import { TeamPage } from './pages/TeamPage'
import { CalendarPage } from './pages/CalendarPage'
import { MonthlyPage } from './pages/MonthlyPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { SettingsPage } from './pages/SettingsPage'
import { JoinPage } from './pages/JoinPage'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}

/** ログインしていなければログイン画面を表示 */
function Gate() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Splash />
  if (!session) {
    // 招待リンクから来た場合は、ログイン後に戻れるよう URL を覚えておく
    if (location.pathname.startsWith('/join/')) sessionStorage.setItem('afterLogin', location.pathname)
    return <LoginPage />
  }
  return (
    <DataProvider key={session.user.id}>
      <TaskEditorProvider>
        <AppRoutes />
      </TaskEditorProvider>
    </DataProvider>
  )
}

function AppRoutes() {
  const { loading } = useData()
  if (loading) return <Splash />

  const after = sessionStorage.getItem('afterLogin')
  if (after) {
    sessionStorage.removeItem('afterLogin')
    return <Navigate to={after} replace />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="personal" element={<PersonalPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="monthly" element={<MonthlyPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="join/:token" element={<JoinPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  )
}
