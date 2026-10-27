"use client";

import Link from "next/link";
import { useState } from "react";
import type { ConversationTrendPoint } from "@/lib/server/stats";

/** 英会話レポートの総合スコア（4項目の平均）の推移。点をホバー／タップすると内訳を表示 */
export function ScoreTrendChart({ points }: { points: ConversationTrendPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 640;
  const H = 180;
  const padL = 28;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (i: number) => padL + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const y = (v: number) => padT + plotH - (v / 10) * plotH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.overall)}`).join(" ");
  const activePoint = active !== null ? points[active] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="英会話の総合スコアの推移（10点満点）" onMouseLeave={() => setActive(null)}>
        {[0, 5, 10].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {t}
            </text>
          </g>
        ))}
        <path d={path} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(i)} cy={y(p.overall)} r={active === i ? 6 : 4.5} className="fill-primary stroke-card" strokeWidth={2} />
            {(i === points.length - 1 || i === 0) && (
              <text x={x(i)} y={y(p.overall) - 10} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
                {p.overall}
              </text>
            )}
            <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {new Date(p.startedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
            </text>
            <rect
              x={x(i) - Math.max(12, plotW / points.length / 2)}
              y={padT}
              width={Math.max(24, plotW / points.length)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(active === i ? null : i)}
            />
          </g>
        ))}
      </svg>
      {activePoint && (
        <div className="absolute top-0 right-0 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
          <p className="font-semibold">総合 {activePoint.overall} / 10</p>
          <p className="text-muted-foreground">
            文法 {activePoint.grammar}・語彙 {activePoint.vocabulary}・流暢さ {activePoint.fluency}・継続力 {activePoint.engagement}
          </p>
          {activePoint.avgWordsPerTurn !== null && <p className="text-muted-foreground">1回あたり {activePoint.avgWordsPerTurn} 語</p>}
          <Link href={`/conversation/${activePoint.id}`} className="text-primary underline-offset-2 hover:underline">
            レポートを見る
          </Link>
        </div>
      )}
      <table className="sr-only">
        <caption>英会話スコアの推移</caption>
        <thead>
          <tr>
            <th>日付</th>
            <th>総合</th>
            <th>文法</th>
            <th>語彙</th>
            <th>流暢さ</th>
            <th>継続力</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.id}>
              <td>{new Date(p.startedAt).toLocaleDateString("ja-JP")}</td>
              <td>{p.overall}</td>
              <td>{p.grammar}</td>
              <td>{p.vocabulary}</td>
              <td>{p.fluency}</td>
              <td>{p.engagement}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
