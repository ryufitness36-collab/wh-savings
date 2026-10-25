-- =====================================================================
-- カンバンの手動並べ替え
-- ---------------------------------------------------------------------
-- tasks.sort_order（小さいほど上）でカード・リストの手動の並び順を保存します。
-- 新しいタスクは作成時刻を初期値にして、列の一番下に追加されるようにします。
-- 既存の 3 つの SQL の後に実行してください。
-- =====================================================================

alter table public.tasks
  alter column sort_order set default extract(epoch from now());

-- 既存のタスクは作成順に並べておく
-- （更新日時・履歴が書き換わらないよう、この更新の間だけトリガーを止める）
alter table public.tasks disable trigger user;
update public.tasks set sort_order = extract(epoch from created_at) where sort_order = 0;
alter table public.tasks enable trigger user;

-- 列の並び順をまとめて保存する（カンバンでカードを動かしたときに 1 回だけ呼ぶ）
-- p_ids の順番どおりに sort_order = 1, 2, 3 … を付け直します。
-- SECURITY INVOKER なので RLS と tasks_guard がそのまま効き、編集できないタスクは更新されません。
create or replace function public.reorder_tasks(p_ids uuid[])
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  if coalesce(array_length(p_ids, 1), 0) > 500 then
    raise exception '一度に並べ替えできるのは 500 件までです';
  end if;
  update public.tasks t
  set sort_order = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where t.id = o.id and t.sort_order is distinct from o.ord;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.reorder_tasks(uuid[]) from public, anon;
grant execute on function public.reorder_tasks(uuid[]) to authenticated;
