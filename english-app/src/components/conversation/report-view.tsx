"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, MessageSquareText, Repeat, Sparkles, Star, Target, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SpeakButton } from "@/components/speak-button";
import { cn, formatDurationJa } from "@/lib/utils";
import type { ConversationReport } from "@/lib/ai/schemas";
import type { TranscriptEntry } from "@/lib/learning/transcript";

const SCORE_LABEL = {
  grammar: "文法",
  vocabulary: "語彙",
  fluency: "流暢さ",
  engagement: "会話の継続力",
} as const;

const TYPE_LABEL = {
  grammar: { label: "文法ミス", variant: "destructive" as const },
  naturalness: { label: "不自然な表現", variant: "warning" as const },
  vocabulary: { label: "語彙", variant: "secondary" as const },
};

export function ReportView({
  conversationId,
  report,
  transcript,
}: {
  conversationId: string;
  report: ConversationReport;
  transcript: TranscriptEntry[];
}) {
  const m = report.metrics;
  const groups = (["grammar", "naturalness", "vocabulary"] as const)
    .map((type) => ({ type, items: report.corrections.filter((c) => c.type === type) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" /> 会話の要約
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="leading-relaxed">{report.summary_ja}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">評価</CardTitle>
          <CardDescription>文字起こしと計測データから観察できる項目で評価しています。発音は音声分析を行っていないため評価していません。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(SCORE_LABEL) as (keyof typeof SCORE_LABEL)[]).map((key) => {
              const s = report.scores[key];
              return (
                <div key={key} className="rounded-xl bg-secondary/60 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{SCORE_LABEL[key]}</span>
                    <span className="text-xl font-bold tabular-nums">
                      {s.score}
                      <span className="text-xs font-normal text-muted-foreground"> / 10</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${s.score * 10}%` }} />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.comment_ja}</p>
                </div>
              );
            })}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Metric label="会話時間" value={formatDurationJa(m.durationSec)} />
            <Metric label="あなたの発言回数" value={`${m.userTurns}回`} />
            <Metric label="話した英単語数" value={`${m.userWords}語`} />
            <Metric label="1回あたりの語数" value={`${m.avgWordsPerTurn}語`} />
            <Metric label="発話時間の割合" value={m.userSpeakingRatio !== null ? `${Math.round(m.userSpeakingRatio * 100)}%` : "計測なし"} />
            <Metric label="話す速さ" value={m.wordsPerMinute !== null ? `${m.wordsPerMinute}語/分` : "計測なし"} />
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Target className="size-5 text-primary" /> 添削
          </h2>
          {report.corrections.length > 0 && (
            <Button asChild size="sm">
              <Link href={`/conversation?practice=${conversationId}`}>
                <Repeat /> もう一度練習する
              </Link>
            </Button>
          )}
        </div>
        {groups.length === 0 ? (
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">大きな誤りは見つかりませんでした。素晴らしいです！</CardContent>
          </Card>
        ) : (
          groups.map((g) => (
            <div key={g.type} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {TYPE_LABEL[g.type].label}（{g.items.length}件）
              </h3>
              {g.items.map((c, i) => (
                <Card key={`${g.type}-${i}`}>
                  <CardContent className="space-y-3 p-5 text-[15px]">
                    <Block label="自分が話した英文">
                      <p className="text-removed-fg">{c.original}</p>
                    </Block>
                    <Block label="より自然な英文">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-added-fg">{c.corrected}</p>
                        <SpeakButton text={c.corrected} />
                      </div>
                    </Block>
                    <Block label="解説">
                      <p className="leading-relaxed text-muted-foreground">{c.explanation_ja}</p>
                    </Block>
                    {c.related.length > 0 && (
                      <Block label="関連する表現">
                        <ul className="space-y-1">
                          {c.related.map((r) => (
                            <li key={r} className="flex items-center justify-between gap-2">
                              <span>{r}</span>
                              <SpeakButton text={r} />
                            </li>
                          ))}
                        </ul>
                      </Block>
                    )}
                    <Badge variant={TYPE_LABEL[g.type].variant}>{TYPE_LABEL[g.type].label}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ThumbsUp className="size-4 text-success" /> よく使えた表現
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.good_expressions.length === 0 ? (
              <p className="text-sm text-muted-foreground">次回は自分の言葉でたくさん話してみましょう。</p>
            ) : (
              <ul className="space-y-3">
                {report.good_expressions.map((g) => (
                  <li key={g.expression}>
                    <p className="font-medium">“{g.expression}”</p>
                    <p className="text-sm text-muted-foreground">{g.comment_ja}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4 text-primary" /> 次回の改善ポイント
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              {report.improvement_points_ja.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="size-4 text-warning" /> 復習したいフレーズ
          </CardTitle>
          <CardDescription>添削した英文は自動で「復習」に登録されました。</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {report.review_phrases.map((p) => (
            <div key={p.phrase} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="font-semibold">{p.phrase}</p>
                <p className="text-sm text-muted-foreground">{p.meaning_ja}</p>
                <p className="mt-1 text-sm italic">{p.example}</p>
              </div>
              <SpeakButton text={p.phrase} />
            </div>
          ))}
        </CardContent>
      </Card>

      <TranscriptPanel transcript={transcript} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">【{label}】</p>
      {children}
    </div>
  );
}

export function TranscriptPanel({ transcript }: { transcript: TranscriptEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button type="button" className="flex w-full items-center justify-between p-5 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="flex items-center gap-2 font-semibold">
          <MessageSquareText className="size-4" /> 会話の文字起こし
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <CardContent className="space-y-2">
          {transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">文字起こしは保存されていません（設定で「文字起こしを保存」をOFFにしている場合、レポート作成後に削除されます）。</p>
          ) : (
            transcript.map((t) => (
              <p key={t.id} className="text-sm leading-relaxed">
                <span className={cn("mr-2 font-semibold", t.role === "user" ? "text-primary" : "text-muted-foreground")}>
                  {t.role === "user" ? "あなた" : "講師"}
                </span>
                {t.text}
              </p>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}
