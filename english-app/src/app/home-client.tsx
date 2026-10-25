"use client";

import Link from "next/link";
import { BookOpenCheck, Clock, Flame, History, MessagesSquare, PenLine, RotateCcw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/stats/stat-tile";
import { PlanCard } from "@/components/home/plan-card";
import { useFetch } from "@/hooks/use-fetch";
import { grammarCategoryLabel } from "@/lib/learning/grammar";
import { formatDurationJa } from "@/lib/utils";
import type { Stats } from "@/lib/server/stats";

const MENU = [
  { href: "/conversation", title: "AI英会話", desc: "音声でリアルタイムに会話", icon: MessagesSquare },
  { href: "/grammar", title: "英文法", desc: "AIが作る問題で練習", icon: BookOpenCheck },
  { href: "/writing", title: "英作文", desc: "添削と自然な英訳", icon: PenLine },
  { href: "/review", title: "復習", desc: "間違えた表現をもう一度", icon: RotateCcw },
];


function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "こんばんは";
  if (h < 11) return "おはようございます";
  if (h < 18) return "こんにちは";
  return "こんばんは";
}

export function HomeClient() {
  const { data: stats, error } = useFetch<Stats>("/api/stats");
  const lastConversation = stats?.recentConversations[0] ?? null;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          {greeting()}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight md:text-3xl">今日も少しずつ、話せる英語へ。</h1>
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="今日の学習状況">
        {stats ? (
          <>
            <StatTile icon={Clock} label="今日の学習時間" value={formatDurationJa(stats.todaySeconds)} />
            <StatTile icon={Flame} label="連続学習日数" value={`${stats.streak}日`} sub={stats.streak > 0 ? "この調子！" : "今日から始めよう"} />
            <StatTile icon={RotateCcw} label="今日の復習" value={`${stats.review.due}問`} sub={`登録 ${stats.review.total}問`} />
            <StatTile
              icon={Target}
              label="文法の正答率"
              value={stats.grammarAccuracy !== null ? `${stats.grammarAccuracy}%` : "—"}
              sub={`${stats.grammarAttempts}問 解答`}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        )}
      </section>

      <PlanCard stats={stats} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">学習メニュー</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <m.icon className="size-5" />
              </span>
              <p className="mt-3 font-semibold">{m.title}</p>
              <p className="text-sm text-muted-foreground">{m.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {stats && (lastConversation || stats.lastGrammarCategory) && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="size-5" /> 前回の続きから
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {lastConversation && (
              <Card className="min-w-0">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">前回の英会話・{formatDurationJa(lastConversation.durationSec)}</p>
                    <p className="truncate font-medium">{lastConversation.title}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/conversation/${lastConversation.id}`}>レポート</Link>
                    </Button>
                    {lastConversation.status === "reported" && (
                      <Button size="sm" asChild>
                        <Link href={`/conversation?practice=${lastConversation.id}`}>復習練習</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            {stats.lastGrammarCategory && (
              <Card className="min-w-0">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">前回の英文法</p>
                    <p className="truncate font-medium">{grammarCategoryLabel(stats.lastGrammarCategory)}</p>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/grammar?category=${stats.lastGrammarCategory}`}>続ける</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
