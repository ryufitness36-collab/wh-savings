-- =====================================================================
-- Phase 3：タスクコメント・更新履歴・詳細なアプリ内通知
-- Phase 4：リアルタイム同期の有効化
-- ---------------------------------------------------------------------
-- Phase 1 の SQL を実行した後に、このファイルを SQL Editor で実行してください。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. タスクを閲覧できるか（コメント・履歴の RLS 用。SECURITY DEFINER で循環参照を防ぐ）
-- ---------------------------------------------------------------------
create or replace function public.can_view_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (
        (t.scope = 'personal' and t.created_by = auth.uid())
        or (t.scope = 'team' and public.is_team_member(t.team_id))
      )
  );
$$;

-- ---------------------------------------------------------------------
-- 2. コメント
-- ---------------------------------------------------------------------
create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  author_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);

alter table public.task_comments enable row level security;

create policy task_comments_select on public.task_comments for select to authenticated
  using (public.can_view_task(task_id));
create policy task_comments_insert on public.task_comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_view_task(task_id));
-- 削除: 自分のコメント、またはチーム管理者
create policy task_comments_delete on public.task_comments for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.tasks t
      where t.id = task_id and t.scope = 'team' and public.is_team_admin(t.team_id)
    )
  );

grant select, insert, delete on public.task_comments to authenticated;

-- ---------------------------------------------------------------------
-- 3. 更新履歴（トリガーで自動記録。ブラウザからは書き込めない）
-- ---------------------------------------------------------------------
create table public.task_history (
  id         bigint generated always as identity primary key,
  task_id    uuid not null references public.tasks (id) on delete cascade,
  actor_id   uuid references auth.users (id) on delete set null,
  action     text not null check (action in ('created', 'updated')),
  changes    jsonb not null default '{}'::jsonb, -- {"status": {"from": "todo", "to": "done"}, ...}
  created_at timestamptz not null default now()
);
create index task_history_task_idx on public.task_history (task_id, created_at);

alter table public.task_history enable row level security;

create policy task_history_select on public.task_history for select to authenticated
  using (public.can_view_task(task_id));

grant select on public.task_history to authenticated;

create or replace function public.tasks_record_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields text[] := array['title', 'description', 'status', 'priority', 'assignee_id', 'project_id',
                           'category_id', 'scheduled_date', 'due_date', 'due_time', 'target_month', 'recurrence'];
  v_field   text;
  v_old     jsonb;
  v_new     jsonb;
  v_changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.task_history (task_id, actor_id, action)
    values (new.id, coalesce(auth.uid(), new.created_by), 'created');
    return new;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  foreach v_field in array v_fields loop
    if v_old -> v_field is distinct from v_new -> v_field then
      -- 説明文は長くなるので「変更された」ことだけ記録
      if v_field = 'description' then
        v_changes := v_changes || jsonb_build_object(v_field, jsonb_build_object('from', null, 'to', null));
      else
        v_changes := v_changes || jsonb_build_object(v_field, jsonb_build_object('from', v_old -> v_field, 'to', v_new -> v_field));
      end if;
    end if;
  end loop;

  -- 並び順や内部フラグだけの更新は記録しない
  if v_changes <> '{}'::jsonb then
    insert into public.task_history (task_id, actor_id, action, changes)
    values (new.id, auth.uid(), 'updated', v_changes);
  end if;
  return new;
end;
$$;

create trigger tasks_record_history
  after insert or update on public.tasks
  for each row execute function public.tasks_record_history();

-- ---------------------------------------------------------------------
-- 4. 詳細な通知: コメント・ステータス変更
--    同じタスクにつき各種類 1 件だけ（未読に戻して日時を更新）なので大量に溜まらない
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('assigned', 'due_soon', 'due_today', 'overdue', 'commented', 'status_changed'));

-- 誰が何をしたか（通知に表示するため）
alter table public.notifications add column actor_id uuid references auth.users (id) on delete set null;
alter table public.notifications add column detail text not null default '';

-- 通知を作る共通関数（自分自身には通知しない）
create or replace function public.push_notification(
  p_user_id uuid, p_task_id uuid, p_kind text, p_detail text default ''
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_user_id = auth.uid() then
    return;
  end if;
  insert into public.notifications (user_id, task_id, kind, actor_id, detail)
  values (p_user_id, p_task_id, p_kind, auth.uid(), left(p_detail, 200))
  on conflict (user_id, task_id, kind)
  do update set is_read = false, created_at = now(), actor_id = excluded.actor_id, detail = excluded.detail;
end;
$$;

-- コメントされたら、タスクの担当者と作成者に通知
create or replace function public.comments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = new.task_id;
  if t.scope = 'team' then
    perform public.push_notification(t.assignee_id, t.id, 'commented', new.body);
    if t.created_by is distinct from t.assignee_id then
      perform public.push_notification(t.created_by, t.id, 'commented', new.body);
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_notify
  after insert on public.task_comments
  for each row execute function public.comments_notify();

-- 他の人がステータスを変えたら、作成者（と担当者）に通知
create or replace function public.tasks_notify_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scope = 'team' and new.status is distinct from old.status
     and current_setting('app.internal', true) is distinct from 'on' then
    perform public.push_notification(new.created_by, new.id, 'status_changed', new.status);
    if new.assignee_id is distinct from new.created_by then
      perform public.push_notification(new.assignee_id, new.id, 'status_changed', new.status);
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_notify_status
  after update of status on public.tasks
  for each row execute function public.tasks_notify_status();

-- 割り当て通知にも「誰が割り当てたか」を記録するよう置き換え
create or replace function public.tasks_notify_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scope <> 'team' then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.assignee_id is distinct from old.assignee_id and old.assignee_id is not null then
    delete from public.notifications
    where task_id = new.id and user_id = old.assignee_id;
  end if;

  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and new.recurrence_source_id is null then
    perform public.push_notification(new.assignee_id, new.id, 'assigned', '');
  end if;
  return new;
end;
$$;

-- refresh_notifications は完了済みタスクの「割り当て」通知を消す。
-- コメント・ステータス通知は、利用者が既読にするかタスク削除で消える。
-- 古い既読通知（30 日以上前）はここでまとめて掃除する
create or replace function public.cleanup_old_notifications()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.notifications
  where user_id = auth.uid() and is_read and created_at < now() - interval '30 days'
    and kind in ('commented', 'status_changed');
$$;

revoke execute on function public.can_view_task(uuid), public.push_notification(uuid, uuid, text, text),
  public.cleanup_old_notifications() from public, anon;
revoke execute on function public.push_notification(uuid, uuid, text, text) from authenticated;
grant execute on function public.can_view_task(uuid), public.cleanup_old_notifications() to authenticated;

-- ---------------------------------------------------------------------
-- 5. リアルタイム同期（Phase 4）
--    Supabase Realtime は RLS を守って配信するため、見えない行の変更は届かない
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tasks, public.task_comments, public.notifications;
  end if;
end;
$$;
