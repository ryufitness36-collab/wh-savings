"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, PartyPopper, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SpeakButton } from "@/components/speak-button";
import { useFetch } from "@/hooks/use-fetch";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { answersMatch } from "@/lib/learning/grading";
import { RATING_LABEL, type ReviewRating } from "@/lib/learning/srs";
import { cn } from "@/lib/utils";

interface ReviewItem {
  id: string;
  source: "conversation" | "grammar" | "writing";
  prompt: string;
  answer: string;
  explanation: string;
  reps: number;
}

const SOURCE_LABEL = { conversation: "英会話", grammar: "英文法", writing: "英作文" };
const RATINGS: ReviewRating[] = ["again", "hard", "good", "easy"];
const RATING_HINT: Record<ReviewRating, string> = {
  again: "10分後",
  hard: "短めの間隔",
  good: "標準の間隔",
  easy: "長めの間隔",
};

function secondsSince(start: number, max: number) {
  return Math.min(max, Math.max(0, (Date.now() - start) / 1000));
}

export function ReviewClient() {
  const { data, loading, error } = useFetch<{ items: ReviewItem[]; counts: { total: number; due: number } }>("/api/review");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(0);

  const items = data?.items ?? [];
  const item = items[index];
  const itemId = item?.id;

  useEffect(() => {
    if (itemId) shownAt.current = Date.now();
  }, [itemId]);

  const next = () => {
    setIndex((i) => i + 1);
    setAnswer("");
    setRevealed(false);
  };

  const rate = async (rating: ReviewRating) => {
    if (!item) return;
    setBusy(true);
    try {
      const secondsSpent = secondsSince(shownAt.current, 300);
      await apiFetch(`/api/review/${item.id}`, { method: "POST", json: { rating, secondsSpent } });
      next();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!item) return;
    try {
      await apiFetch(`/api/review/${item.id}`, { method: "DELETE" });
      toast.success("復習リストから外しました");
      next();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">復習</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          間違えた表現を、忘れかけたタイミングで出題します（間隔反復）。自己評価に合わせて次の出題日が決まります。
        </p>
      </header>

      {loading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !item ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <PartyPopper className="size-10 text-primary" />
            <p className="text-lg font-semibold">{items.length > 0 ? "今日の復習は完了です！" : "今は復習する問題はありません"}</p>
            <p className="text-sm text-muted-foreground">
              英会話・文法問題・英作文で間違えた表現が自動で登録され、翌日以降に出題されます。
              {data && data.counts.total > 0 && `（登録済み ${data.counts.total}問）`}
            </p>
            <div className="flex gap-2 pt-2">
              <Button asChild>
                <Link href="/conversation">英会話する</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/grammar">文法問題</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground tabular-nums">
              <span>復習中</span>
              <span>
                {index + 1} / {items.length}
              </span>
            </div>
            <Progress value={(index / items.length) * 100} />
          </div>
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{SOURCE_LABEL[item.source]}</Badge>
                {item.reps > 0 && <Badge variant="outline">{item.reps}回目の正解済み</Badge>}
              </div>
              <CardTitle className="pt-2 text-lg leading-relaxed whitespace-pre-wrap">{item.prompt}</CardTitle>
              <CardDescription>答えを入力（または頭の中で考えて）から「答えを見る」を押してください</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="英文を入力（任意）"
                disabled={revealed}
                className="min-h-20"
                spellCheck={false}
                autoCapitalize="off"
              />
              {!revealed ? (
                <Button className="w-full" size="lg" onClick={() => setRevealed(true)}>
                  <Eye /> 答えを見る
                </Button>
              ) : (
                <div className="animate-in fade-in space-y-4">
                  <div className="rounded-xl bg-secondary/60 p-4">
                    <p className="text-xs font-semibold text-muted-foreground">模範解答</p>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-lg font-semibold text-added-fg">{item.answer}</p>
                      <SpeakButton text={item.answer} />
                    </div>
                    {answer.trim() && (
                      <p className={cn("mt-2 flex items-center gap-1.5 text-sm", answersMatch(answer, item.answer) ? "text-success" : "text-muted-foreground")}>
                        {answersMatch(answer, item.answer) && <CheckCircle2 className="size-4" />}
                        {answersMatch(answer, item.answer) ? "模範解答と一致しました！" : "あなたの答えと比べて、自己評価してください"}
                      </p>
                    )}
                    {item.explanation && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.explanation}</p>}
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">どのくらいできましたか？</p>
                    <div className="grid grid-cols-4 gap-2">
                      {RATINGS.map((r) => (
                        <Button
                          key={r}
                          variant={r === "again" ? "outline" : r === "good" ? "default" : "secondary"}
                          className="h-auto flex-col gap-0 py-2.5"
                          disabled={busy}
                          onClick={() => void rate(r)}
                        >
                          <span>{RATING_LABEL[r]}</span>
                          <span className="text-[10px] font-normal opacity-70">{RATING_HINT[r]}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={archive} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <Trash2 className="size-3" /> もう覚えたので復習リストから外す
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
