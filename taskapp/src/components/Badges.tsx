// タスクに付ける小さなラベル類
import { Clock, Repeat, User, Users } from 'lucide-react'
import type { Member, Priority, Status, Task } from '../lib/types'
import { PRIORITY_LABEL, STATUS_LABEL, dueState } from '../lib/tasks'
import { formatMonthJP, relativeDateJP, shortTime } from '../lib/date'

export function ScopeBadge({ scope }: { scope: Task['scope'] }) {
  return scope === 'personal' ? (
    <span className="chip bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
      <User size={11} />
      個人
    </span>
  ) : (
    <span className="chip bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
      <Users size={11} />
      チーム
    </span>
  )
}

const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
}

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null
  return <span className={`chip ${PRIORITY_STYLE[priority]}`}>優先度 {PRIORITY_LABEL[priority]}</span>
}

const STATUS_STYLE: Record<Status, string> = {
  todo: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  in_progress: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  review: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}

export const STATUS_DOT: Record<Status, string> = {
  todo: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  review: 'bg-amber-500',
  done: 'bg-emerald-500',
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`chip ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
}

/** 締切日の表示（期限超過は赤、今日はオレンジ、3日以内は黄色） */
export function DueLabel({ task }: { task: Task }) {
  const state = dueState(task)
  if (!task.due_date) {
    if (task.target_month) {
      return <span className="chip bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{formatMonthJP(task.target_month)}中</span>
    }
    return null
  }
  const style =
    state === 'overdue'
      ? 'text-red-600 dark:text-red-400'
      : state === 'today'
        ? 'text-orange-600 dark:text-orange-400'
        : state === 'soon'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-gray-500 dark:text-gray-400'
  return (
    <span className={`inline-flex items-center gap-1 text-xs whitespace-nowrap ${style}`}>
      <Clock size={12} />
      {relativeDateJP(task.due_date)}
      {task.due_time && ` ${shortTime(task.due_time)}`}
      {state === 'overdue' && '（超過）'}
    </span>
  )
}

export function RecurrenceIcon({ task }: { task: Task }) {
  if (task.recurrence === 'none') return null
  return <Repeat size={12} className="text-gray-400" aria-label="繰り返し" />
}

export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  // 名前から色を決める（同じ人は常に同じ色）
  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500', 'bg-violet-500', 'bg-teal-500']
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colors[h % colors.length]}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      title={name}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function AssigneeLabel({ members, id }: { members: Member[]; id: string | null }) {
  if (!id) return <span className="text-xs text-gray-400">未割り当て</span>
  const m = members.find((x) => x.user_id === id)
  const name = m?.display_name ?? '退出したメンバー'
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
      <Avatar name={name} size={18} />
      <span className="truncate">{name}</span>
    </span>
  )
}

export function ProgressBar({ rate, className = '' }: { rate: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10 ${className}`}>
      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${rate}%` }} />
    </div>
  )
}
