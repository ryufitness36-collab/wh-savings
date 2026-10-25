/** タイムゾーンを考慮した日付計算 */

/** 指定タイムゾーンでの日付文字列（YYYY-MM-DD）を返す */
export function dateKey(timestamp: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** YYYY-MM-DD に日数を足す */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** 直近 n 日分の日付キー（古い順） */
export function lastNDays(todayKey: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(todayKey, i - (n - 1)));
}

/**
 * 連続学習日数。今日学習していなくても、昨日まで続いていれば継続中として数える。
 */
export function computeStreak(studyDates: Iterable<string>, todayKey: string): number {
  const set = new Set(studyDates);
  let cursor = set.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** その日が属する週の月曜日（YYYY-MM-DD） */
export function weekStart(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=日曜
  return addDays(key, -((weekday + 6) % 7));
}
