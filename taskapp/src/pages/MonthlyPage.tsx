// マンスリー管理: 月の目標・達成率・今月期限・対象月だけのタスク・翌月への繰り越し
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CornerDownRight } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { errorMessage, supabase } from '../lib/supabase'
import { TaskList } from '../components/TaskList'
import { ProgressBar } from '../components/Badges'
import { addMonths, formatMonthJP, monthEnd, monthStart, todayJST } from '../lib/date'
import { completionRate, isDone, sortTasks, touchesRange } from '../lib/tasks'

export function MonthlyPage() {
  const { tasks, reload } = useData()
  const { userId } = useAuth()
  const toast = useToast()
  const [month, setMonth] = useState(monthStart(todayJST()))
  const end = monthEnd(month)

  const d = useMemo(() => {
    const mine = tasks.filter((t) => t.scope === 'personal' || t.assignee_id === userId)
    const inMonth = mine.filter((t) => touchesRange(t, month, end))
    return {
      all: inMonth,
      rate: completionRate(inMonth),
      dueThisMonth: sortTasks(inMonth.filter((t) => t.due_date && t.due_date >= month && t.due_date <= end), 'due'),
      monthOnly: sortTasks(inMonth.filter((t) => t.target_month === month && !t.due_date && !t.scheduled_date), 'priority'),
      scheduledOnly: sortTasks(inMonth.filter((t) => !t.due_date && t.scheduled_date), 'due'),
      carryable: mine.filter((t) => t.target_month === month && !isDone(t)).length,
    }
  }, [tasks, userId, month, end])

  async function carryOver() {
    if (!confirm(`${formatMonthJP(month)}が対象月の未完了タスクを${formatMonthJP(addMonths(month, 1))}に繰り越しますか？`)) return
    let total = 0
    for (const scope of ['personal', 'team']) {
      const { data, error } = await supabase.rpc('carry_over_month', { p_month: month, p_scope: scope })
      if (error) return toast(errorMessage(error), 'error')
      total += Number(data ?? 0)
    }
    toast(`${total}件を翌月に繰り越しました`)
    reload()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button className="btn-ghost p-1.5" onClick={() => setMonth(addMonths(month, -1))} aria-label="前の月">
          <ChevronLeft size={18} />
        </button>
        <h2 className="w-32 text-center text-lg font-semibold">{formatMonthJP(month)}</h2>
        <button className="btn-ghost p-1.5" onClick={() => setMonth(addMonths(month, 1))} aria-label="次の月">
          <ChevronRight size={18} />
        </button>
        {month !== monthStart(todayJST()) && (
          <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => setMonth(monthStart(todayJST()))}>
            今月
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <div className="card p-4">
          <p className="text-xs text-gray-500">月間達成率</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{d.rate.rate}%</p>
          <ProgressBar rate={d.rate.rate} className="mt-3" />
          <p className="mt-2 text-xs text-gray-400">
            {d.rate.done} / {d.rate.total} 件完了（個人タスク + 自分担当のチームタスク）
          </p>
        </div>
        <GoalCard month={month} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-3">
          <h3 className="px-2 py-1 text-sm font-semibold">今月が期限のタスク <span className="text-xs font-normal text-gray-400">{d.dueThisMonth.length}</span></h3>
          <TaskList tasks={d.dueThisMonth} showScope compact emptyText="今月が期限のタスクはありません" />
        </section>
        <section className="card p-3">
          <div className="flex items-center justify-between px-2 py-1">
            <h3 className="text-sm font-semibold">
              {formatMonthJP(month)}中に行うタスク（日付未定） <span className="text-xs font-normal text-gray-400">{d.monthOnly.length}</span>
            </h3>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={carryOver} disabled={d.carryable === 0}>
              <CornerDownRight size={14} />
              未完了を翌月へ繰り越し
            </button>
          </div>
          <TaskList tasks={d.monthOnly} showScope compact emptyText="対象月だけを設定したタスクはありません" />
        </section>
        {d.scheduledOnly.length > 0 && (
          <section className="card p-3">
            <h3 className="px-2 py-1 text-sm font-semibold">今月の予定（締切なし） <span className="text-xs font-normal text-gray-400">{d.scheduledOnly.length}</span></h3>
            <TaskList tasks={d.scheduledOnly} showScope compact />
          </section>
        )}
      </div>
    </div>
  )
}

/** 月間目標（個人用・自分だけに表示） */
function GoalCard({ month }: { month: string }) {
  const toast = useToast()
  const [body, setBody] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    supabase
      .from('monthly_goals')
      .select('body')
      .eq('month', month)
      .maybeSingle()
      .then(({ data }) => {
        setBody(data?.body ?? '')
        setSaved(data?.body ?? '')
      })
  }, [month])

  async function save() {
    const { error } = await supabase.from('monthly_goals').upsert({ month, body }, { onConflict: 'owner_id,month' })
    if (error) toast(errorMessage(error), 'error')
    else {
      setSaved(body)
      toast('目標を保存しました')
    }
  }

  return (
    <div className="card flex flex-col p-4">
      <p className="mb-2 text-xs text-gray-500">{formatMonthJP(month)}の目標（自分だけに表示）</p>
      <textarea className="input min-h-20 flex-1" value={body} onChange={(e) => setBody(e.target.value)} placeholder="例：新規顧客を5件獲得する / 毎日30分の勉強" maxLength={1000} />
      <div className="mt-2 flex justify-end">
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={save} disabled={body === saved}>
          保存
        </button>
      </div>
    </div>
  )
}
