"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFetch } from "@/hooks/use-fetch";
import { useAppStatus } from "@/hooks/use-status";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { TrendFacts } from "@/lib/learning/trends";
import type { InsightsResult } from "@/lib/server/insights";

function HourlyBars({ hourly }: { hourly: number[] }) {
  const max = Math.max(1, ...hourly);
  return (
    <div>
      <div className="flex h-16 items-end gap-[2px]" role="img" aria-label="時間帯別の学習時間（直近60日）">
        {hourly.map((sec, h) => (
          <div
            key={h}
            title={`${h}時台：${Math.round(sec / 60)}分`}
            className="flex-1 rounded-t-[3px] bg-primary/70"
            style={{ height: `${Math.max(sec > 0 ? 6 : 1, (sec / max) * 100)}%`, opacity: sec > 0 ? 1 : 0.25 }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0時</span>
        <span>6時</span>
        <span>12時</span>
        <span>18時</span>
        <span>23時</span>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** 学習傾向：計算で分かる事実 ＋ AIによる分析（1日1回キャッシュ） */
export function InsightsCard({ facts }: { facts: TrendFacts }) {
  const { data: status } = useAppStatus();
  const cached = useFetch<{ insights: InsightsResult | null }>("/api/insights");
  const [loading, setLoading] = useState(false);
  const insights = cached.data?.insights ?? null;

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ insights: InsightsResult }>("/api/insights", { method: "POST" });
      cached.setData(() => ({ insights: res.insights }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const arrow = (c: { from: number; to: number } | null, unit: string) =>
    c ? `${c.from}${unit} → ${c.to}${unit}${c.to > c.from ? " ↑" : c.to < c.from ? " ↓" : ""}` : "データ不足";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-primary" /> 学習傾向の分析
        </CardTitle>
        <CardDescription>学習記録から計算した傾向と、AIによる分析</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Fact
            label="よく学習する時間帯"
            value={facts.bestTimeSlot !== null ? `${facts.bestTimeSlot}時〜${(facts.bestTimeSlot + 3) % 24}時` : "データ不足"}
          />
          <Fact label="学習した日の平均" value={facts.avgMinutesPerStudyDay !== null ? `${facts.avgMinutesPerStudyDay}分` : "データ不足"} />
          <Fact label="英会話スコア（総合）" value={arrow(facts.scoreChange, "")} />
          <Fact label="1回に話す語数" value={arrow(facts.wordsPerTurnChange, "語")} />
        </div>
        <HourlyBars hourly={facts.hourly} />

        {insights ? (
          <div className="space-y-3 rounded-xl bg-accent/50 p-4 text-sm">
            <p className="leading-relaxed">{insights.summary_ja}</p>
            <div className="grid gap-3 md:grid-cols-3">
              <List title="伸びている点" items={insights.strengths_ja} />
              <List title="課題" items={insights.challenges_ja} />
              <List title="来週やること" items={insights.recommendations_ja} />
            </div>
          </div>
        ) : null}

        {status?.openai && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {insights
                ? `分析：${new Date(insights.generatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`
                : "AIが学習データから、伸びている点・課題・来週やることをまとめます"}
            </p>
            <Button size="sm" variant={insights ? "ghost" : "default"} onClick={analyze} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : insights ? <RefreshCw /> : <Sparkles />}
              {loading ? "分析中…" : insights ? "分析し直す" : "AIで分析する"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{title}</p>
      <ul className="list-disc space-y-1 pl-4 leading-relaxed">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
