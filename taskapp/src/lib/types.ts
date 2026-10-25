// データベースのテーブルに対応する型定義
// （列を追加したら、ここと supabase/migrations の SQL を両方更新してください）

export type Scope = 'personal' | 'team'
export type Status = 'todo' | 'in_progress' | 'review' | 'done'
export type Priority = 'high' | 'medium' | 'low'
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays'
export type Role = 'admin' | 'member'

export interface Task {
  id: string
  scope: Scope
  title: string
  description: string
  status: Status
  priority: Priority | null
  created_by: string
  team_id: string | null
  assignee_id: string | null
  project_id: string | null
  category_id: string | null
  scheduled_date: string | null // 'YYYY-MM-DD'
  due_date: string | null // 'YYYY-MM-DD'
  due_time: string | null // 'HH:MM:SS'
  target_month: string | null // 'YYYY-MM-01'
  completed_at: string | null
  recurrence: Recurrence
  recurrence_days: number[] | null
  recurrence_source_id: string | null
  next_created: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/** 作成・更新時に送る項目（id や日時はDBが自動設定） */
export type TaskInput = Partial<
  Pick<
    Task,
    | 'scope'
    | 'title'
    | 'description'
    | 'status'
    | 'priority'
    | 'team_id'
    | 'assignee_id'
    | 'project_id'
    | 'category_id'
    | 'scheduled_date'
    | 'due_date'
    | 'due_time'
    | 'target_month'
    | 'recurrence'
    | 'recurrence_days'
    | 'sort_order'
  >
>

export interface Profile {
  id: string
  display_name: string
  email: string
}

export interface Team {
  id: string
  name: string
  created_by: string
}

export interface TeamMember {
  team_id: string
  user_id: string
  role: Role
  joined_at: string
}

/** 画面表示用: メンバー情報とプロフィールを合わせたもの */
export interface Member extends TeamMember {
  display_name: string
  email: string
}

export interface Invite {
  id: string
  team_id: string
  created_by: string
  expires_at: string
  max_uses: number
  use_count: number
  revoked_at: string | null
  created_at: string
}

export interface Project {
  id: string
  team_id: string
  name: string
  description: string
  start_date: string | null
  due_date: string | null
  owner_id: string | null
  archived: boolean
  created_by: string
  created_at: string
}

export interface Category {
  id: string
  owner_id: string
  name: string
  color: string
}

export type NotificationKind = 'assigned' | 'due_soon' | 'due_today' | 'overdue'

export interface AppNotification {
  id: string
  user_id: string
  task_id: string
  kind: NotificationKind
  is_read: boolean
  created_at: string
}

export interface MonthlyGoal {
  id: string
  owner_id: string
  month: string
  body: string
}
