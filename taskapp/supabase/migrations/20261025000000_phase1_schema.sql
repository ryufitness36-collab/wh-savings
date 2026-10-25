-- =====================================================================
-- 個人・チーム統合タスク管理アプリ  Phase 1 スキーマ
-- ---------------------------------------------------------------------
-- 使い方:
--   Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行。
--   （ローカル開発では `npx supabase db reset` で自動適用されます）
--
-- 設計の要点:
--   * 個人タスクとチームタスクは同じ tasks テーブルに scope 列で区別して保存
--     （リスト/カンバン/カレンダーが同じデータを参照できるようにするため）
--   * アクセス制御はすべて RLS（Row Level Security）で DB 側が強制
--   * RLS の循環参照を避けるため、メンバー判定は SECURITY DEFINER 関数で行う
--   * チーム参加・権限変更などの重要操作は RPC 関数経由のみ許可
--   * 日付判定はすべて日本時間（Asia/Tokyo）
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 共通: 日本時間の「今日」
-- ---------------------------------------------------------------------
create or replace function public.today_jst()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Tokyo')::date;
$$;

-- updated_at 自動更新用トリガー関数
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. プロフィール（auth.users と 1:1）
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 50),
  email        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- サインアップ時にプロフィールを自動作成
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. チーム（アプリ全体で 1 つだけ）とメンバー
-- ---------------------------------------------------------------------
create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 50),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 定数式のユニークインデックスで「2 行目以降の作成」を DB レベルで禁止
create unique index teams_only_one on public.teams ((true));

create trigger teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create table public.team_members (
  team_id   uuid not null references public.teams (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- 1 ユーザーは 1 チームにのみ所属
create unique index team_members_one_team_per_user on public.team_members (user_id);

-- ---------------------------------------------------------------------
-- 3. 権限判定ヘルパー（SECURITY DEFINER = RLS を経由せずに判定 → 循環参照しない）
-- ---------------------------------------------------------------------
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_team_admin(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- 自分と相手が同じチームに所属しているか（プロフィール閲覧用）
create or replace function public.shares_team_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members me
    join public.team_members other on other.team_id = me.team_id
    where me.user_id = auth.uid() and other.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------
-- 4. 招待リンク
--    * トークン本体は DB に保存せず、SHA-256 ハッシュのみ保存
--    * 有効期限・利用回数上限・取り消し・失敗回数制限あり
-- ---------------------------------------------------------------------
create table public.team_invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  token_hash  text not null unique,
  created_by  uuid not null references auth.users (id),
  expires_at  timestamptz not null,
  max_uses    int not null default 1 check (max_uses between 1 and 50),
  use_count   int not null default 0,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- 招待コードの総当たり対策：失敗した試行を記録
create table public.invite_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index invite_attempts_user_time on public.invite_attempts (user_id, attempted_at);

-- ---------------------------------------------------------------------
-- 5. プロジェクト・カテゴリー
-- ---------------------------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  description text not null default '',
  start_date  date,
  due_date    date,
  owner_id    uuid references auth.users (id) on delete set null,
  archived    boolean not null default false,
  created_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- 個人タスク用カテゴリー（本人のみ）
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  color      text not null default 'slate',
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- 月間目標（個人用・本人のみ）
create table public.monthly_goals (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month      date not null check (extract(day from month) = 1),
  body       text not null default '' check (char_length(body) <= 1000),
  updated_at timestamptz not null default now(),
  unique (owner_id, month)
);

create trigger monthly_goals_updated_at
  before update on public.monthly_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. タスク本体
-- ---------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  scope           text not null check (scope in ('personal', 'team')),
  title           text not null check (char_length(title) between 1 and 200),
  description     text not null default '',
  status          text not null default 'todo'
                  check (status in ('todo', 'in_progress', 'review', 'done')),
  priority        text check (priority in ('high', 'medium', 'low')),
  created_by      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  team_id         uuid references public.teams (id) on delete cascade,
  assignee_id     uuid references auth.users (id) on delete set null,
  project_id      uuid references public.projects (id) on delete set null,
  category_id     uuid references public.categories (id) on delete set null,
  scheduled_date  date,          -- 実施予定日
  due_date        date,          -- 締切日（日付のみの場合はその日の終わりまで有効）
  due_time        time,          -- 締切時刻（任意）
  target_month    date,          -- 対象月（その月の 1 日で保存。例: 2026-11-01 = 11月中）
  completed_at    timestamptz,
  recurrence      text not null default 'none'
                  check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'weekdays')),
  recurrence_days smallint[],    -- 曜日指定 (0=日 … 6=土)
  recurrence_source_id uuid references public.tasks (id) on delete set null,
  next_created    boolean not null default false, -- 次回分を生成済みか
  sort_order      double precision not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- 個人タスクはチーム・プロジェクトを持たない
  constraint personal_shape check (
    scope <> 'personal' or (team_id is null and project_id is null)
  ),
  -- チームタスクは必ずチームに属し、個人カテゴリーを持たない
  constraint team_shape check (
    scope <> 'team' or (team_id is not null and category_id is null)
  ),
  constraint due_time_needs_date check (due_time is null or due_date is not null),
  constraint target_month_is_first_day check (
    target_month is null or extract(day from target_month) = 1
  ),
  constraint weekdays_need_days check (
    recurrence <> 'weekdays' or coalesce(array_length(recurrence_days, 1), 0) > 0
  )
);

create index tasks_personal_idx on public.tasks (created_by) where scope = 'personal';
create index tasks_team_idx on public.tasks (team_id) where scope = 'team';
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_due_idx on public.tasks (due_date);
create index tasks_project_idx on public.tasks (project_id);

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6-1. タスクの整合性・権限チェック（RLS では書けない「列ごとの」制約）
-- ---------------------------------------------------------------------
create or replace function public.tasks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_admin   boolean;
  v_changed boolean;
begin
  -- 完了日時の自動設定
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;

  -- auth.uid() が null = サービスロール / app.internal = 繰り返し生成などの内部処理。以降のチェックは省略
  if v_uid is null or current_setting('app.internal', true) = 'on' then
    return new;
  end if;

  if new.scope = 'personal' then
    -- 個人タスクの担当者は本人のみ
    if new.assignee_id is not null and new.assignee_id <> new.created_by then
      raise exception '個人タスクに他の人を担当者として設定することはできません';
    end if;
    -- カテゴリーは本人のもののみ
    if new.category_id is not null and not exists (
      select 1 from public.categories c where c.id = new.category_id and c.owner_id = new.created_by
    ) then
      raise exception '無効なカテゴリーです';
    end if;
  else
    -- チームタスク: 担当者は同じチームのメンバーであること
    if new.assignee_id is not null and not exists (
      select 1 from public.team_members m
      where m.team_id = new.team_id and m.user_id = new.assignee_id
    ) then
      raise exception '担当者はチームメンバーである必要があります';
    end if;
    -- プロジェクトは同じチームのもの
    if new.project_id is not null and not exists (
      select 1 from public.projects p where p.id = new.project_id and p.team_id = new.team_id
    ) then
      raise exception '無効なプロジェクトです';
    end if;

    v_admin := public.is_team_admin(new.team_id);

    if not v_admin then
      if tg_op = 'INSERT' then
        -- 一般メンバーが作成時に設定できる担当者は「なし」か「自分」だけ
        if new.assignee_id is not null and new.assignee_id <> v_uid then
          raise exception '他のメンバーへの割り当ては管理者のみ可能です';
        end if;
      else
        -- 担当者の変更: 一般メンバーは「未割り当て⇔自分」のみ
        if new.assignee_id is distinct from old.assignee_id then
          if not (
            (old.assignee_id is null or old.assignee_id = v_uid)
            and (new.assignee_id is null or new.assignee_id = v_uid)
          ) then
            raise exception '担当者の変更は管理者のみ可能です';
          end if;
        end if;

        -- 作成者でない（担当者のみの）場合は、ステータス・担当（自分の外し/取得）・並び順のみ変更可
        if old.created_by <> v_uid then
          v_changed := (to_jsonb(new) - array['status', 'completed_at', 'updated_at', 'assignee_id', 'sort_order', 'next_created'])
                    <> (to_jsonb(old) - array['status', 'completed_at', 'updated_at', 'assignee_id', 'sort_order', 'next_created']);
          if v_changed then
            raise exception '担当タスクではステータスのみ変更できます（その他の項目は作成者または管理者が編集できます）';
          end if;
        end if;
      end if;
    end if;
  end if;

  -- 不変項目の保護
  if tg_op = 'UPDATE' then
    if new.scope <> old.scope or new.created_by <> old.created_by
       or new.team_id is distinct from old.team_id or new.created_at <> old.created_at then
      raise exception '区分・作成者・チームは変更できません';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_guard
  before insert or update on public.tasks
  for each row execute function public.tasks_guard();

-- ---------------------------------------------------------------------
-- 6-2. 繰り返しタスク: 完了したら次回分を 1 件だけ生成（未来の予定が消えない）
-- ---------------------------------------------------------------------
create or replace function public.next_occurrence(
  p_base date, p_rule text, p_days smallint[]
) returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  d date;
  i int;
begin
  if p_base is null then return null; end if;
  case p_rule
    when 'daily'   then return p_base + 1;
    when 'weekly'  then return p_base + 7;
    when 'monthly' then return (p_base + interval '1 month')::date;
    when 'weekdays' then
      for i in 1..7 loop
        d := p_base + i;
        if extract(dow from d)::smallint = any (p_days) then
          return d;
        end if;
      end loop;
      return p_base + 7;
    else return null;
  end case;
end;
$$;

create or replace function public.tasks_spawn_next()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base  date;
  v_next  date;
  v_shift int;
begin
  if new.recurrence = 'none' or new.status <> 'done' or old.status = 'done' or new.next_created then
    return new;
  end if;

  -- 基準日: 締切日 → 予定日 → 今日 の順
  v_base := coalesce(new.due_date, new.scheduled_date, public.today_jst());
  v_next := public.next_occurrence(v_base, new.recurrence, new.recurrence_days);
  v_shift := v_next - v_base;

  perform set_config('app.internal', 'on', true);
  insert into public.tasks (
    scope, title, description, status, priority, created_by, team_id, assignee_id,
    project_id, category_id, scheduled_date, due_date, due_time, target_month,
    recurrence, recurrence_days, recurrence_source_id, sort_order
  ) values (
    new.scope, new.title, new.description, 'todo', new.priority, new.created_by, new.team_id,
    new.assignee_id, new.project_id, new.category_id,
    case when new.scheduled_date is not null then new.scheduled_date + v_shift end,
    case when new.due_date is not null then new.due_date + v_shift
         when new.scheduled_date is null then v_next end,
    new.due_time,
    case when new.target_month is not null
         then date_trunc('month', coalesce(new.due_date, new.scheduled_date, v_base) + v_shift)::date end,
    new.recurrence, new.recurrence_days, coalesce(new.recurrence_source_id, new.id), new.sort_order
  );

  update public.tasks set next_created = true where id = new.id;
  perform set_config('app.internal', '', true);
  return new;
end;
$$;

create trigger tasks_spawn_next
  after update of status on public.tasks
  for each row execute function public.tasks_spawn_next();

-- ---------------------------------------------------------------------
-- 7. アプリ内通知
--    (user_id, task_id, kind) をユニークにして同じタスクの重複通知を防ぐ
-- ---------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  task_id    uuid not null references public.tasks (id) on delete cascade,
  kind       text not null check (kind in ('assigned', 'due_soon', 'due_today', 'overdue')),
  is_read    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, task_id, kind)
);
create index notifications_user_idx on public.notifications (user_id, is_read);

-- 担当者が設定・変更されたら通知（自分で自分に割り当てた場合は通知しない）
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
     and new.assignee_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and new.recurrence_source_id is null then
    insert into public.notifications (user_id, task_id, kind)
    values (new.assignee_id, new.id, 'assigned')
    on conflict (user_id, task_id, kind)
    do update set is_read = false, created_at = now();
  end if;
  return new;
end;
$$;

create trigger tasks_notify_assignee
  after insert or update of assignee_id on public.tasks
  for each row execute function public.tasks_notify_assignee();

-- ある利用者にとって「今あるべき期限系通知」の一覧（内部用。クライアントからは実行不可）
create or replace function public.due_notification_state(p_uid uuid)
returns table (task_id uuid, kind text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id,
         case
           when t.due_date < public.today_jst()
             or (t.due_date = public.today_jst() and t.due_time is not null
                 and t.due_time < (now() at time zone 'Asia/Tokyo')::time) then 'overdue'
           when t.due_date = public.today_jst() then 'due_today'
           else 'due_soon'
         end
  from public.tasks t
  where t.status <> 'done'
    and t.due_date is not null
    and t.due_date <= public.today_jst() + 3
    and (
      (t.scope = 'personal' and t.created_by = p_uid)
      or (t.scope = 'team' and t.assignee_id = p_uid)
    );
$$;

-- アプリ起動時・データ更新時に呼ぶ: 期限系の通知を最新の状態に同期する
-- 1 タスクにつき期限系通知は常に最大 1 件（3日以内 → 今日 → 超過 と置き換わる）
create or replace function public.refresh_notifications()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'ログインが必要です';
  end if;

  -- 状態が変わった／対象外になった期限系通知を削除
  delete from public.notifications n
  where n.user_id = v_uid
    and n.kind in ('due_soon', 'due_today', 'overdue')
    and not exists (
      select 1 from public.due_notification_state(v_uid) s
      where s.task_id = n.task_id and s.kind = n.kind
    );

  -- 新しい期限系通知を追加（既にあれば何もしない = 重複しない）
  insert into public.notifications (user_id, task_id, kind)
  select v_uid, s.task_id, s.kind from public.due_notification_state(v_uid) s
  on conflict (user_id, task_id, kind) do nothing;

  -- 完了済み・担当から外れたタスクの割り当て通知を削除
  delete from public.notifications n
  using public.tasks t
  where n.user_id = v_uid and n.kind = 'assigned' and n.task_id = t.id
    and (t.status = 'done' or t.assignee_id is distinct from v_uid);

  select count(*) into v_count from public.notifications where user_id = v_uid and not is_read;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. RPC: チーム作成・招待・参加・メンバー管理
-- ---------------------------------------------------------------------

-- チームを作成（まだ 1 つも無い場合のみ）。作成者が管理者になる
create or replace function public.create_team(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_team_id uuid;
begin
  if v_uid is null then raise exception 'ログインが必要です'; end if;
  if exists (select 1 from public.teams) then
    raise exception 'チームは既に作成されています。招待リンクから参加してください';
  end if;

  insert into public.teams (name, created_by) values (trim(p_name), v_uid)
  returning id into v_team_id;
  insert into public.team_members (team_id, user_id, role) values (v_team_id, v_uid, 'admin');
  return v_team_id;
end;
$$;

-- 招待リンク発行（管理者のみ）。平文トークンはこの戻り値でのみ取得できる
create or replace function public.create_invite(p_expires_hours int default 72, p_max_uses int default 1)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_team_id uuid;
  v_token text;
begin
  select team_id into v_team_id from public.team_members where user_id = v_uid and role = 'admin';
  if v_team_id is null then raise exception '招待リンクを発行できるのは管理者のみです'; end if;
  if p_expires_hours < 1 or p_expires_hours > 24 * 14 then
    raise exception '有効期限は 1 時間〜14 日の範囲で指定してください';
  end if;
  if p_max_uses < 1 or p_max_uses > 50 then
    raise exception '利用回数は 1〜50 回で指定してください';
  end if;

  -- 2 つの UUIDv4 から 64 文字（約 244bit のランダム）のトークンを生成
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.team_invites (team_id, token_hash, created_by, expires_at, max_uses)
  values (v_team_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_uid,
          now() + make_interval(hours => p_expires_hours), p_max_uses);
  return v_token;
end;
$$;

-- 招待リンクで参加
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.team_invites;
  v_failures int;
begin
  if v_uid is null then raise exception 'ログインが必要です'; end if;

  -- 直近 1 時間に 10 回以上失敗していたらブロック
  select count(*) into v_failures from public.invite_attempts
  where user_id = v_uid and attempted_at > now() - interval '1 hour';
  if v_failures >= 10 then
    raise exception '試行回数が多すぎます。しばらく時間をおいてから再度お試しください';
  end if;

  if exists (select 1 from public.team_members where user_id = v_uid) then
    raise exception '既にチームに参加しています';
  end if;

  select * into v_invite from public.team_invites
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;

  if v_invite.id is null
     or v_invite.revoked_at is not null
     or v_invite.expires_at < now()
     or v_invite.use_count >= v_invite.max_uses then
    insert into public.invite_attempts (user_id) values (v_uid);
    -- 例外を投げると記録もロールバックされるため、戻り値 null で失敗を返す
    return null;
  end if;

  insert into public.team_members (team_id, user_id, role) values (v_invite.team_id, v_uid, 'member');
  update public.team_invites set use_count = use_count + 1 where id = v_invite.id;
  return v_invite.team_id;
end;
$$;

-- 招待の取り消し（管理者のみ）
create or replace function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.team_invites i set revoked_at = now()
  where i.id = p_invite_id and public.is_team_admin(i.team_id) and i.revoked_at is null;
  if not found then raise exception '招待を取り消せませんでした'; end if;
end;
$$;

-- メンバーの権限変更（管理者のみ。最後の管理者は降格できない）
create or replace function public.set_member_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  if p_role not in ('admin', 'member') then raise exception '無効な権限です'; end if;
  select team_id into v_team_id from public.team_members where user_id = p_user_id;
  if v_team_id is null or not public.is_team_admin(v_team_id) then
    raise exception '権限を変更できるのは管理者のみです';
  end if;
  if p_role = 'member' and (
    select count(*) from public.team_members where team_id = v_team_id and role = 'admin' and user_id <> p_user_id
  ) = 0 then
    raise exception '最後の管理者は降格できません';
  end if;
  update public.team_members set role = p_role where team_id = v_team_id and user_id = p_user_id;
end;
$$;

-- メンバーを外す（管理者は他人を、メンバーは自分自身を）
create or replace function public.remove_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select team_id into v_team_id from public.team_members where user_id = p_user_id;
  if v_team_id is null then raise exception 'メンバーが見つかりません'; end if;
  if p_user_id <> auth.uid() and not public.is_team_admin(v_team_id) then
    raise exception 'メンバーを外せるのは管理者のみです';
  end if;
  if exists (select 1 from public.team_members where team_id = v_team_id and user_id = p_user_id and role = 'admin')
     and (select count(*) from public.team_members where team_id = v_team_id and role = 'admin') = 1 then
    raise exception '最後の管理者はチームから外れることができません';
  end if;

  -- 外れたメンバーの担当を解除し、通知も削除
  perform set_config('app.internal', 'on', true);
  update public.tasks set assignee_id = null where team_id = v_team_id and assignee_id = p_user_id;
  perform set_config('app.internal', '', true);
  delete from public.notifications n using public.tasks t
  where n.task_id = t.id and t.team_id = v_team_id and n.user_id = p_user_id;
  delete from public.team_members where team_id = v_team_id and user_id = p_user_id;
end;
$$;

-- 対象月タスクの翌月繰り越し（自分が編集できる未完了タスクのみ）
create or replace function public.carry_over_month(p_month date, p_scope text)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.tasks
  set target_month = (date_trunc('month', p_month) + interval '1 month')::date
  where target_month = date_trunc('month', p_month)::date
    and status <> 'done'
    and scope = p_scope
    and (
      (scope = 'personal' and created_by = auth.uid())
      or (scope = 'team' and (created_by = auth.uid() or public.is_team_admin(team_id)))
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.teams           enable row level security;
alter table public.team_members    enable row level security;
alter table public.team_invites    enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.projects        enable row level security;
alter table public.categories      enable row level security;
alter table public.tasks           enable row level security;
alter table public.monthly_goals   enable row level security;
alter table public.notifications   enable row level security;

-- profiles: 自分 + 同じチームのメンバーのみ閲覧。更新は自分のみ
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_team_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- teams: 所属メンバーのみ閲覧。名前変更は管理者のみ。作成は RPC のみ
create policy teams_select on public.teams for select to authenticated
  using (public.is_team_member(id));
create policy teams_update on public.teams for update to authenticated
  using (public.is_team_admin(id)) with check (public.is_team_admin(id));

-- team_members: 所属メンバーのみ閲覧。追加・変更・削除は RPC のみ（直接書き込み不可）
create policy team_members_select on public.team_members for select to authenticated
  using (public.is_team_member(team_id));

-- team_invites: 管理者のみ一覧閲覧（token_hash は平文トークンではない）
create policy team_invites_select on public.team_invites for select to authenticated
  using (public.is_team_admin(team_id));

-- invite_attempts: ポリシー無し = クライアントからは一切アクセス不可

-- projects: メンバーは閲覧、管理者のみ作成・編集・削除
create policy projects_select on public.projects for select to authenticated
  using (public.is_team_member(team_id));
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_team_admin(team_id) and created_by = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_team_admin(team_id));

-- categories: 本人のみ
create policy categories_all on public.categories for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- monthly_goals: 本人のみ
create policy monthly_goals_all on public.monthly_goals for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- tasks: 個人タスクは作成者本人のみ / チームタスクは所属メンバーのみ
create policy tasks_select on public.tasks for select to authenticated
  using (
    (scope = 'personal' and created_by = auth.uid())
    or (scope = 'team' and public.is_team_member(team_id))
  );

create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      (scope = 'personal' and team_id is null)
      or (scope = 'team' and public.is_team_member(team_id))
    )
  );

-- 更新: 個人=本人 / チーム=管理者・作成者・担当者（列単位の細かい制限は tasks_guard トリガー）
create policy tasks_update on public.tasks for update to authenticated
  using (
    (scope = 'personal' and created_by = auth.uid())
    or (scope = 'team' and public.is_team_member(team_id) and (
      public.is_team_admin(team_id) or created_by = auth.uid() or assignee_id = auth.uid()
    ))
  )
  with check (
    (scope = 'personal' and created_by = auth.uid())
    or (scope = 'team' and public.is_team_member(team_id))
  );

-- 削除: 個人=本人 / チーム=管理者または作成者
create policy tasks_delete on public.tasks for delete to authenticated
  using (
    (scope = 'personal' and created_by = auth.uid())
    or (scope = 'team' and (public.is_team_admin(team_id)
        or (created_by = auth.uid() and public.is_team_member(team_id))))
  );

-- notifications: 本人のみ閲覧・既読化・削除（作成はトリガー / RPC のみ）
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 10. 権限（GRANT）
--     匿名ユーザー(anon)には何も許可しない。関数の実行もログインユーザーのみ
-- ---------------------------------------------------------------------
-- Supabase は既定で anon / authenticated に全テーブルの全権限を付与しているため、
-- いったん全て取り消してから必要なものだけを付与する（列単位の制限を有効にするため）
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select, update (display_name) on public.profiles to authenticated;
grant select, update (name) on public.teams to authenticated;
grant select on public.team_members to authenticated;
grant select (id, team_id, created_by, expires_at, max_uses, use_count, revoked_at, created_at)
  on public.team_invites to authenticated;
revoke all on public.invite_attempts from authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.monthly_goals to authenticated;
grant select, update (is_read), delete on public.notifications to authenticated;

grant execute on function
  public.today_jst(),
  public.is_team_member(uuid),
  public.is_team_admin(uuid),
  public.shares_team_with(uuid),
  public.refresh_notifications(),
  public.create_team(text),
  public.create_invite(int, int),
  public.accept_invite(text),
  public.revoke_invite(uuid),
  public.set_member_role(uuid, text),
  public.remove_member(uuid),
  public.carry_over_month(date, text)
to authenticated;

-- 将来リアルタイム同期を追加する場合は以下を実行:
--   alter publication supabase_realtime add table public.tasks;
