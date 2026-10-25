// ライト / ダーク / 端末の設定に従う の切り替え（設定はこのブラウザに保存）
// どの画面から変更しても全体に反映されるよう、小さな共有ストアとして実装しています
import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const listeners = new Set<() => void>()
let current: Theme = read()

function read(): Theme {
  try {
    return (localStorage.getItem('theme') as Theme) || 'system'
  } catch {
    return 'system'
  }
}

function resolveDark(theme: Theme) {
  return theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
}

function apply() {
  const dark = resolveDark(current)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111113' : '#ffffff')
}

function setTheme(theme: Theme) {
  current = theme
  try {
    if (theme === 'system') localStorage.removeItem('theme')
    else localStorage.setItem('theme', theme)
  } catch {
    /* 保存できない環境でも動作は続ける */
  }
  apply()
  listeners.forEach((l) => l())
}

// 端末のダークモード設定が変わったときにも追従
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  apply()
  listeners.forEach((l) => l())
})

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current)
  return { theme, setTheme, isDark: resolveDark(theme) }
}
