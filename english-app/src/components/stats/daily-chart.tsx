"use client";

import { useState } from "react";
import type { DailyActivity } from "@/lib/server/stats";
import { formatDurationJa } from "@/lib/utils";

const KIND_LABEL = { conversation: "英会話", grammar: "文法", writing: "英作文", review: "復習" } as const;

function totalOf(d: DailyActivity) {
  return d.conversation + d.grammar + d.writing + d.review;
}

/** 日別の学習時間（単一系列の棒グラフ。内訳はホバー／タップで表示） */
export function DailyChart({ daily, today }: { daily: DailyActivity[]; today: string }) {
  const [active, setActive] = useState<number | null>(null);
  const totals = daily.map(totalOf);
  const maxMin = Math.max(10, ...totals.map((s) => s / 60));
  // 目盛りはきりの良い分数に
  const step = maxMin <= 20 ? 5 : maxMin <= 60 ? 15 : maxMin <= 120 ? 30 : 60;
  const top = Math.ceil(maxMin / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  const W = 640;
  const H = 200;
  const padL = 34;
  const padB = 24;
  const padT = 8;
  const plotW = W - padL;
  const plotH = H - padB - padT;
  const slot = plotW / daily.length;
  const barW = Math.min(28, slot - 6);
  const y = (min: number) => padT + plotH - (min / top) * plotH;

  const activeDay = active !== null ? daily[active] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="直近14日間の学習時間（分）" onMouseLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {t}
            </text>
          </g>
        ))}
        {daily.map((d, i) => {
          const min = totals[i] / 60;
          const x = padL + slot * i + (slot - barW) / 2;
          const h = Math.max(0, y(0) - y(min));
          const r = Math.min(4, h / 2, barW / 2);
          const isToday = d.date === today;
          const label = `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}`;
          return (
            <g key={d.date}>
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(min) + r} Q${x},${y(min)} ${x + r},${y(min)} H${x + barW - r} Q${x + barW},${y(min)} ${x + barW},${y(min) + r} V${y(0)} Z`}
                  className={isToday ? "fill-primary" : "fill-primary/55"}
                  opacity={active === null || active === i ? 1 : 0.45}
                />
              )}
              {(i % 2 === daily.length % 2 || isToday) && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" className={isToday ? "fill-foreground text-[11px] font-semibold" : "fill-muted-foreground text-[11px]"}>
                  {isToday ? "今日" : label}
                </text>
              )}
              {/* ホバー判定用（棒より広い透明領域） */}
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
      {activeDay && (
        <div className="pointer-events-none absolute top-0 right-0 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
          <p className="font-semibold">
            {activeDay.date === today ? "今日" : activeDay.date}：{formatDurationJa(totalOf(activeDay))}
          </p>
          {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) =>
            activeDay[k] > 0 ? (
              <p key={k} className="text-muted-foreground">
                {KIND_LABEL[k]} {formatDurationJa(activeDay[k])}
              </p>
            ) : null,
          )}
        </div>
      )}
      <table className="sr-only">
        <caption>日別の学習時間</caption>
        <thead>
          <tr>
            <th>日付</th>
            <th>合計</th>
            {Object.values(KIND_LABEL).map((l) => (
              <th key={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
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
