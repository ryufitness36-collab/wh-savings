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

/** 自分のPC・家のネットワーク内からのアクセスとみなすホスト名か */
export function isLocalHostname(hostHeader: string): boolean {
  const raw = hostHeader.trim().toLowerCase();
  const bracketed = raw.match(/^\[(.*)\](:\d+)?$/); // IPv6：[::1]:3000 → ::1
  const host = bracketed ? bracketed[1] : raw.replace(/:\d+$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "::1") return true;
  if (host.endsWith(".local")) return true; // Mac の「名前.local」
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * インターネット経由（トンネルなど）のアクセスか。
 * Host / X-Forwarded-Host のどちらかが外部の名前なら外部とみなす。
 * Cloudflare 経由のアクセスには必ず cf-ray ヘッダーが付くので、それも外部とみなす（利用者が消せないため）。
 */
export function isRemoteRequest(headers: Headers): boolean {
  if (headers.has("cf-ray") || headers.has("cf-connecting-ip")) return true;
  const hosts = [headers.get("host"), headers.get("x-forwarded-host")].filter((h): h is string => Boolean(h));
  return hosts.some((h) => h.split(",").some((part) => !isLocalHostname(part)));
}

/** https でアクセスされているか（トンネル経由は X-Forwarded-Proto で判定） */
export function isHttpsRequest(url: string, headers: Headers): boolean {
  return new URL(url).protocol === "https:" || headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
}
