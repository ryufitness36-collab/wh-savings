"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpenCheck, Clock, Flame, MessagesSquare, PenLine, RotateCcw, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityChart } from "@/components/stats/activity-chart";
import { ScoreTrendChart } from "@/components/stats/score-trend-chart";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { StatTile } from "@/components/stats/stat-tile";
import { useFetch } from "@/hooks/use-fetch";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { weekStart } from "@/lib/learning/dates";
import { MODE_INFO, type ConversationMode } from "@/lib/learning/lesson";
import { formatDurationJa } from "@/lib/utils";
import type { Stats } from "@/lib/server/stats";

const STATUS_LABEL: Record<string, string> = {
  active: "未完了",
  finished: "レポート未作成",
  reported: "レポートあり",
  report_failed: "レポート失敗",
};

export function ProgressClient() {
  const { data: stats, error, setData } = useFetch<Stats>("/api/stats");
  const [range, setRange] = useState<"daily" | "weekly">("daily");
  const [editingGoal, setEditingGoal] = useState(false);

  const saveGoal = async (weeklyMinutes: number) => {
    try {
      await apiFetch("/api/goals", { method: "PUT", json: { weeklyMinutes } });
      setData((prev) => (prev ? { ...prev, weeklyGoalMinutes: weeklyMinutes } : prev));
      setEditingGoal(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">学習記録</h1>
        <p className="mt-1 text-sm text-muted-foreground">学習時間・履歴・苦手分野を確認して、復習につなげましょう。</p>
      </header>

      {!stats ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatTile icon={Clock} label="今日" value={formatDurationJa(stats.todaySeconds)} />
            <StatTile icon={Clock} label="累計学習時間" value={formatDurationJa(stats.totalSeconds)} />
            <StatTile icon={MessagesSquare} label="累計英会話" value={formatDurationJa(stats.totalConversationSeconds)} sub={`${stats.conversationCount}回`} />
            <StatTile icon={Flame} label="連続学習" value={`${stats.streak}日`} />
            <StatTile icon={BookOpenCheck} label="文法問題" value={`${stats.grammarAttempts}問`} sub={stats.grammarAccuracy !== null ? `正答率 ${stats.grammarAccuracy}%` : undefined} />
            <StatTile icon={PenLine} label="英作文" value={`${stats.writingCount}回`} />
          </section>

          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">今週の目標</CardTitle>
                <CardDescription className="mt-1">月曜日から日曜日までの学習時間</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditingGoal((v) => !v)}>
                {editingGoal ? "閉じる" : "目標を変更"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold tabular-nums">{formatDurationJa(stats.thisWeekSeconds)}</span>
                <span className="text-sm text-muted-foreground">目標 {formatDurationJa(stats.weeklyGoalMinutes * 60)}</span>
              </div>
              <Progress value={Math.min(100, (stats.thisWeekSeconds / 60 / stats.weeklyGoalMinutes) * 100)} aria-label="今週の目標の達成率" />
              <p className="text-sm text-muted-foreground">
                {stats.thisWeekSeconds / 60 >= stats.weeklyGoalMinutes
                  ? "今週の目標を達成しました！"
                  : `あと ${formatDurationJa(stats.weeklyGoalMinutes * 60 - stats.thisWeekSeconds)} で達成です`}
              </p>
              {editingGoal && (
                <Segmented
                  ariaLabel="週の目標時間"
                  value={stats.weeklyGoalMinutes}
                  onChange={(v) => void saveGoal(v)}
                  options={[60, 120, 180, 300, 420].map((m) => ({ value: m, label: formatDurationJa(m * 60) }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">学習時間の推移</CardTitle>
                <CardDescription className="mt-1">棒にカーソルを合わせる（タップする）と内訳が表示されます</CardDescription>
              </div>
              <Segmented
                className="w-auto"
                ariaLabel="期間"
                value={range}
                onChange={setRange}
                options={[
                  { value: "daily" as const, label: "日別（30日）" },
                  { value: "weekly" as const, label: "週別（12週）" },
                ]}
              />
            </CardHeader>
            <CardContent>
              {range === "daily" ? (
                <ActivityChart data={stats.daily} currentKey={stats.today} mode="daily" />
              ) : (
                <ActivityChart data={stats.weekly} currentKey={weekStart(stats.today)} mode="weekly" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessagesSquare className="size-4 text-primary" /> 英会話スコアの推移
              </CardTitle>
              <CardDescription>会話後レポートの4項目（文法・語彙・流暢さ・継続力）の平均。直近12回</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.conversationTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground">英会話のレポートが作成されると、ここにスコアの推移が表示されます。</p>
              ) : (
                <ScoreTrendChart points={stats.conversationTrend} />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="size-4 text-primary" /> 苦手な文法ランキング
                </CardTitle>
                <CardDescription>文法問題の誤答と、英会話・英作文での間違いから判定</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.weakCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">文法問題・英会話・英作文で間違えると、ここに苦手分野が表示されます。</p>
                ) : (
                  <ol className="space-y-3">
                    {stats.weakCategories.map((w, i) => (
                      <li key={w.category} className="flex items-center gap-3">
                        <span className="w-5 text-sm font-bold text-muted-foreground">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{w.label}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {w.attempts > 0 && `文法問題 誤答 ${w.wrong}/${w.attempts}（平均 ${w.avgScore}点）`}
                            {w.attempts > 0 && w.usageMistakes > 0 && "・"}
                            {w.usageMistakes > 0 && `会話・英作文での間違い ${w.usageMistakes}回`}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/grammar?category=${w.category}`}>練習</Link>
                        </Button>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <RotateCcw className="size-4 text-primary" /> 復習メニュー
                </CardTitle>
                <CardDescription>英会話・文法・英作文の間違いが自動で登録されます</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums">{stats.review.due}</span>
                  <span className="text-sm text-muted-foreground">問が復習のタイミング（登録 {stats.review.total}問）</span>
                </div>
                <Button asChild className="w-full">
                  <Link href="/review">復習を始める</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {stats.categoryAccuracy.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpenCheck className="size-4 text-primary" /> 分野別の正答率
                </CardTitle>
                <CardDescription>文法問題の正答率が低い順</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.categoryAccuracy.map((c) => (
                  <Link key={c.category} href={`/grammar?category=${c.category}`} className="block rounded-lg hover:bg-secondary/50">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{c.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {c.accuracy}%（{c.attempts}問）
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${c.accuracy}%` }} />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">英会話の履歴</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentConversations.length === 0 ? (
                <p className="text-sm text-muted-foreground">まだ英会話の記録はありません。</p>
              ) : (
                <ul className="divide-y">
                  {stats.recentConversations.map((c) => (
                    <li key={c.id}>
                      <Link href={`/conversation/${c.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                        <span className="text-xl" aria-hidden>
                          {MODE_INFO[c.mode as ConversationMode]?.emoji ?? "💬"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{c.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(c.startedAt).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" })}・{formatDurationJa(c.durationSec)}
                          </p>
                        </div>
                        <Badge variant={c.status === "reported" ? "success" : "secondary"}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">英作文の添削履歴</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/writing">すべて見る</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {stats.recentWriting.length === 0 ? (
                <p className="text-sm text-muted-foreground">まだ英作文の記録はありません。</p>
              ) : (
                <ul className="divide-y">
                  {stats.recentWriting.slice(0, 5).map((w) => (
                    <li key={w.id} className="flex items-center gap-3 py-3">
                      <Badge variant={w.kind === "correct" ? "default" : "secondary"}>{w.kind === "correct" ? "添削" : "翻訳"}</Badge>
                      <p className="min-w-0 flex-1 truncate text-sm">{w.input}</p>
                      <span className="text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleDateString("ja-JP")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
