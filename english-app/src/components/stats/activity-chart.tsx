"use client";

import { useState } from "react";
import type { DailyActivity } from "@/lib/server/stats";
import { formatDurationJa } from "@/lib/utils";

const KIND_LABEL = { conversation: "英会話", grammar: "文法", writing: "英作文", review: "復習" } as const;

function totalOf(d: DailyActivity) {
  return d.conversation + d.grammar + d.writing + d.review;
}

/** 目盛りをきりの良い数にする */
export function niceStep(max: number, targetTicks = 4): number {
  const raw = max / targetTicks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= raw) return m * pow;
  }
  return 10 * pow;
}

/**
 * 学習時間の棒グラフ（単一系列）。内訳はホバー／タップで表示。
 * mode="daily" は日別、"weekly" は週別（date は週の月曜日）。
 */
export function ActivityChart({ data, currentKey, mode }: { data: DailyActivity[]; currentKey: string; mode: "daily" | "weekly" }) {
  const [active, setActive] = useState<number | null>(null);
  const totals = data.map(totalOf);
  const maxMin = Math.max(10, ...totals.map((s) => s / 60));
  const step = niceStep(maxMin);
  const top = Math.ceil(maxMin / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const W = 640;
  const H = 200;
  const padL = 36;
  const padB = 24;
  const padT = 8;
  const plotW = W - padL;
  const plotH = H - padB - padT;
  const slot = plotW / data.length;
  const barW = Math.max(4, Math.min(28, slot - 4));
  const y = (min: number) => padT + plotH - (min / top) * plotH;
  const labelEvery = data.length > 20 ? 5 : 2;

  const fmt = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
  const currentLabel = mode === "daily" ? "今日" : "今週";
  const activeItem = active !== null ? data[active] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={mode === "daily" ? "日別の学習時間（分）" : "週別の学習時間（分）"}
        onMouseLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const min = totals[i] / 60;
          const x = padL + slot * i + (slot - barW) / 2;
          const h = Math.max(0, y(0) - y(min));
          const r = Math.min(4, h / 2, barW / 2);
          const isCurrent = d.date === currentKey;
          const fromEnd = data.length - 1 - i;
          return (
            <g key={d.date}>
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(min) + r} Q${x},${y(min)} ${x + r},${y(min)} H${x + barW - r} Q${x + barW},${y(min)} ${x + barW},${y(min) + r} V${y(0)} Z`}
                  className={isCurrent ? "fill-primary" : "fill-primary/55"}
                  opacity={active === null || active === i ? 1 : 0.45}
                />
              )}
              {(fromEnd % labelEvery === 0 || isCurrent) && (
                <text
                  x={x + barW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  className={isCurrent ? "fill-foreground text-[11px] font-semibold" : "fill-muted-foreground text-[11px]"}
                >
                  {isCurrent ? currentLabel : fmt(d.date)}
                </text>
              )}
              <rect
                x={padL + slot * i}
                y={padT}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onClick={() => setActive(active === i ? null : i)}
              />
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">縦軸：分</p>
      {activeItem && (
        <div className="pointer-events-none absolute top-0 right-0 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
          <p className="font-semibold">
            {activeItem.date === currentKey ? currentLabel : mode === "daily" ? fmt(activeItem.date) : `${fmt(activeItem.date)}〜の週`}：
            {formatDurationJa(totalOf(activeItem))}
          </p>
          {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) =>
            activeItem[k] > 0 ? (
              <p key={k} className="text-muted-foreground">
                {KIND_LABEL[k]} {formatDurationJa(activeItem[k])}
              </p>
            ) : null,
          )}
        </div>
      )}
      <table className="sr-only">
        <caption>{mode === "daily" ? "日別" : "週別"}の学習時間</caption>
        <thead>
          <tr>
            <th>{mode === "daily" ? "日付" : "週（月曜日）"}</th>
            <th>合計</th>
            {Object.values(KIND_LABEL).map((l) => (
              <th key={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{formatDurationJa(totalOf(d))}</td>
              <td>{formatDurationJa(d.conversation)}</td>
              <td>{formatDurationJa(d.grammar)}</td>
              <td>{formatDurationJa(d.writing)}</td>
              <td>{formatDurationJa(d.review)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
