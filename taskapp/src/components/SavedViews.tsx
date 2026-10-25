// 保存した検索条件（よく使う絞り込みをワンタップで呼び出す）
import { useCallback, useEffect, useState } from 'react'
import { Bookmark, Plus, X } from 'lucide-react'
import { errorMessage, supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { emptyFilter, type Period, type SortKey, type TaskFilter } from '../lib/tasks'

export interface ViewConfig {
  period: Period
  sort: SortKey
  view: 'list' | 'kanban'
  filter: TaskFilter
}

interface SavedView {
  id: string
  name: string
  config: ViewConfig
}

interface Props {
  page: 'personal' | 'team'
  current: ViewConfig
  onApply: (c: ViewConfig) => void
}

/** 2 つの条件が同じか（今どの保存条件を表示中かを判定するため）
 *  ※ DB に保存すると項目の順番が変わるので、項目ごとに比べる */
function same(a: ViewConfig, b: ViewConfig) {
  if (a.period !== b.period || a.sort !== b.sort || a.view !== b.view) return false
  return (Object.keys(emptyFilter) as (keyof TaskFilter)[]).every((k) => a.filter[k] === b.filter[k])
}

export function SavedViews({ page, current, onApply }: Props) {
  const toast = useToast()
  const [views, setViews] = useState<SavedView[]>([])
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('saved_views').select('id, name, config').eq('page', page).order('created_at')
    // 古い保存データに項目が足りなくても動くよう、空の条件で補う
    setViews(((data as SavedView[]) ?? []).map((v) => ({ ...v, config: { ...v.config, filter: { ...emptyFilter, ...v.config.filter } } })))
  }, [page])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    if (!name.trim()) return
    const { error } = await supabase.from('saved_views').insert({ page, name: name.trim(), config: current })
    if (error) return toast(error.code === '23505' ? '同じ名前の条件があります' : errorMessage(error), 'error')
    toast(`「${name.trim()}」を保存しました`)
    setName('')
    setNaming(false)
    load()
  }

  async function remove(v: SavedView) {
    if (!confirm(`保存した条件「${v.name}」を削除しますか？`)) return
    const { error } = await supabase.from('saved_views').delete().eq('id', v.id)
    if (error) return toast(errorMessage(error), 'error')
    load()
  }

  return (
    <div className="thin-scroll -mx-4 mb-3 flex items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
      <Bookmark size={14} className="shrink-0 text-gray-400" aria-label="保存した条件" />
      {views.map((v) => {
        const active = same(v.config, current)
        return (
          <span
            key={v.id}
            className={`inline-flex shrink-0 items-center rounded-full border text-xs ${
              active
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-200'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5'
            }`}
          >
            <button className="py-1 pr-1 pl-2.5" onClick={() => onApply(v.config)}>
              {v.name}
            </button>
            <button className="rounded-full p-1 pr-1.5 text-gray-400 hover:text-red-500" onClick={() => remove(v)} aria-label={`${v.name}を削除`}>
              <X size={12} />
            </button>
          </span>
        )
      })}
      {naming ? (
        <form
          className="flex shrink-0 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <input
            className="input w-36 py-1 text-xs"
            autoFocus
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名前（例：今週の高優先度）"
            onKeyDown={(e) => e.key === 'Escape' && setNaming(false)}
          />
          <button className="btn-primary px-2.5 py-1 text-xs" disabled={!name.trim()}>
            保存
          </button>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setNaming(false)}>
            やめる
          </button>
        </form>
      ) : (
        <button className="btn-ghost shrink-0 px-2 py-1 text-xs" onClick={() => setNaming(true)}>
          <Plus size={13} />
          今の条件を保存
        </button>
      )}
    </div>
  )
}
