"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpenCheck, Loader2, MessagesSquare, PenLine, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useAppStatus } from "@/hooks/use-status";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { buildPlan, PLAN_MINUTES, type PlanItem, type PlanMinutes } from "@/lib/learning/planner";
import type { AiPlanResult } from "@/lib/server/planner";
import type { Stats } from "@/lib/server/stats";

const PLAN_ICON = { review: RotateCcw, grammar: BookOpenCheck, conversation: MessagesSquare, writing: PenLine };

/**
 * 今日のおすすめ学習。
 * - AIプラン：学習データをAIが分析して作成（1日1回キャッシュ、作り直しも可）
 * - 簡易プラン：APIキーがない・AIプラン未作成のときのルールベース版（無料）
 */
export function PlanCard({ stats }: { stats: Stats | null }) {
  const { data: status } = useAppStatus();
  const [minutes, setMinutes] = useLocalStorage<PlanMinutes>("plan-minutes", 15);
  const cached = useFetch<{ plan: AiPlanResult | null }>(`/api/planner?minutes=${minutes}`);
  const [generating, setGenerating] = useState(false);

  const aiPlan = cached.data?.plan ?? null;
  const rulePlan = stats
    ? buildPlan(
        {
          reviewDue: stats.review.due,
          weakCategory: stats.weakCategories[0]?.category ?? null,
          lastGrammarCategory: stats.lastGrammarCategory,
          daysSinceConversation: stats.daysSinceLastConversation,
        },
        minutes,
      )
    : [];

  const generate = async () => {
    setGenerating(true);
    try {
      const { plan } = await apiFetch<{ plan: AiPlanResult }>("/api/planner", { method: "POST", json: { minutes } });
      cached.setData(() => ({ plan }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            今日のおすすめ学習
            {aiPlan && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                <Sparkles className="size-3" /> AIプラン
              </span>
            )}
          </CardTitle>
          <CardDescription className="mt-1">
            {aiPlan ? "あなたの学習データをAIが分析して作成しました" : "復習の期限・苦手分野・最近の学習から自動で組み立てています"}
          </CardDescription>
        </div>
        <Segmented
          className="w-auto"
          value={minutes}
          onChange={setMinutes}
          options={PLAN_MINUTES.map((m) => ({ value: m, label: `${m}分` }))}
          ariaLabel="学習時間"
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {!stats || cached.loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            {aiPlan?.message && <p className="rounded-xl bg-accent/60 p-3 text-sm leading-relaxed text-accent-foreground">{aiPlan.message}</p>}
            <PlanList items={aiPlan?.items ?? rulePlan} />
          </>
        )}
        {status?.openai && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-muted-foreground">
              {aiPlan
                ? `作成：${new Date(aiPlan.generatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`
                : "AIがあなたの苦手分野や前回の会話をもとに、理由つきでメニューを作ります"}
            </p>
            <Button size="sm" variant={aiPlan ? "ghost" : "default"} onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="animate-spin" /> : aiPlan ? <RefreshCw /> : <Sparkles />}
              {generating ? "作成中…" : aiPlan ? "作り直す" : "AIでプランを作る"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlanList({ items }: { items: PlanItem[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => {
        const Icon = PLAN_ICON[item.kind];
        return (
          <li key={`${item.kind}-${i}`}>
            <Link
              href={item.href}
              className="group flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-all hover:border-primary/40 hover:bg-accent/50 active:scale-[0.99]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium">
                  <Icon className="size-4 shrink-0 text-primary" />
                  {item.title}
                </p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
                {item.reason && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">💡 {item.reason}</p>}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">約{item.minutes}分</span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
