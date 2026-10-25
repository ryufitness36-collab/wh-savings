import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DataProvider, useData } from './contexts/DataContext'
import { ToastProvider } from './contexts/ToastContext'
import { TaskEditorProvider } from './components/TaskEditor'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { HomePage } from './pages/HomePage'

// ホーム以外の画面は、開いたときに読み込む（最初の表示を速くするため）
const PersonalPage = lazy(() => import('./pages/PersonalPage').then((m) => ({ default: m.PersonalPage })))
const TeamPage = lazy(() => import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })))
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const MonthlyPage = lazy(() => import('./pages/MonthlyPage').then((m) => ({ default: m.MonthlyPage })))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const JoinPage = lazy(() => import('./pages/JoinPage').then((m) => ({ default: m.JoinPage })))

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
  const { session, loading, recovery, finishRecovery } = useAuth()
  const location = useLocation()

  if (loading) return <Splash />
  // パスワード再設定メールのリンクから来たときは、まず新しいパスワードを設定してもらう
  if (session && recovery) return <ResetPasswordPage onDone={finishRecovery} />
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
        <Route path="reports" element={<ReportsPage />} />
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
