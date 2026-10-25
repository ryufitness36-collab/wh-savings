// カレンダー: 月間 / 週間表示。日付をクリックするとその日のタスクを確認・追加できます
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { useTaskEditor } from '../components/TaskEditor'
import { TaskList } from '../components/TaskList'
import { addDays, addMonths, formatDateJP, formatMonthJP, monthEnd, monthStart, todayJST, weekStart, weekday } from '../lib/date'
import { primaryDate, sortTasks } from '../lib/tasks'
import type { Task } from '../lib/types'

type Mode = 'month' | 'week'
type ScopeFilter = 'mine' | 'personal' | 'team'

const HEAD = ['月', '火', '水', '木', '金', '土', '日']

export function CalendarPage() {
  const { tasks, team } = useData()
  const { userId } = useAuth()
  const openEditor = useTaskEditor()
  const today = todayJST()
  const [mode, setMode] = useState<Mode>('month')
  const [cursor, setCursor] = useState(today)
  const [selected, setSelected] = useState(today)
  const [scope, setScope] = useState<ScopeFilter>('mine')
  const [showDone, setShowDone] = useState(true)

  const visible = useMemo(
    () =>
      tasks.filter((t) => {
        if (!showDone && t.status === 'done') return false
        if (scope === 'personal') return t.scope === 'personal'
        if (scope === 'team') return t.scope === 'team'
        return t.scope === 'personal' || t.assignee_id === userId
      }),
    [tasks, scope, showDone, userId],
  )

  // 日付ごとにタスクをまとめる（締切日、なければ予定日に表示）
  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of visible) {
      const d = primaryDate(t)
      if (!d) continue
      map.set(d, [...(map.get(d) ?? []), t])
    }
    return map
  }, [visible])

  const days = useMemo(() => {
    if (mode === 'week') return Array.from({ length: 7 }, (_, i) => addDays(weekStart(cursor), i))
    const start = weekStart(monthStart(cursor))
    const end = addDays(weekStart(monthEnd(cursor)), 6)
    const list: string[] = []
    for (let d = start; d <= end; d = addDays(d, 1)) list.push(d)
    return list
  }, [mode, cursor])

  const move = (n: number) => setCursor(mode === 'month' ? addMonths(cursor, n) : addDays(cursor, n * 7))
  const selectedTasks = sortTasks(byDate.get(selected) ?? [], 'due')

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center">
            <button className="btn-ghost p-1.5" onClick={() => move(-1)} aria-label="前へ">
              <ChevronLeft size={18} />
            </button>
            <h2 className="w-36 text-center text-base font-semibold">
              {mode === 'month' ? formatMonthJP(cursor) : `${formatDateJP(weekStart(cursor), false)}〜`}
            </h2>
            <button className="btn-ghost p-1.5" onClick={() => move(1)} aria-label="次へ">
              <ChevronRight size={18} />
            </button>
          </div>
          <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => { setCursor(today); setSelected(today) }}>
            今日
          </button>
          <div className="flex-1" />
          <div className="seg">
            <button aria-pressed={mode === 'month'} onClick={() => setMode('month')}>月</button>
            <button aria-pressed={mode === 'week'} onClick={() => setMode('week')}>週</button>
          </div>
          <div className="seg">
            <button aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>自分</button>
            <button aria-pressed={scope === 'personal'} onClick={() => setScope('personal')}>個人</button>
            {team && <button aria-pressed={scope === 'team'} onClick={() => setScope('team')}>チーム全体</button>}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            完了を表示
          </label>
        </div>

        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100 text-center text-[11px] text-gray-500 dark:border-white/5">
            {HEAD.map((h, i) => (
              <div key={h} className={`py-2 ${i === 5 ? 'text-sky-600' : i === 6 ? 'text-red-500' : ''}`}>{h}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const list = byDate.get(d) ?? []
              const outside = mode === 'month' && d.slice(0, 7) !== cursor.slice(0, 7)
              const isToday = d === today
              const isSel = d === selected
              const max = mode === 'week' ? 8 : 3
              return (
                <button
                  key={d}
                  onClick={() => setSelected(d)}
                  onDoubleClick={() => openEditor(null, { due_date: d })}
                  className={`flex flex-col items-stretch border-r border-b border-gray-100 p-1 text-left align-top transition-colors last:border-r-0 dark:border-white/5 ${
                    mode === 'week' ? 'min-h-56' : 'min-h-[68px] md:min-h-24'
                  } ${isSel ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'} ${outside ? 'opacity-40' : ''}`}
                >
                  <span
                    className={`mb-0.5 flex h-6 w-6 items-center justify-center self-start rounded-full text-xs ${
                      isToday ? 'bg-indigo-600 font-semibold text-white' : weekday(d) === 0 ? 'text-red-500' : weekday(d) === 6 ? 'text-sky-600' : ''
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {/* スマホではドット、PC ではタスク名を表示 */}
                  <div className="flex flex-wrap gap-0.5 md:hidden">
                    {list.slice(0, 4).map((t) => (
                      <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${dotColor(t)}`} />
                    ))}
                  </div>
                  <div className="hidden flex-col gap-0.5 md:flex">
                    {list.slice(0, max).map((t) => (
                      <span
                        key={t.id}
                        className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${chipColor(t)} ${t.status === 'done' ? 'line-through opacity-60' : ''}`}
                      >
                        {t.title}
                      </span>
                    ))}
                    {list.length > max && <span className="px-1 text-[10px] text-gray-400">ほか {list.length - max} 件</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          締切日（未設定の場合は予定日）に表示されます。<span className="text-sky-600">■</span> 個人 <span className="text-violet-600">■</span> チーム
        </p>
      </div>

      <aside className="card h-fit p-3 lg:sticky lg:top-20">
        <div className="mb-1 flex items-center justify-between px-2 py-1">
          <h3 className="text-sm font-semibold">{formatDateJP(selected)}のタスク</h3>
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => openEditor(null, { due_date: selected, scope: scope === 'team' ? 'team' : 'personal' })}>
            <Plus size={14} />
            この日に追加
          </button>
        </div>
        <TaskList tasks={selectedTasks} showScope showAssignee={scope === 'team'} compact emptyText="この日のタスクはありません" />
      </aside>
    </div>
  )
}

function dotColor(t: Task) {
  if (t.status === 'done') return 'bg-gray-300'
  return t.scope === 'personal' ? 'bg-sky-500' : 'bg-violet-500'
}

function chipColor(t: Task) {
  return t.scope === 'personal'
    ? 'bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200'
    : 'bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200'
}
