// 通知センター（アプリ内のみ）
import { AlarmClock, AlertTriangle, CalendarClock, UserPlus } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useTaskEditor } from '../components/TaskEditor'
import { ScopeBadge, DueLabel } from '../components/Badges'
import type { AppNotification, NotificationKind } from '../lib/types'
import { formatDateTimeJP } from '../lib/date'

const KIND: Record<NotificationKind, { label: string; icon: typeof AlarmClock; style: string }> = {
  overdue: { label: '期限を過ぎています', icon: AlertTriangle, style: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
  due_today: { label: '今日が期限です', icon: AlarmClock, style: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10' },
  due_soon: { label: '期限が3日以内です', icon: CalendarClock, style: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
  assigned: { label: 'あなたに割り当てられました', icon: UserPlus, style: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' },
}

const ORDER: NotificationKind[] = ['overdue', 'due_today', 'due_soon', 'assigned']

export function NotificationList({ limit, onNavigate }: { limit?: number; onNavigate?: () => void }) {
  const { notifications, tasks, markRead } = useData()
  const openEditor = useTaskEditor()

  // 未読を上に、重要度（期限超過 → 今日 → 3日以内 → 割り当て）の順で並べる
  const items = notifications
    .map((n) => ({ n, task: tasks.find((t) => t.id === n.task_id) }))
    .filter((x) => x.task)
    .sort(
      (a, b) =>
        Number(a.n.is_read) - Number(b.n.is_read) ||
        ORDER.indexOf(a.n.kind) - ORDER.indexOf(b.n.kind) ||
        b.n.created_at.localeCompare(a.n.created_at),
    )
    .slice(0, limit)

  if (items.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-gray-400">新しい通知はありません</p>
  }

  const open = (n: AppNotification) => {
    const task = tasks.find((t) => t.id === n.task_id)
    if (!n.is_read) markRead([n.id])
    onNavigate?.()
    if (task) openEditor(task)
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-white/5">
      {items.map(({ n, task }) => {
        const k = KIND[n.kind]
        return (
          <li key={n.id}>
            <button className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03]" onClick={() => open(n)}>
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${k.style}`}>
                <k.icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${n.is_read ? 'text-gray-500' : 'font-medium'}`}>{task!.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {k.label}
                  <ScopeBadge scope={task!.scope} />
                  <DueLabel task={task!} />
                </span>
                <span className="mt-0.5 block text-[11px] text-gray-400">{formatDateTimeJP(n.created_at)}</span>
              </span>
              {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-label="未読" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function NotificationsPage() {
  const { notifications, markRead } = useData()
  const unread = notifications.filter((n) => !n.is_read).map((n) => n.id)
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">期限が近いタスク・期限超過・割り当てられたタスクをお知らせします。</p>
        <button className="btn-secondary shrink-0" disabled={unread.length === 0} onClick={() => markRead(unread)}>
          すべて既読にする
        </button>
      </div>
      <div className="card overflow-hidden">
        <NotificationList />
      </div>
    </div>
  )
}
