// 個人タスク・チームタスク画面で共通の「期間タブ + 検索・絞り込み + リスト/カンバン切り替え」
import { useMemo, useState, type ReactNode } from 'react'
import { Columns3, List, Search, SlidersHorizontal } from 'lucide-react'
import type { Priority, Status, Task, TaskInput } from '../lib/types'
import {
  PERIOD_LABEL,
  PRIORITY_LABEL,
  SORT_LABEL,
  STATUSES,
  STATUS_LABEL,
  applyFilter,
  emptyFilter,
  filterByPeriod,
  sortTasks,
  type Period,
  type SortKey,
  type TaskFilter,
} from '../lib/tasks'
import { TaskList } from './TaskList'
import { KanbanBoard } from './KanbanBoard'

type ViewMode = 'list' | 'kanban'

/** 表示方法などをブラウザに覚えておく小さなフック */
function useStored<T extends string>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T) || initial
    } catch {
      return initial
    }
  })
  const set = (x: T) => {
    setV(x)
    try {
      localStorage.setItem(key, x)
    } catch {
      /* noop */
    }
  }
  return [v, set] as const
}

interface Props {
  storageKey: string
  tasks: Task[]
  showScope?: boolean
  showAssignee?: boolean
  newTaskDefaults?: TaskInput
  /** 担当者・プロジェクト・カテゴリーなどの追加フィルター UI */
  extraFilters?: (filter: TaskFilter, setFilter: (f: TaskFilter) => void) => ReactNode
  /** 絞り込み後のタスクを受け取って表示する追加情報（進捗率など） */
  summary?: (visible: Task[]) => ReactNode
  initialFilter?: Partial<TaskFilter>
}

export function TaskBoard({ storageKey, tasks, showScope, showAssignee, newTaskDefaults, extraFilters, summary, initialFilter }: Props) {
  const [view, setView] = useStored<ViewMode>(`${storageKey}:view`, 'list')
  const [period, setPeriod] = useStored<Period>(`${storageKey}:period`, 'today')
  const [sort, setSort] = useStored<SortKey>(`${storageKey}:sort`, 'due')
  const [filter, setFilter] = useState<TaskFilter>({ ...emptyFilter, ...initialFilter })
  const [showFilters, setShowFilters] = useState(Boolean(initialFilter && Object.values(initialFilter).some(Boolean)))
  const [hideDone, setHideDone] = useState(false)

  const visible = useMemo(() => {
    let list = applyFilter(filterByPeriod(tasks, period), filter)
    if (hideDone && period !== 'done' && view === 'list') list = list.filter((t) => t.status !== 'done')
    return sortTasks(list, sort)
  }, [tasks, period, filter, sort, hideDone, view])

  const activeFilterCount = [filter.priority, filter.status, filter.assigneeId, filter.projectId, filter.categoryId].filter(Boolean).length

  return (
    <div>
      {/* 期間タブ */}
      <div className="thin-scroll -mx-4 mb-3 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
        {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => {
          const count = filterByPeriod(tasks, p).filter((t) => p === 'done' || t.status !== 'done').length
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`btn shrink-0 px-3 py-1.5 ${
                period === p
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
              }`}
            >
              {PERIOD_LABEL[p]}
              <span className={`text-xs ${period === p ? 'opacity-70' : 'text-gray-400'} ${p === 'overdue' && count > 0 && period !== p ? 'text-red-500' : ''}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ツールバー */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="タスクを検索"
            value={filter.query}
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          />
        </div>
        <button className={`btn-secondary ${activeFilterCount ? 'text-indigo-600 dark:text-indigo-300' : ''}`} onClick={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal size={15} />
          絞り込み{activeFilterCount > 0 && ` (${activeFilterCount})`}
        </button>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="並べ替え">
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <option key={k} value={k}>{SORT_LABEL[k]}</option>
          ))}
        </select>
        <div className="seg" role="group" aria-label="表示切り替え">
          <button aria-pressed={view === 'list'} onClick={() => setView('list')} className="flex items-center gap-1">
            <List size={14} />
            リスト
          </button>
          <button aria-pressed={view === 'kanban'} onClick={() => setView('kanban')} className="flex items-center gap-1">
            <Columns3 size={14} />
            カンバン
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card mb-3 grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
          <div>
            <label className="label">優先度</label>
            <select className="input" value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value as Priority | '' })}>
              <option value="">すべて</option>
              {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">ステータス</label>
            <select className="input" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as Status | '' })}>
              <option value="">すべて</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          {extraFilters?.(filter, setFilter)}
          <div className="col-span-2 flex items-end gap-3 sm:col-span-4">
            {view === 'list' && period !== 'done' && (
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
                完了済みを隠す
              </label>
            )}
            <div className="flex-1" />
            <button className="btn-ghost text-xs" onClick={() => setFilter({ ...emptyFilter })}>
              条件をクリア
            </button>
          </div>
        </div>
      )}

      {summary?.(visible)}

      {view === 'list' ? (
        <div className="card p-1.5">
          <TaskList
            tasks={visible}
            showScope={showScope}
            showAssignee={showAssignee}
            emptyText={period === 'overdue' ? '期限超過のタスクはありません 🎉' : 'タスクはありません'}
          />
        </div>
      ) : (
        <KanbanBoard tasks={visible} showScope={showScope} showAssignee={showAssignee} newTaskDefaults={newTaskDefaults} />
      )}
    </div>
  )
}
