import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 秒数を「12分」「1時間5分」のような日本語表記にする */
export function formatDurationJa(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}時間${m}分` : `${h}時間`;
  if (m > 0) return `${m}分`;
  return s > 0 ? `${s}秒` : "0分";
}

/** 秒数を mm:ss 表記にする */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function newId(): string {
  return crypto.randomUUID();
}
