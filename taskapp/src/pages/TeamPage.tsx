// チームタスク（メンバー全員で共有）
import { useSearchParams, Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { TaskBoard } from '../components/TaskBoard'
import { Avatar, ProgressBar } from '../components/Badges'
import { completionRate } from '../lib/tasks'

export function TeamPage() {
  const { tasks, team, members, projects } = useData()
  const { userId } = useAuth()
  const [params] = useSearchParams()

  if (!team) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <Users className="mx-auto mb-3 text-gray-300" size={36} />
        <p className="font-medium">まだチームに参加していません</p>
        <p className="mt-1 text-sm text-gray-500">管理者から招待リンクを受け取るか、チームを作成してください。</p>
        <Link to="/settings" className="btn-primary mt-4">
          チーム設定へ
        </Link>
      </div>
    )
  }

  const teamTasks = tasks.filter((t) => t.scope === 'team')

  return (
    <div>
      <TaskBoard
        storageKey="team"
        tasks={teamTasks}
        showAssignee
        newTaskDefaults={{ scope: 'team' }}
        initialFilter={{ projectId: params.get('project') ?? '', assigneeId: params.get('assignee') ?? '' }}
        extraFilters={(f, setF) => (
          <>
            <div>
              <label className="label">担当者</label>
              <select className="input" value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}>
                <option value="">全員</option>
                <option value={userId!}>自分</option>
                <option value="none">未割り当て</option>
                {members.filter((m) => m.user_id !== userId).map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">プロジェクト</label>
              <select className="input" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
                <option value="">すべて</option>
                <option value="none">プロジェクトなし</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </>
        )}
        summary={(visible) => {
          const r = completionRate(visible)
          return (
            <div className="mb-3 space-y-3">
              <div className="card flex items-center gap-4 p-3">
                <div className="flex-1">
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="font-medium">進捗率（表示中のタスク）</span>
                    <span className="tabular-nums text-gray-500">
                      {r.done} / {r.total} 件 ・ <span className="font-semibold text-gray-900 dark:text-white">{r.rate}%</span>
                    </span>
                  </div>
                  <ProgressBar rate={r.rate} />
                </div>
              </div>
              <div className="thin-scroll flex gap-2 overflow-x-auto pb-1">
                {members.map((m) => {
                  const mr = completionRate(visible.filter((t) => t.assignee_id === m.user_id))
                  return (
                    <div key={m.user_id} className="card flex min-w-44 items-center gap-2.5 p-2.5">
                      <Avatar name={m.display_name} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {m.display_name}
                          {m.role === 'admin' && <span className="ml-1 text-[10px] text-indigo-500">管理者</span>}
                        </p>
                        <ProgressBar rate={mr.rate} className="mt-1" />
                        <p className="mt-0.5 text-[11px] text-gray-400 tabular-nums">
                          {mr.done}/{mr.total} 件完了
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}
