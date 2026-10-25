// 日付ユーティリティ
// ---------------------------------------------------------------
// アプリ内の日付は 'YYYY-MM-DD' 形式の文字列で扱い、
// 「今日」の判定はすべて日本時間（Asia/Tokyo）で行います。
// 文字列同士は辞書順比較 = 日付順比較になるので、比較が簡単です。

const TZ = 'Asia/Tokyo'
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** 日本時間の今日 'YYYY-MM-DD' */
export function todayJST(now: Date = new Date()): string {
  return dateFmt.format(now)
}

/** 日本時間の現在時刻 'HH:MM' */
export function nowTimeJST(now: Date = new Date()): string {
  return timeFmt.format(now)
}

/** タイムスタンプ（ISO文字列）を日本時間の日付に変換 */
export function toDateJST(iso: string): string {
  return dateFmt.format(new Date(iso))
}

function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: string, n: number): string {
  const x = parse(d)
  x.setUTCDate(x.getUTCDate() + n)
  return format(x)
}

export function addMonths(d: string, n: number): string {
  const x = parse(monthStart(d))
  x.setUTCMonth(x.getUTCMonth() + n)
  return format(x)
}

/** 曜日 0=日 … 6=土 */
export function weekday(d: string): number {
  return parse(d).getUTCDay()
}

/** 週の始まり（月曜日） */
export function weekStart(d: string): string {
  const wd = weekday(d)
  return addDays(d, wd === 0 ? -6 : 1 - wd)
}

export function weekEnd(d: string): string {
  return addDays(weekStart(d), 6)
}

export function monthStart(d: string): string {
  return d.slice(0, 8) + '01'
}

export function monthEnd(d: string): string {
  return addDays(addMonths(d, 1), -1)
}

export function diffDays(a: string, b: string): number {
  return Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000)
}

/** '11月10日(火)' */
export function formatDateJP(d: string, withWeekday = true): string {
  const [, m, day] = d.split('-').map(Number)
  return `${m}月${day}日${withWeekday ? `(${WEEKDAYS[weekday(d)]})` : ''}`
}

/** '2026年11月' */
export function formatMonthJP(d: string): string {
  const [y, m] = d.split('-').map(Number)
  return `${y}年${m}月`
}

/** '2026年10月25日(日)' */
export function formatFullDateJP(d: string): string {
  const [y] = d.split('-')
  return `${y}年${formatDateJP(d)}`
}

export function weekdayLabel(n: number): string {
  return WEEKDAYS[n]
}

/** 相対表示: 今日 / 明日 / 昨日 / 3日後 / 11月10日 */
export function relativeDateJP(d: string, today: string = todayJST()): string {
  const diff = diffDays(d, today)
  if (diff === 0) return '今日'
  if (diff === 1) return '明日'
  if (diff === -1) return '昨日'
  if (diff > 1 && diff <= 6) return `${diff}日後`
  return formatDateJP(d)
}

/** 'HH:MM:SS' → 'HH:MM' */
export function shortTime(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

/** タイムスタンプを '10/25 14:30' 形式に */
export function formatDateTimeJP(iso: string): string {
  const d = toDateJST(iso)
  const [, m, day] = d.split('-').map(Number)
  return `${m}/${day} ${timeFmt.format(new Date(iso))}`
}
