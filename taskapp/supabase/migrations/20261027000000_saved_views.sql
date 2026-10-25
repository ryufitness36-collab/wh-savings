-- =====================================================================
-- 保存した検索条件（よく使う絞り込み）
-- ---------------------------------------------------------------------
-- 期間・並べ替え・表示方法・絞り込み条件をまとめて名前を付けて保存します。
-- 本人だけが閲覧・編集でき、PC とスマホで同じ条件を使えます。
-- 既存の 2 つの SQL の後に実行してください。
-- =====================================================================

create table public.saved_views (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page       text not null check (page in ('personal', 'team')),
  name       text not null check (char_length(name) between 1 and 30),
  config     jsonb not null default '{}'::jsonb, -- { period, sort, view, filter }
  created_at timestamptz not null default now(),
  unique (owner_id, page, name)
);

alter table public.saved_views enable row level security;

create policy saved_views_all on public.saved_views for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on public.saved_views to authenticated;
