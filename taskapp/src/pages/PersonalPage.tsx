// 個人タスク（本人だけが閲覧・管理できる）
import { Lock } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { TaskBoard } from '../components/TaskBoard'
import { QuickAdd } from '../components/QuickAdd'
import { todayJST } from '../lib/date'

export function PersonalPage() {
  const { tasks, categories } = useData()
  const personal = tasks.filter((t) => t.scope === 'personal')

  return (
    <div>
      <p className="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
        <Lock size={14} />
        個人タスクはあなただけが閲覧できます（チームメンバーや管理者にも表示されません）。
      </p>
      <div className="card mb-4 p-3">
        <QuickAdd defaults={{ scope: 'personal', scheduled_date: todayJST() }} placeholder="個人タスクを追加（今日の予定として登録）" />
      </div>
      <TaskBoard
        storageKey="personal"
        tasks={personal}
        newTaskDefaults={{ scope: 'personal' }}
        extraFilters={(f, setF) => (
          <div>
            <label className="label">カテゴリー</label>
            <select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              <option value="">すべて</option>
              <option value="none">カテゴリーなし</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      />
    </div>
  )
}
