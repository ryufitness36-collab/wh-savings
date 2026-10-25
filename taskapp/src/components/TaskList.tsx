// リスト表示（Todoist 風のシンプルな一覧）
import { Check } from 'lucide-react'
import type { Task } from '../lib/types'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { taskPermission } from '../lib/tasks'
import { formatDateJP } from '../lib/date'
import { AssigneeLabel, DueLabel, PriorityBadge, RecurrenceIcon, ScopeBadge, StatusBadge } from './Badges'
import { useTaskEditor } from './TaskEditor'

export function CheckButton({ task }: { task: Task }) {
  const { toggleDone, role } = useData()
  const { userId } = useAuth()
  const done = task.status === 'done'
  const allowed = taskPermission(task, userId!, role).canChangeStatus
  const ring =
    task.priority === 'high' ? 'border-red-400' : task.priority === 'medium' ? 'border-amber-400' : 'border-gray-300 dark:border-gray-500'
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        toggleDone(task)
      }}
      disabled={!allowed}
      title={allowed ? (done ? '未完了に戻す' : '完了にする') : 'このタスクの進捗は担当者・作成者・管理者のみ変更できます'}
      aria-label={done ? '未完了に戻す' : '完了にする'}
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        done ? 'border-emerald-500 bg-emerald-500 text-white' : `${ring} hover:bg-gray-100 dark:hover:bg-white/10`
      }`}
    >
      {done && <Check size={13} strokeWidth={3} />}
    </button>
  )
}

interface Props {
  tasks: Task[]
  showScope?: boolean
  showAssignee?: boolean
  showStatus?: boolean
  emptyText?: string
  compact?: boolean
}

export function TaskList({ tasks, showScope, showAssignee, showStatus = true, emptyText = 'タスクはありません', compact }: Props) {
  const { members, projects, categories } = useData()
  const openEditor = useTaskEditor()

  if (tasks.length === 0) {
    return <p className="px-2 py-8 text-center text-sm text-gray-400">{emptyText}</p>
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-white/5">
      {tasks.map((t) => {
        const project = t.project_id ? projects.find((p) => p.id === t.project_id) : null
        const category = t.category_id ? categories.find((c) => c.id === t.category_id) : null
        const done = t.status === 'done'
        return (
          <li
            key={t.id}
            className={`group flex cursor-pointer items-start gap-3 rounded-lg px-2 ${compact ? 'py-2' : 'py-2.5'} hover:bg-gray-50 dark:hover:bg-white/[0.03]`}
            onClick={() => openEditor(t)}
          >
            <div className="pt-0.5">
              <CheckButton task={t} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`truncate text-sm ${done ? 'text-gray-400 line-through' : ''}`}>{t.title}</span>
                <RecurrenceIcon task={t} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {showScope && <ScopeBadge scope={t.scope} />}
                <DueLabel task={t} />
                {t.scheduled_date && !compact && (
                  <span className="text-xs text-gray-400">予定 {formatDateJP(t.scheduled_date)}</span>
                )}
                <PriorityBadge priority={t.priority} />
                {showStatus && t.status !== 'todo' && t.status !== 'done' && <StatusBadge status={t.status} />}
                {project && <span className="truncate text-xs text-gray-400"># {project.name}</span>}
                {category && <span className="truncate text-xs text-gray-400"># {category.name}</span>}
                {showAssignee && t.scope === 'team' && (
                  <span className="sm:hidden">
                    <AssigneeLabel members={members} id={t.assignee_id} />
                  </span>
                )}
              </div>
            </div>
            {showAssignee && t.scope === 'team' && (
              <div className="hidden w-32 shrink-0 pt-0.5 sm:block">
                <AssigneeLabel members={members} id={t.assignee_id} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
