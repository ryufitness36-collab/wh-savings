// ホーム（ダッシュボード）: 個人タスク + 自分が担当するチームタスクを統合して表示
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { TaskList } from '../components/TaskList'
import { QuickAdd } from '../components/QuickAdd'
import { ProgressBar } from '../components/Badges'
import { addDays, formatFullDateJP, monthEnd, monthStart, todayJST } from '../lib/date'
import { completionRate, dueState, isDone, sortTasks, touchesRange } from '../lib/tasks'
import type { Task } from '../lib/types'

export function HomePage() {
  const { tasks, profile, team } = useData()
  const { userId } = useAuth()
  const today = todayJST()

  const d = useMemo(() => {
    // 「自分のタスク」= 個人タスク + 自分が担当のチームタスク
    const mine = tasks.filter((t) => t.scope === 'personal' || t.assignee_id === userId)
    const todays = mine.filter((t) => touchesRange(t, today, today))
    const open = mine.filter((t) => !isDone(t))
    const thisMonth = mine.filter((t) => touchesRange(t, monthStart(today), monthEnd(today)))
    return {
      todayPersonal: sortTasks(todays.filter((t) => t.scope === 'personal'), 'due'),
      todayTeam: sortTasks(todays.filter((t) => t.scope === 'team'), 'due'),
      dueToday: sortTasks(open.filter((t) => dueState(t, today) === 'today'), 'due'),
      dueSoon: sortTasks(open.filter((t) => dueState(t, today) === 'soon'), 'due'),
      overdue: sortTasks(open.filter((t) => dueState(t, today) === 'overdue'), 'due'),
      // 前日からの未完了: 予定日が過去で、まだ終わっていないもの
      carried: sortTasks(open.filter((t) => t.scheduled_date !== null && t.scheduled_date < today && dueState(t, today) !== 'overdue'), 'due'),
      todayRate: completionRate(todays),
      monthRate: completionRate(thisMonth),
      todayOpen: todays.filter((t) => !isDone(t)).length,
    }
  }, [tasks, userId, today])

  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', hour12: false }).format(new Date()))
  const greeting = hour < 11 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは'

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-500">{formatFullDateJP(today)}</p>
        <h2 className="mt-0.5 text-2xl font-semibold tracking-tight">
          {greeting}、{profile?.display_name ?? ''}さん
        </h2>
      </section>

      {/* 数値サマリー */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="今日の完了率" value={`${d.todayRate.rate}%`} sub={`${d.todayRate.done} / ${d.todayRate.total} 件完了`} rate={d.todayRate.rate} />
        <Stat label="今月の完了率" value={`${d.monthRate.rate}%`} sub={`${d.monthRate.done} / ${d.monthRate.total} 件完了`} rate={d.monthRate.rate} />
        <Stat label="今日の未完了" value={`${d.todayOpen}件`} sub={`今日期限 ${d.dueToday.length}件`} />
        <Stat label="期限超過" value={`${d.overdue.length}件`} sub={`3日以内 ${d.dueSoon.length}件`} alert={d.overdue.length > 0} />
      </section>

      <section className="card p-4">
        <QuickAdd defaults={{ scope: 'personal', scheduled_date: today }} allowScopeSwitch placeholder="今日やることを追加（Enter）" />
      </section>

      {d.overdue.length > 0 && (
        <Section title="期限超過" count={d.overdue.length} tone="red">
          <TaskList tasks={d.overdue} showScope showAssignee={false} compact />
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="今日の個人タスク" count={d.todayPersonal.length} link="/personal">
          <TaskList tasks={d.todayPersonal} showScope compact emptyText="今日の個人タスクはありません" />
        </Section>
        <Section title="今日のチーム担当タスク" count={d.todayTeam.length} link="/team">
          {team ? (
            <TaskList tasks={d.todayTeam} showScope compact emptyText="今日担当するチームタスクはありません" />
          ) : (
            <p className="px-2 py-6 text-center text-sm text-gray-400">
              まだチームに参加していません。<Link to="/settings" className="text-indigo-600 underline">チーム設定へ</Link>
            </p>
          )}
        </Section>
        <Section title="今日が期限" count={d.dueToday.length} tone="orange">
          <TaskList tasks={d.dueToday} showScope compact emptyText="今日が期限のタスクはありません" />
        </Section>
        <Section title="期限が近いタスク（3日以内）" count={d.dueSoon.length} tone="amber">
          <TaskList tasks={d.dueSoon} showScope compact emptyText="3日以内に期限のタスクはありません" />
        </Section>
        {d.carried.length > 0 && (
          <Section title="前日からの未完了" count={d.carried.length}>
            <TaskList tasks={d.carried} showScope compact />
          </Section>
        )}
        <UpcomingSection tasks={tasks.filter((t) => t.scope === 'personal' || t.assignee_id === userId)} today={today} />
      </div>
    </div>
  )
}

function UpcomingSection({ tasks, today }: { tasks: Task[]; today: string }) {
  const list = sortTasks(
    tasks.filter((t) => !isDone(t) && touchesRange(t, addDays(today, 4), addDays(today, 7))),
    'due',
  )
  if (list.length === 0) return null
  return (
    <Section title="今後 1 週間" count={list.length}>
      <TaskList tasks={list} showScope compact />
    </Section>
  )
}

function Stat({ label, value, sub, rate, alert }: { label: string; value: string; sub: string; rate?: number; alert?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${alert ? 'text-red-600 dark:text-red-400' : ''}`}>{value}</p>
      {rate !== undefined && <ProgressBar rate={rate} className="mt-2" />}
      <p className="mt-1.5 text-xs text-gray-400">{sub}</p>
    </div>
  )
}

function Section({
  title,
  count,
  children,
  link,
  tone,
}: {
  title: string
  count: number
  children: ReactNode
  link?: string
  tone?: 'red' | 'orange' | 'amber'
}) {
  const dot = tone === 'red' ? 'bg-red-500' : tone === 'orange' ? 'bg-orange-500' : tone === 'amber' ? 'bg-amber-400' : 'bg-indigo-500'
  return (
    <section className="card p-3">
      <header className="mb-1 flex items-center gap-2 px-2 py-1">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-gray-400">{count}</span>
        <div className="flex-1" />
        {link && (
          <Link to={link} className="text-xs text-gray-400 hover:text-indigo-600">
            すべて見る →
          </Link>
        )}
      </header>
      {children}
    </section>
  )
}
