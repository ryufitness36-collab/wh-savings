// 異なるアカウントでのチーム共有・権限テスト
// ---------------------------------------------------------------
// 実際の Supabase（ローカル or クラウド）に対して、ブラウザと同じ anon キーで
// 3 人のユーザー（管理者 A / メンバー B / 部外者 C）を作成し、共有と権限を確認します。
//
// 使い方（ローカル）:
//   npm run db:reset      # ※チームは 1 つだけなので、空の DB で実行してください
//   npm run test:share
//
// 環境変数 SUPABASE_URL / SUPABASE_ANON_KEY で接続先を変更できます。
// （メール確認が有効なクラウド環境では、ユーザー作成後にログインできないため失敗します）
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.log(`  ❌ ${name} ${detail}`)
  }
}

const stamp = Date.now()
async function newUser(label) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = `${label.toLowerCase()}-${stamp}@example.com`
  const { data, error } = await client.auth.signUp({
    email,
    password: 'password123',
    options: { data: { display_name: `ユーザー${label}` } },
  })
  if (error || !data.session) throw new Error(`サインアップ失敗 ${label}: ${error?.message ?? 'セッションなし（メール確認が必要な設定です）'}`)
  return { client, id: data.user.id, email }
}

const todayJST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())
const addDays = (d, n) => {
  const x = new Date(d + 'T00:00:00Z')
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}

console.log(`接続先: ${URL}\n`)
const A = await newUser('A')
const B = await newUser('B')
const C = await newUser('C')

console.log('■ チーム作成')
const { data: teamId, error: teamErr } = await A.client.rpc('create_team', { p_name: 'テストチーム' })
check('A がチームを作成できる（A = 管理者）', !teamErr && teamId, teamErr?.message)
if (teamErr) {
  console.log('\n※ 既にチームが存在する可能性があります。`npm run db:reset` 後に再実行してください。')
  process.exit(1)
}
const { error: team2Err } = await B.client.rpc('create_team', { p_name: '2つ目のチーム' })
check('2 つ目のチームは作成できない', Boolean(team2Err))

console.log('\n■ 招待リンク')
const { error: memberInviteErr } = await B.client.rpc('create_invite', { p_expires_hours: 24, p_max_uses: 1 })
check('チーム外の B は招待リンクを発行できない', Boolean(memberInviteErr))
const { data: badJoin } = await B.client.rpc('accept_invite', { p_token: 'invalid-token' })
check('無効なトークンでは参加できない', badJoin === null)
const { data: token, error: invErr } = await A.client.rpc('create_invite', { p_expires_hours: 24, p_max_uses: 1 })
check('管理者 A は招待リンクを発行できる', !invErr && typeof token === 'string' && token.length === 64, invErr?.message)
const { data: joined, error: joinErr } = await B.client.rpc('accept_invite', { p_token: token })
check('B は招待リンクで参加できる', joined === teamId, joinErr?.message)
const { data: cJoin } = await C.client.rpc('accept_invite', { p_token: token })
check('利用回数上限（1人）を超えると C は参加できない', cJoin === null)
const { data: invRows } = await A.client.from('team_invites').select('id, expires_at, max_uses, use_count')
check('管理者は招待の一覧（期限・利用数）を確認できる', invRows?.length === 1 && invRows[0].use_count === 1)
const { error: hashErr } = await A.client.from('team_invites').select('token_hash')
check('トークンのハッシュ値は管理者でもブラウザから読み出せない', Boolean(hashErr))
const { data: bInvites } = await B.client.from('team_invites').select('id')
check('一般メンバー B は招待一覧を閲覧できない', (bInvites ?? []).length === 0)

console.log('\n■ 個人タスクの非公開')
const { data: aPersonal, error: apErr } = await A.client
  .from('tasks')
  .insert({ scope: 'personal', title: 'A の個人タスク', due_date: todayJST })
  .select()
  .single()
check('A は個人タスクを作成できる', !apErr, apErr?.message)
const { data: bSeesA } = await B.client.from('tasks').select('id').eq('id', aPersonal.id)
check('同じチームの B でも A の個人タスクは見えない', (bSeesA ?? []).length === 0)
const { data: bUpdA } = await B.client.from('tasks').update({ title: '改ざん' }).eq('id', aPersonal.id).select()
check('B は A の個人タスクを更新できない', (bUpdA ?? []).length === 0)
const { error: fakeOwner } = await B.client.from('tasks').insert({ scope: 'personal', title: 'なりすまし', created_by: A.id })
check('他人を作成者にした個人タスクは作れない', Boolean(fakeOwner))

console.log('\n■ チームタスクの共有')
const { data: tTask, error: ttErr } = await A.client
  .from('tasks')
  .insert({ scope: 'team', team_id: teamId, title: 'セミナー資料作成', assignee_id: B.id, due_date: addDays(todayJST, 2), priority: 'high' })
  .select()
  .single()
check('管理者 A は B を担当者にしてチームタスクを作成できる', !ttErr, ttErr?.message)
const { data: bSees } = await B.client.from('tasks').select('*').eq('id', tTask.id).single()
check('B は（再読み込みで）A が作ったチームタスクを閲覧できる', bSees?.title === 'セミナー資料作成')
const { data: bUpd, error: bUpdErr } = await B.client.from('tasks').update({ status: 'in_progress' }).eq('id', tTask.id).select()
check('担当者 B はステータスを変更できる', !bUpdErr && bUpd?.length === 1, bUpdErr?.message)
const { data: aSees } = await A.client.from('tasks').select('status').eq('id', tTask.id).single()
check('B の変更（進行中）が A からも見える', aSees?.status === 'in_progress')
const { error: bTitleErr } = await B.client.from('tasks').update({ title: '勝手に変更' }).eq('id', tTask.id)
check('担当者 B は（作成者でないので）タスク名を変更できない', Boolean(bTitleErr))
const { error: bReassignErr } = await B.client.from('tasks').update({ assignee_id: A.id }).eq('id', tTask.id)
check('一般メンバー B は担当者を他の人に変更できない', Boolean(bReassignErr))
const { error: bAssignOtherErr } = await B.client.from('tasks').insert({ scope: 'team', team_id: teamId, title: 'x', assignee_id: A.id })
check('一般メンバー B は他の人に割り当てたタスクを作成できない', Boolean(bAssignOtherErr))
const { data: bOwn, error: bOwnErr } = await B.client
  .from('tasks')
  .insert({ scope: 'team', team_id: teamId, title: 'B が作ったタスク', assignee_id: B.id })
  .select()
  .single()
check('一般メンバー B は自分担当のチームタスクを作成できる', !bOwnErr, bOwnErr?.message)
const { data: bEditOwn } = await B.client.from('tasks').update({ title: 'B が作ったタスク（編集）' }).eq('id', bOwn.id).select()
check('B は自分が作成したタスクを編集できる', bEditOwn?.length === 1)
const { data: bDelA } = await B.client.from('tasks').delete().eq('id', tTask.id).select()
check('B は A が作成したチームタスクを削除できない', (bDelA ?? []).length === 0)
const { data: aReassign } = await A.client.from('tasks').update({ assignee_id: A.id }).eq('id', bOwn.id).select()
check('管理者 A は担当者を変更できる', aReassign?.length === 1)

console.log('\n■ 部外者・未ログイン')
const { data: cSees } = await C.client.from('tasks').select('id')
check('チーム外の C にはチームタスクが一切見えない', (cSees ?? []).length === 0)
const { error: cInsErr } = await C.client.from('tasks').insert({ scope: 'team', team_id: teamId, title: '侵入' })
check('チーム外の C はチームタスクを作成できない', Boolean(cInsErr))
const { data: cProfiles } = await C.client.from('profiles').select('id')
check('C には他のユーザーのプロフィールが見えない', cProfiles?.length === 1)
const anon = createClient(URL, KEY, { auth: { persistSession: false } })
const { data: anonTasks } = await anon.from('tasks').select('id')
check('未ログインではタスクを取得できない', (anonTasks ?? []).length === 0)

console.log('\n■ 権限の昇格を防ぐ')
const { error: selfAdminErr } = await B.client.rpc('set_member_role', { p_user_id: B.id, p_role: 'admin' })
check('B は自分を管理者にできない（RPC）', Boolean(selfAdminErr))
const { data: directRole } = await B.client.from('team_members').update({ role: 'admin' }).eq('user_id', B.id).select()
check('B は team_members を直接書き換えられない', (directRole ?? []).length === 0)
const { error: directInsert } = await C.client.from('team_members').insert({ team_id: teamId, user_id: C.id, role: 'admin' })
check('C は招待なしに team_members へ直接追加できない', Boolean(directInsert))
const { data: roleNow } = await A.client.from('team_members').select('role').eq('user_id', B.id).single()
check('B の権限は member のまま', roleNow?.role === 'member')
const { error: demoteLastAdmin } = await A.client.rpc('set_member_role', { p_user_id: A.id, p_role: 'member' })
check('最後の管理者は降格できない', Boolean(demoteLastAdmin))
const { error: bProject } = await B.client.from('projects').insert({ team_id: teamId, name: 'B のプロジェクト', created_by: B.id })
check('一般メンバーはプロジェクトを作成できない', Boolean(bProject))
const { error: aProject } = await A.client.from('projects').insert({ team_id: teamId, name: 'イベント運営', created_by: A.id })
check('管理者はプロジェクトを作成できる', !aProject, aProject?.message)

const { error: nameErr } = await B.client.from('profiles').update({ display_name: '鈴木' }).eq('id', B.id)
check('自分の表示名は変更できる', !nameErr, nameErr?.message)
const { error: emailErr } = await B.client.from('profiles').update({ email: 'fake@example.com' }).eq('id', B.id)
check('プロフィールのメールアドレス欄は書き換えられない', Boolean(emailErr))

console.log('\n■ アプリ内通知')
await B.client.rpc('refresh_notifications')
await B.client.rpc('refresh_notifications')
const { data: bNotes } = await B.client.from('notifications').select('kind, task_id')
const forTask = (bNotes ?? []).filter((n) => n.task_id === tTask.id)
check(
  'B に「割り当て」と「期限3日以内」の通知が 1 件ずつ届く（重複しない）',
  forTask.length === 2 && forTask.some((n) => n.kind === 'assigned') && forTask.some((n) => n.kind === 'due_soon'),
  JSON.stringify(forTask),
)
await A.client.from('tasks').update({ due_date: addDays(todayJST, -1) }).eq('id', tTask.id)
await B.client.rpc('refresh_notifications')
const { data: bNotes2 } = await B.client.from('notifications').select('kind').eq('task_id', tTask.id)
check('期限が過ぎると「3日以内」が「期限超過」に置き換わる', bNotes2?.length === 2 && bNotes2.some((n) => n.kind === 'overdue'), JSON.stringify(bNotes2))
const { data: aSeesBNotes } = await A.client.from('notifications').select('id').eq('user_id', B.id)
check('他人の通知は見えない', (aSeesBNotes ?? []).length === 0)

console.log('\n■ 繰り返しタスク')
const { data: rTask } = await A.client
  .from('tasks')
  .insert({ scope: 'personal', title: '日報を書く', due_date: todayJST, recurrence: 'daily' })
  .select()
  .single()
await A.client.from('tasks').update({ status: 'done' }).eq('id', rTask.id)
const { data: series } = await A.client.from('tasks').select('due_date, status').eq('recurrence_source_id', rTask.id)
check('毎日のタスクを完了すると翌日分が 1 件作成される', series?.length === 1 && series[0].due_date === addDays(todayJST, 1) && series[0].status === 'todo', JSON.stringify(series))
await A.client.from('tasks').update({ status: 'todo' }).eq('id', rTask.id)
await A.client.from('tasks').update({ status: 'done' }).eq('id', rTask.id)
const { data: series2 } = await A.client.from('tasks').select('id').eq('recurrence_source_id', rTask.id)
check('完了を付け直しても次回分は重複作成されない', series2?.length === 1)

console.log('\n■ 招待の総当たり対策')
for (let i = 0; i < 10; i++) await C.client.rpc('accept_invite', { p_token: `wrong-${i}` })
const { data: newToken } = await A.client.rpc('create_invite', { p_expires_hours: 24, p_max_uses: 1 })
const { error: blocked } = await C.client.rpc('accept_invite', { p_token: newToken })
check('10 回失敗すると、正しいトークンでも一時的に参加できなくなる', Boolean(blocked) && blocked.message.includes('試行回数'), blocked?.message)

console.log('\n■ コメント・更新履歴（Phase 3）')
const { error: bComErr } = await B.client.from('task_comments').insert({ task_id: tTask.id, body: '下書きできました。確認お願いします' })
check('メンバー B はチームタスクにコメントできる', !bComErr, bComErr?.message)
const { data: aComments } = await A.client.from('task_comments').select('body').eq('task_id', tTask.id)
check('A は B のコメントを読める', aComments?.length === 1)
const { data: cComments } = await C.client.from('task_comments').select('id')
check('チーム外の C はコメントを読めない', (cComments ?? []).length === 0)
const { error: bPersonalCom } = await B.client.from('task_comments').insert({ task_id: aPersonal.id, body: 'のぞき見' })
check('B は A の個人タスクにコメントできない', Boolean(bPersonalCom))
const { error: fakeAuthor } = await C.client.from('task_comments').insert({ task_id: tTask.id, body: 'なりすまし', author_id: B.id })
check('他人になりすましてコメントできない', Boolean(fakeAuthor))
const { data: aNotes } = await A.client.from('notifications').select('kind, actor_id').eq('task_id', tTask.id)
check('作成者 A に「コメント」と「ステータス変更」の通知が届く（実行者付き）',
  aNotes?.some((n) => n.kind === 'commented' && n.actor_id === B.id) && aNotes?.some((n) => n.kind === 'status_changed' && n.actor_id === B.id),
  JSON.stringify(aNotes))
await B.client.from('task_comments').insert({ task_id: tTask.id, body: '追記です' })
const { data: aNotes2 } = await A.client.from('notifications').select('id').eq('task_id', tTask.id).eq('kind', 'commented')
check('コメントが増えても同じタスクのコメント通知は 1 件にまとまる', aNotes2?.length === 1)
const { data: hist } = await A.client.from('task_history').select('action, actor_id, changes').eq('task_id', tTask.id).order('created_at')
check('更新履歴に「作成」と B のステータス変更が記録される',
  hist?.[0]?.action === 'created' && hist.some((h) => h.actor_id === B.id && h.changes.status?.to === 'in_progress'),
  JSON.stringify(hist))
const { error: fakeHist } = await B.client.from('task_history').insert({ task_id: tTask.id, action: 'created' })
check('更新履歴はブラウザから書き込めない', Boolean(fakeHist))
const { data: bHistPersonal } = await B.client.from('task_history').select('id').eq('task_id', aPersonal.id)
check('B は A の個人タスクの履歴を読めない', (bHistPersonal ?? []).length === 0)

console.log('\n■ 保存した検索条件')
const { error: svErr } = await B.client.from('saved_views').insert({ page: 'team', name: '自分の担当', config: { period: 'all' } })
check('B は検索条件を保存できる', !svErr, svErr?.message)
const { data: aViews } = await A.client.from('saved_views').select('id')
check('A には B の保存した条件が見えない', (aViews ?? []).length === 0)
const { error: svFake } = await A.client.from('saved_views').insert({ page: 'team', name: 'x', config: {}, owner_id: B.id })
check('他人の名前で条件を保存できない', Boolean(svFake))

console.log('\n■ 手動の並べ替え')
const { data: unassigned } = await A.client.from('tasks').insert({ scope: 'team', team_id: teamId, title: 'A の未割り当てタスク' }).select().single()
const { data: newRow } = await A.client.from('tasks').select('sort_order').eq('id', unassigned.id).single()
check('新しいタスクは一番下に入る（並び順の初期値が作成時刻）', newRow.sort_order > 1e9, String(newRow.sort_order))
const { data: cnt1, error: roErr } = await A.client.rpc('reorder_tasks', { p_ids: [unassigned.id, tTask.id] })
check('管理者 A はチームタスクを並べ替えられる', !roErr && cnt1 === 2, roErr?.message ?? String(cnt1))
const { data: cnt2 } = await B.client.rpc('reorder_tasks', { p_ids: [tTask.id, unassigned.id] })
check('B は担当タスクだけ並び順を変えられ、権限のないタスクは変わらない', cnt2 === 1, String(cnt2))
const { data: orderNow } = await A.client.from('tasks').select('id, sort_order').in('id', [unassigned.id, tTask.id])
const so = Object.fromEntries(orderNow.map((r) => [r.id, r.sort_order]))
check('権限のないタスクの並び順は元のまま', so[unassigned.id] === 1 && so[tTask.id] === 1, JSON.stringify(so))
const { data: cnt3 } = await C.client.rpc('reorder_tasks', { p_ids: [tTask.id, unassigned.id, aPersonal.id] })
check('チーム外の C は並べ替えできない', cnt3 === 0, String(cnt3))

console.log(`\n結果: ${passed} 件成功 / ${failed} 件失敗`)
process.exit(failed ? 1 : 0)
