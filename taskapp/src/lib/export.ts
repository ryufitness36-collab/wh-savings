// データエクスポート（CSV / JSON）。ブラウザ内でファイルを作ってダウンロードします
import type { Category, Member, Project, Task } from './types'
import { PRIORITY_LABEL, RECURRENCE_LABEL, STATUS_LABEL, memberName } from './tasks'
import { nowTimeJST, toDateJST, todayJST } from './date'

/** '2026-10-25 14:30'（日本時間）。表計算ソフトで並べ替えやすい形式 */
const stamp = (iso: string) => `${toDateJST(iso)} ${nowTimeJST(new Date(iso))}`

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** CSV の 1 セル（カンマ・改行・ダブルクォートを含む場合は囲む） */
function cell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function exportTasksCsv(tasks: Task[], members: Member[], projects: Project[], categories: Category[]) {
  const header = [
    'タスク名', '区分', 'ステータス', '優先度', '担当者', 'プロジェクト', 'カテゴリー',
    '実施予定日', '締切日', '締切時刻', '対象月', '繰り返し', '完了日時', '作成者', '作成日時', '更新日時', '詳細メモ',
  ]
  const rows = tasks.map((t) => [
    t.title,
    t.scope === 'personal' ? '個人' : 'チーム',
    STATUS_LABEL[t.status],
    t.priority ? PRIORITY_LABEL[t.priority] : '',
    t.scope === 'team' ? memberName(members, t.assignee_id) : '',
    projects.find((p) => p.id === t.project_id)?.name ?? '',
    categories.find((c) => c.id === t.category_id)?.name ?? '',
    t.scheduled_date ?? '',
    t.due_date ?? '',
    t.due_time ? t.due_time.slice(0, 5) : '',
    t.target_month ? t.target_month.slice(0, 7) : '',
    RECURRENCE_LABEL[t.recurrence],
    t.completed_at ? stamp(t.completed_at) : '',
    t.scope === 'personal' ? '自分' : memberName(members, t.created_by),
    stamp(t.created_at),
    stamp(t.updated_at),
    t.description,
  ])
  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  // 先頭の BOM（\uFEFF）で Excel が日本語を正しく読める
  download(`tasks-${todayJST()}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8')
}

export function exportJson(data: Record<string, unknown>) {
  download(`tasks-backup-${todayJST()}.json`, JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2), 'application/json')
}
