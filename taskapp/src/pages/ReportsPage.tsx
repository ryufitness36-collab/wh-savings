// 進捗レポート: 完了数の推移・ステータス内訳・担当者別/プロジェクト別の進捗率
// グラフは外部ライブラリを使わず、HTML と CSS だけで描いています（軽く・保守しやすくするため）
import { useMemo, useState } from 'react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { Avatar, ProgressBar, STATUS_DOT } from '../components/Badges'
import { addDays, formatDateJP, toDateJST, todayJST } from '../lib/date'
import { STATUSES, STATUS_LABEL, completionRate, dueState } from '../lib/tasks'
import type { Task } from '../lib/types'

type Scope = 'mine' | 'team'
const RANGE = 14

export function ReportsPage() {
  const { tasks, team, members, projects } = useData()
  const { userId } = useAuth()
  const [scope, setScope] = useState<Scope>(team ? 'team' : 'mine')
  const today = todayJST()

  const target = useMemo(
    () => (scope === 'team' ? tasks.filter((t) => t.scope === 'team') : tasks.filter((t) => t.scope === 'personal' || t.assignee_id === userId)),
    [tasks, scope, userId],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="seg" role="group" aria-label="対象">
          <button aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>自分のタスク</button>
          {team && <button aria-pressed={scope === 'team'} onClick={() => setScope('team')}>チーム全体</button>}
        </div>
        <p className="text-xs text-gray-500">
          {scope === 'mine' ? '個人タスク + 自分が担当のチームタスク' : 'チームのすべてのタスク（個人タスクは含みません）'}
        </p>
      </div>

      <Summary tasks={target} today={today} />
      <TrendChart tasks={target} today={today} />
      <StatusBreakdown tasks={target} />

      {scope === 'team' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ProgressTable
            title="担当者別の進捗率"
            rows={[
              ...members.map((m) => ({ key: m.user_id, label: m.display_name, avatar: true, tasks: target.filter((t) => t.assignee_id === m.user_id) })),
              { key: 'none', label: '未割り当て', avatar: false, tasks: target.filter((t) => !t.assignee_id) },
            ]}
            today={today}
          />
          <ProgressTable
            title="プロジェクト別の進捗率"
            rows={[
              ...projects.filter((p) => !p.archived).map((p) => ({ key: p.id, label: p.name, avatar: false, tasks: target.filter((t) => t.project_id === p.id) })),
              { key: 'none', label: 'プロジェクトなし', avatar: false, tasks: target.filter((t) => !t.project_id) },
            ]}
            today={today}
          />
        </div>
      )}
    </div>
  )
}

function Summary({ tasks, today }: { tasks: Task[]; today: string }) {
  const r = completionRate(tasks)
  const open = tasks.filter((t) => t.status !== 'done')
  const overdue = open.filter((t) => dueState(t, today) === 'overdue').length
  const doneWeek = tasks.filter((t) => t.completed_at && toDateJST(t.completed_at) > addDays(today, -7)).length
  const items = [
    { label: '全体の完了率', value: `${r.rate}%`, sub: `${r.done} / ${r.total} 件` },
    { label: '未完了', value: `${open.length}件`, sub: `うち進行中 ${open.filter((t) => t.status === 'in_progress').length}件` },
    { label: '直近7日の完了', value: `${doneWeek}件`, sub: '完了日時で集計' },
    { label: '期限超過', value: `${overdue}件`, sub: '未完了のうち', alert: overdue > 0 },
  ]
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="card p-4">
          <p className="text-xs text-gray-500">{i.label}</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${i.alert ? 'text-red-600 dark:text-red-400' : ''}`}>{i.value}</p>
          <p className="mt-1 text-xs text-gray-400">{i.sub}</p>
        </div>
      ))}
    </section>
  )
}

/** 直近 14 日間に完了したタスク数（1 系列の棒グラフ） */
function TrendChart({ tasks, today }: { tasks: Task[]; today: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)

  const days = useMemo(() => {
    const list = Array.from({ length: RANGE }, (_, i) => ({ date: addDays(today, i - RANGE + 1), count: 0 }))
    const index = new Map(list.map((d, i) => [d.date, i]))
    for (const t of tasks) {
      if (!t.completed_at) continue
      const i = index.get(toDateJST(t.completed_at))
      if (i !== undefined) list[i].count++
    }
    return list
  }, [tasks, today])

  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((a, d) => a + d.count, 0)
  // 目盛りはきりのよい数に
  const top = max <= 4 ? max : Math.ceil(max / 5) * 5

  return (
    <section className="card p-4">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">完了したタスク数（直近{RANGE}日）</h2>
          <p className="mt-0.5 text-xs text-gray-500">合計 {total} 件 ・ 1日平均 {(total / RANGE).toFixed(1)} 件</p>
        </div>
        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setAsTable(!asTable)}>
          {asTable ? 'グラフで見る' : '表で見る'}
        </button>
      </div>

      {asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1 font-normal">日付</th>
              <th className="py-1 text-right font-normal">完了数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {[...days].reverse().map((d) => (
              <tr key={d.date}>
                <td className="py-1.5">{formatDateJP(d.date)}</td>
                <td className="py-1.5 text-right tabular-nums">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          {/* 目盛り線（控えめに） */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {[top, top / 2, 0].map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-right text-[10px] text-gray-400 tabular-nums">{Number.isInteger(v) ? v : ''}</span>
                <div className={`h-px flex-1 ${v === 0 ? 'bg-gray-300 dark:bg-white/20' : 'bg-gray-100 dark:bg-white/5'}`} />
              </div>
            ))}
          </div>
          <div className="relative ml-7 flex h-44 items-end gap-0.5 pb-6" onMouseLeave={() => setHover(null)}>
            {days.map((d, i) => (
              <div
                key={d.date}
                className="group relative flex h-full flex-1 cursor-default flex-col justify-end"
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(i)}
              >
                {/* 棒の上端だけ角丸、下端は基準線にぴったり付ける */}
                <div
                  className={`mx-auto w-full max-w-7 rounded-t-[4px] transition-colors ${
                    hover === i ? 'bg-indigo-600 dark:bg-indigo-300' : 'bg-indigo-500 dark:bg-indigo-400'
                  }`}
                  style={{ height: `${(d.count / top) * 100}%`, minHeight: d.count ? 2 : 0 }}
                />
                {(i % 2 === (RANGE - 1) % 2 || i === RANGE - 1) && (
                  <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap ${d.date === today ? 'font-semibold text-gray-700 dark:text-gray-200' : 'text-gray-400'}`}>
                    {d.date === today ? '今日' : `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}`}
                  </span>
                )}
                {hover === i && (
                  <div className={`pointer-events-none absolute bottom-full z-10 mb-1 rounded-md ${
                    // 端の棒ではツールチップがはみ出さないよう寄せる
                    i >= RANGE - 3 ? 'right-0' : i <= 2 ? 'left-0' : 'left-1/2 -translate-x-1/2'
                  } bg-gray-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg dark:bg-gray-100 dark:text-gray-900`}>
                    {formatDateJP(d.date)}：{d.count}件完了
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** ステータスの内訳（1 本の積み上げ横棒 + 凡例） */
function StatusBreakdown({ tasks }: { tasks: Task[] }) {
  const counts = STATUSES.map((s) => ({ status: s, count: tasks.filter((t) => t.status === s).length }))
  const total = tasks.length
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold">ステータスの内訳</h2>
      {total === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">タスクはまだありません</p>
      ) : (
        <>
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="ステータスの内訳">
            {counts
              .filter((c) => c.count > 0)
              .map((c) => (
                <div key={c.status} className={STATUS_DOT[c.status]} style={{ width: `${(c.count / total) * 100}%` }} title={`${STATUS_LABEL[c.status]}：${c.count}件`} />
              ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {counts.map((c) => (
              <li key={c.status} className="flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${STATUS_DOT[c.status]}`} />
                <span className="text-gray-600 dark:text-gray-300">{STATUS_LABEL[c.status]}</span>
                <span className="ml-auto tabular-nums">{c.count}件</span>
                <span className="w-10 text-right text-xs text-gray-400 tabular-nums">{Math.round((c.count / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function ProgressTable({
  title,
  rows,
  today,
}: {
  title: string
  rows: { key: string; label: string; avatar: boolean; tasks: Task[] }[]
  today: string
}) {
  const visible = rows.filter((r) => r.tasks.length > 0 || r.avatar)
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {visible.length === 0 && <p className="py-4 text-center text-sm text-gray-400">データがありません</p>}
      <ul className="space-y-3">
        {visible.map((r) => {
          const p = completionRate(r.tasks)
          const overdue = r.tasks.filter((t) => dueState(t, today) === 'overdue').length
          return (
            <li key={r.key}>
              <div className="mb-1 flex items-center gap-2 text-sm">
                {r.avatar && <Avatar name={r.label} size={20} />}
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                {overdue > 0 && <span className="text-xs text-red-600 dark:text-red-400">超過 {overdue}</span>}
                <span className="text-xs text-gray-500 tabular-nums">
                  {p.done}/{p.total}件
                </span>
                <span className="w-10 text-right font-medium tabular-nums">{p.rate}%</span>
              </div>
              <ProgressBar rate={p.rate} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
