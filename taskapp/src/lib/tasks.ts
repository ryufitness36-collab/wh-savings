// タスクに関する表示・判定・絞り込みのロジック
// （画面コンポーネントから切り離しておくと、テストや修正がしやすくなります）
import type { Member, Priority, Recurrence, Role, Status, Task } from './types'
import { addDays, monthEnd, monthStart, nowTimeJST, todayJST, weekEnd, weekStart } from './date'

export const STATUSES: Status[] = ['todo', 'in_progress', 'review', 'done']

export const STATUS_LABEL: Record<Status, string> = {
  todo: '未着手',
  in_progress: '進行中',
  review: '確認待ち',
  done: '完了',
}

export const PRIORITY_LABEL: Record<Priority, string> = { high: '高', medium: '中', low: '低' }

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: '繰り返しなし',
  daily: '毎日',
  weekly: '毎週',
  monthly: '毎月',
  weekdays: '曜日指定',
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

// ---------------------------------------------------------------
// 期限の状態
// ---------------------------------------------------------------
export type DueState = 'none' | 'overdue' | 'today' | 'soon' | 'later'

/** 期限の状態を日本時間で判定。日付のみの期限はその日の終わりまで有効 */
export function dueState(t: Task, today = todayJST(), now = nowTimeJST()): DueState {
  if (!t.due_date) return 'none'
  if (t.status === 'done') return 'later'
  if (t.due_date < today) return 'overdue'
  if (t.due_date === today) {
    if (t.due_time && t.due_time.slice(0, 5) < now) return 'overdue'
    return 'today'
  }
  if (t.due_date <= addDays(today, 3)) return 'soon'
  return 'later'
}

export const isDone = (t: Task) => t.status === 'done'

/** カレンダーなどで使う「代表日」: 締切日 → 予定日 */
export function primaryDate(t: Task): string | null {
  return t.due_date ?? t.scheduled_date
}

// ---------------------------------------------------------------
// 期間フィルター
// ---------------------------------------------------------------
export type Period = 'today' | 'week' | 'month' | 'all' | 'overdue' | 'done'

export const PERIOD_LABEL: Record<Period, string> = {
  today: '今日',
  week: '今週',
  month: '今月',
  all: 'すべて',
  overdue: '期限超過',
  done: '完了済み',
}

function inRange(d: string | null, from: string, to: string) {
  return d !== null && d >= from && d <= to
}

/** タスクが期間 [from, to] に関係するか（予定日・締切日・対象月のいずれか） */
export function touchesRange(t: Task, from: string, to: string): boolean {
  if (inRange(t.scheduled_date, from, to) || inRange(t.due_date, from, to)) return true
  // 対象月のみのタスク: 対象月が期間と重なれば含める
  if (t.target_month && !t.scheduled_date && !t.due_date) {
    return t.target_month <= to && monthEnd(t.target_month) >= from
  }
  return false
}

export function filterByPeriod(tasks: Task[], period: Period, today = todayJST()): Task[] {
  switch (period) {
    case 'today':
      // 今日の予定・今日期限 + 前日からの未完了（予定日が過去で未完了）
      return tasks.filter(
        (t) =>
          touchesRange(t, today, today) ||
          (!isDone(t) && t.scheduled_date !== null && t.scheduled_date < today),
      )
    case 'week':
      return tasks.filter((t) => touchesRange(t, weekStart(today), weekEnd(today)))
    case 'month':
      return tasks.filter((t) => touchesRange(t, monthStart(today), monthEnd(today)))
    case 'overdue':
      return tasks.filter((t) => dueState(t, today) === 'overdue')
    case 'done':
      return tasks.filter(isDone)
    case 'all':
    default:
      return tasks
  }
}

// ---------------------------------------------------------------
// 並べ替え
// ---------------------------------------------------------------
export type SortKey = 'due' | 'priority' | 'created'

export const SORT_LABEL: Record<SortKey, string> = {
  due: '期限順',
  priority: '優先度順',
  created: '作成日順',
}

function dueKey(t: Task) {
  // 期限なしは最後に。時刻なしはその日の最後扱い
  return t.due_date ? `${t.due_date} ${t.due_time ?? '99'}` : t.target_month ? `${monthEnd(t.target_month)} 99` : '9999'
}

export function sortTasks(tasks: Task[], key: SortKey): Task[] {
  const arr = [...tasks]
  arr.sort((a, b) => {
    // 完了済みは常に下へ
    if (isDone(a) !== isDone(b)) return isDone(a) ? 1 : -1
    if (key === 'due') {
      return dueKey(a).localeCompare(dueKey(b)) || prio(a) - prio(b)
    }
    if (key === 'priority') {
      return prio(a) - prio(b) || dueKey(a).localeCompare(dueKey(b))
    }
    return b.created_at.localeCompare(a.created_at)
  })
  return arr
}

const prio = (t: Task) => (t.priority ? PRIORITY_RANK[t.priority] : 3)

// ---------------------------------------------------------------
// 検索・絞り込み
// ---------------------------------------------------------------
export interface TaskFilter {
  query: string
  priority: Priority | ''
  status: Status | ''
  assigneeId: string // '' = 全員, 'none' = 未割り当て
  projectId: string // '' = すべて, 'none' = プロジェクトなし
  categoryId: string
}

export const emptyFilter: TaskFilter = {
  query: '',
  priority: '',
  status: '',
  assigneeId: '',
  projectId: '',
  categoryId: '',
}

export function applyFilter(tasks: Task[], f: TaskFilter): Task[] {
  const q = f.query.trim().toLowerCase()
  return tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false
    if (f.priority && t.priority !== f.priority) return false
    if (f.status && t.status !== f.status) return false
    if (f.assigneeId === 'none' ? t.assignee_id !== null : f.assigneeId && t.assignee_id !== f.assigneeId) return false
    if (f.projectId === 'none' ? t.project_id !== null : f.projectId && t.project_id !== f.projectId) return false
    if (f.categoryId === 'none' ? t.category_id !== null : f.categoryId && t.category_id !== f.categoryId) return false
    return true
  })
}

// ---------------------------------------------------------------
// 集計
// ---------------------------------------------------------------
export function completionRate(tasks: Task[]): { done: number; total: number; rate: number } {
  const total = tasks.length
  const done = tasks.filter(isDone).length
  return { done, total, rate: total === 0 ? 0 : Math.round((done / total) * 100) }
}

// ---------------------------------------------------------------
// 権限（DB 側の RLS / トリガーと同じルールを画面にも反映して、操作できない項目を無効化する）
// ※ 本当の制限は DB 側で行っているので、ここはあくまで「見た目」のためです
// ---------------------------------------------------------------
export interface TaskPermission {
  canEditFields: boolean // タイトル・期限などの編集
  canChangeStatus: boolean
  canDelete: boolean
  /** 担当者として選べるユーザー（null = 選択不可） */
  assignableIds: string[] | 'all'
}

export function taskPermission(t: Task | null, userId: string, role: Role | null): TaskPermission {
  // 新規作成
  if (!t) {
    return {
      canEditFields: true,
      canChangeStatus: true,
      canDelete: false,
      assignableIds: role === 'admin' ? 'all' : [userId],
    }
  }
  if (t.scope === 'personal') {
    const own = t.created_by === userId
    return { canEditFields: own, canChangeStatus: own, canDelete: own, assignableIds: [userId] }
  }
  const isAdmin = role === 'admin'
  const isCreator = t.created_by === userId
  const isAssignee = t.assignee_id === userId
  // 一般メンバーは「未割り当て ⇔ 自分」の切り替えのみ可能
  const canTakeSelf = (isCreator || isAssignee) && (t.assignee_id === null || isAssignee)
  return {
    canEditFields: isAdmin || isCreator,
    canChangeStatus: isAdmin || isCreator || isAssignee,
    canDelete: isAdmin || isCreator,
    assignableIds: isAdmin ? 'all' : canTakeSelf ? [userId] : [],
  }
}

export function memberName(members: Member[], id: string | null): string {
  if (!id) return '未割り当て'
  return members.find((m) => m.user_id === id)?.display_name ?? '（退出したメンバー）'
}
