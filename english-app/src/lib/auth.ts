/**
 * 個人利用向けのシンプルなパスワード保護（APP_PASSWORD を設定した場合のみ有効）。
 * 将来ログイン機能を追加する場合は、この部分を認証ライブラリに置き換える。
 */
export const AUTH_COOKIE = "eapp_auth";

export async function passwordToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`english-app:v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** タイミング攻撃を避けるための比較 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
