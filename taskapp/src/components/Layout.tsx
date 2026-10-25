// 画面の枠組み: PC = 左サイドバー + 上部ヘッダー / スマホ = 上部ヘッダー + 下部ナビゲーション
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  FolderKanban,
  Home,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Settings,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useTheme } from '../lib/theme'
import { useTaskEditor } from './TaskEditor'
import { Avatar } from './Badges'
import { NotificationList } from '../pages/NotificationsPage'
import type { TaskInput } from '../lib/types'

const NAV = [
  { to: '/', label: 'ホーム', icon: Home },
  { to: '/personal', label: '個人タスク', icon: User },
  { to: '/team', label: 'チームタスク', icon: Users },
  { to: '/calendar', label: 'カレンダー', icon: CalendarDays },
  { to: '/monthly', label: 'マンスリー', icon: CalendarRange },
  { to: '/projects', label: 'プロジェクト', icon: FolderKanban },
  { to: '/settings', label: 'チーム・設定', icon: Settings },
]

const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[3]]

export function Layout() {
  const { profile, team, unreadCount, reload } = useData()
  const { theme, setTheme, isDark } = useTheme()
  const openEditor = useTaskEditor()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
    setBellOpen(false)
  }, [location.pathname])

  // 今いる画面に合わせて新規タスクの区分を決める
  const addDefaults: TaskInput = location.pathname.startsWith('/team') && team ? { scope: 'team' } : { scope: 'personal' }
  const title = NAV.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)))?.label ?? ''

  async function onRefresh() {
    setRefreshing(true)
    await reload()
    setRefreshing(false)
  }

  return (
    <div className="flex min-h-dvh">
      {/* PC: サイドバー */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-gray-100 bg-gray-50/60 px-3 py-4 md:flex dark:border-white/5 dark:bg-white/[0.02]">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <CheckSquare size={16} />
          </span>
          <span className="font-semibold">Tasks</span>
          {team && <span className="truncate text-xs text-gray-400">/ {team.name}</span>}
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <SideLink key={n.to} {...n} />
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 px-2 pt-4">
          <Avatar name={profile?.display_name || '?'} size={26} />
          <span className="min-w-0 flex-1 truncate text-sm">{profile?.display_name}</span>
          <button
            className="btn-ghost p-1.5"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label="ライト/ダーク切り替え"
            title={theme === 'system' ? '端末の設定に従っています' : ''}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ヘッダー */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-gray-100 bg-white/85 px-4 backdrop-blur md:px-8 dark:border-white/5 dark:bg-[#111113]/85">
          <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>
          <button className="btn-ghost p-2" onClick={onRefresh} aria-label="最新の情報に更新" title="最新の情報に更新">
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <BellButton count={unreadCount} open={bellOpen} setOpen={setBellOpen} />
          <button className="btn-primary hidden md:inline-flex" onClick={() => openEditor(null, addDefaults)}>
            <Plus size={16} />
            タスクを追加
          </button>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* スマホ: タスク追加ボタン（ワンタップ） */}
      <button
        className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 active:scale-95 md:hidden"
        onClick={() => openEditor(null, addDefaults)}
        aria-label="タスクを追加"
      >
        <Plus size={26} />
      </button>

      {/* スマホ: 下部ナビゲーション */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur md:hidden dark:border-white/5 dark:bg-[#111113]/95">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-0.5 text-[10px] ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`
              }
            >
              <n.icon size={21} />
              {n.label.replace('タスク', '')}
            </NavLink>
          ))}
          <button className="flex h-16 flex-col items-center justify-center gap-0.5 text-[10px] text-gray-500" onClick={() => setMenuOpen(true)}>
            <Menu size={21} />
            メニュー
          </button>
        </div>
      </nav>

      {/* スマホ: メニュー（下から表示） */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="pb-safe absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 dark:bg-[#1a1a1d]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">メニュー</span>
              <button className="btn-ghost p-1.5" onClick={() => setMenuOpen(false)} aria-label="閉じる">
                <X size={18} />
              </button>
            </div>
            <nav className="grid gap-1">
              {NAV.map((n) => (
                <SideLink key={n.to} {...n} large />
              ))}
              <button className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
                {isDark ? 'ライトモードにする' : 'ダークモードにする'}
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}

function SideLink({ to, label, icon: Icon, large }: { to: string; label: string; icon: typeof Home; large?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 ${large ? 'py-3' : 'py-2'} text-sm transition-colors ${
          isActive
            ? 'bg-white font-medium text-gray-900 shadow-sm dark:bg-white/10 dark:text-white'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
        }`
      }
    >
      <Icon size={17} />
      {label}
    </NavLink>
  )
}

function BellButton({ count, open, setOpen }: { count: number; open: boolean; setOpen: (v: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open, setOpen])

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative p-2" onClick={() => setOpen(!open)} aria-label={`通知 ${count}件`}>
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-14 z-50 max-h-[70dvh] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96 dark:border-white/10 dark:bg-[#1a1a1d]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-white/10">
            <span className="text-sm font-semibold">通知</span>
            <button className="text-xs text-indigo-600 dark:text-indigo-400" onClick={() => navigate('/notifications')}>
              すべて表示
            </button>
          </div>
          <div className="max-h-[calc(70dvh-44px)] overflow-y-auto">
            <NotificationList limit={8} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
