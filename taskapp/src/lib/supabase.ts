import { createClient } from '@supabase/supabase-js'

// ブラウザに置いてよいのは「anon（publishable）キー」だけです。
// service_role（secret）キーは RLS を無視できるため、絶対にここで使わないでください。
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Supabase のエラーを日本語のメッセージに変換 */
export function errorMessage(err: unknown): string {
  const msg =
    typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err)
  const map: Record<string, string> = {
    'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
    'User already registered': 'このメールアドレスは既に登録されています',
    'Email not confirmed': 'メールアドレスの確認が完了していません。受信したメールのリンクを開いてください',
    'Password should be at least 6 characters': 'パスワードは6文字以上にしてください',
    'Failed to fetch': 'サーバーに接続できませんでした。通信環境を確認してください',
    'rate limit': '送信回数の上限に達しました。しばらく時間をおいてからお試しください',
    'For security purposes': '短時間に続けて送信できません。少し時間をおいてからお試しください',
    'New password should be different': '現在と同じパスワードは設定できません',
  }
  for (const [en, ja] of Object.entries(map)) if (msg.includes(en)) return ja
  if (msg.includes('row-level security')) return 'この操作を行う権限がありません'
  if (msg.includes('permission denied')) return 'この操作を行う権限がありません'
  return msg
}
