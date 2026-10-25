// アプリ全体で共有するデータ（タスク・チーム・メンバー・通知など）
// ---------------------------------------------------------------
// * ログイン中のユーザーが「見てよい」データだけが Supabase の RLS によって返されます
// * リスト・カンバン・カレンダー・ホームはすべてここの tasks 配列を参照するため、
//   どの画面で変更しても他の画面に同じ内容が反映されます
// * 他のメンバーの変更は Supabase Realtime で受け取り、自動で再読み込みします。
//   Realtime は RLS を守って配信するので、見えないタスクの変更は届きません。
//   （Realtime が使えない環境でも、再読み込みボタン・タブ復帰時に最新化されます）
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { errorMessage, supabase } from '../lib/supabase'
import type {
  AppNotification,
  Category,
  Member,
  Profile,
  Project,
  Role,
  Task,
  TaskInput,
  Team,
  TeamMember,
} from '../lib/types'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

interface DataValue {
  loading: boolean
  profile: Profile | null
  team: Team | null
  role: Role | null
  members: Member[]
  projects: Project[]
  categories: Category[]
  tasks: Task[]
  notifications: AppNotification[]
  unreadCount: number
  reload: () => Promise<void>
  createTask: (input: TaskInput) => Promise<Task | null>
  updateTask: (id: string, patch: TaskInput) => Promise<boolean>
  deleteTask: (id: string) => Promise<boolean>
  toggleDone: (task: Task) => Promise<void>
  createCategory: (name: string) => Promise<Category | null>
  refreshNotifications: () => Promise<void>
  markRead: (ids: string[]) => Promise<void>
}

const DataContext = createContext<DataValue | null>(null)

/** 1000 件を超えても取りこぼさないよう、ページ単位で全件取得する */
async function fetchAll<T>(table: string, order = 'created_at'): Promise<T[]> {
  const pageSize = 1000
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(order, { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data as T[]))
    if (!data || data.length < pageSize) return rows
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [rawMembers, setRawMembers] = useState<TeamMember[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  const loadNotifications = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })
    setNotifications((data as AppNotification[]) ?? [])
  }, [])

  /** 期限情報を確認して通知一覧を更新（DB 側で重複しないよう管理） */
  const refreshNotifications = useCallback(async () => {
    const { error } = await supabase.rpc('refresh_notifications')
    await supabase.rpc('cleanup_old_notifications')
    if (error) console.warn(error)
    await loadNotifications()
  }, [loadNotifications])

  const reload = useCallback(async () => {
    if (!userId) return
    try {
      const [teamsRes, membersRes, profilesRes, projectList, categoryList, taskList] = await Promise.all([
        supabase.from('teams').select('*').maybeSingle(),
        supabase.from('team_members').select('*'),
        supabase.from('profiles').select('id, display_name, email'),
        fetchAll<Project>('projects'),
        fetchAll<Category>('categories'),
        fetchAll<Task>('tasks'),
      ])
      if (teamsRes.error) throw teamsRes.error
      if (membersRes.error) throw membersRes.error
      if (profilesRes.error) throw profilesRes.error
      const profileList = (profilesRes.data as Profile[]) ?? []
      setTeam((teamsRes.data as Team) ?? null)
      setRawMembers((membersRes.data as TeamMember[]) ?? [])
      setProfiles(profileList)
      setProfile(profileList.find((p) => p.id === userId) ?? null)
      setProjects(projectList)
      setCategories(categoryList)
      setTasks(taskList)
      await refreshNotifications()
    } catch (e) {
      toast(`データの読み込みに失敗しました: ${errorMessage(e)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, toast, refreshNotifications])

  useEffect(() => {
    setLoading(true)
    reload()
    // 画面に戻ってきたとき（タブ切り替え・スマホでアプリに戻る）に最新化
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    // アプリを開いたままでも期限通知が更新されるよう 5 分ごとに確認
    const timer = setInterval(() => refreshNotifications(), 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [reload, refreshNotifications])

  // リアルタイム同期: 他のメンバーがタスクを変更したら、少し待ってからまとめて取り直す
  const realtimeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (!userId) return
    const refetchTasks = () => {
      clearTimeout(realtimeTimer.current)
      realtimeTimer.current = setTimeout(async () => {
        try {
          setTasks(await fetchAll<Task>('tasks'))
          await loadNotifications()
        } catch {
          /* 通信エラー時は次の更新で取り直す */
        }
      }, 500)
    }
    const channel = supabase
      .channel('app-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refetchTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () =>
        loadNotifications(),
      )
      .subscribe()
    return () => {
      clearTimeout(realtimeTimer.current)
      supabase.removeChannel(channel)
    }
  }, [userId, loadNotifications])

  // 連続して更新したときに通知の再計算をまとめる
  const notifyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const scheduleNotificationRefresh = useCallback(() => {
    clearTimeout(notifyTimer.current)
    notifyTimer.current = setTimeout(() => refreshNotifications(), 800)
  }, [refreshNotifications])

  const members: Member[] = useMemo(
    () =>
      rawMembers
        .map((m) => {
          const p = profiles.find((x) => x.id === m.user_id)
          return { ...m, display_name: p?.display_name || p?.email || '名前未設定', email: p?.email ?? '' }
        })
        .sort((a, b) => (a.role === b.role ? a.display_name.localeCompare(b.display_name, 'ja') : a.role === 'admin' ? -1 : 1)),
    [rawMembers, profiles],
  )
  const role = rawMembers.find((m) => m.user_id === userId)?.role ?? null

  const createTask = useCallback(
    async (input: TaskInput) => {
      const { data, error } = await supabase.from('tasks').insert(input).select().single()
      if (error) {
        toast(errorMessage(error), 'error')
        return null
      }
      setTasks((ts) => [...ts, data as Task])
      scheduleNotificationRefresh()
      return data as Task
    },
    [toast, scheduleNotificationRefresh],
  )

  const updateTask = useCallback(
    async (id: string, patch: TaskInput) => {
      const before = tasks.find((t) => t.id === id)
      // 楽観的更新: 先に画面へ反映し、失敗したら元に戻す
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().maybeSingle()
      if (error || !data) {
        if (before) setTasks((ts) => ts.map((t) => (t.id === id ? before : t)))
        toast(error ? errorMessage(error) : 'このタスクを編集する権限がありません', 'error')
        return false
      }
      const saved = data as Task
      setTasks((ts) => ts.map((t) => (t.id === id ? saved : t)))
      // 繰り返しタスクを完了したら、DB が次回分を作るので取り直す
      if (saved.recurrence !== 'none' && saved.status === 'done' && before?.status !== 'done') {
        const { data: fresh } = await supabase.from('tasks').select('*').eq('recurrence_source_id', saved.recurrence_source_id ?? saved.id)
        if (fresh) {
          setTasks((ts) => {
            const ids = new Set(ts.map((t) => t.id))
            return [...ts.map((t) => (t.id === id ? { ...saved, next_created: true } : t)), ...(fresh as Task[]).filter((t) => !ids.has(t.id))]
          })
        }
        toast('次回の予定を作成しました')
      }
      scheduleNotificationRefresh()
      return true
    },
    [tasks, toast, scheduleNotificationRefresh],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      const { error, count } = await supabase.from('tasks').delete({ count: 'exact' }).eq('id', id)
      if (error || count === 0) {
        toast(error ? errorMessage(error) : 'このタスクを削除する権限がありません', 'error')
        return false
      }
      setTasks((ts) => ts.filter((t) => t.id !== id))
      setNotifications((ns) => ns.filter((n) => n.task_id !== id))
      return true
    },
    [toast],
  )

  const toggleDone = useCallback(
    async (task: Task) => {
      await updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' })
    },
    [updateTask],
  )

  const createCategory = useCallback(
    async (name: string) => {
      const { data, error } = await supabase.from('categories').insert({ name: name.trim() }).select().single()
      if (error) {
        toast(errorMessage(error).includes('duplicate') ? '同じ名前のカテゴリーがあります' : errorMessage(error), 'error')
        return null
      }
      setCategories((cs) => [...cs, data as Category])
      return data as Category
    },
    [toast],
  )

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    setNotifications((ns) => ns.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)))
    await supabase.from('notifications').update({ is_read: true }).in('id', ids)
  }, [])

  const value: DataValue = {
    loading,
    profile,
    team,
    role,
    members,
    projects,
    categories,
    tasks,
    notifications,
    unreadCount: notifications.filter((n) => !n.is_read).length,
    reload,
    createTask,
    updateTask,
    deleteTask,
    toggleDone,
    createCategory,
    refreshNotifications,
    markRead,
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData は DataProvider の中で使ってください')
  return ctx
}
