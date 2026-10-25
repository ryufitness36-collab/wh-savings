"use client";

import { useRef, useState } from "react";
import { ArrowRight, Languages, Loader2, PenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SpeakButton } from "@/components/speak-button";
import { useAppStatus } from "@/hooks/use-status";
import { useFetch } from "@/hooks/use-fetch";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { diffWords } from "@/lib/learning/diff";
import { cn } from "@/lib/utils";
import { WRITING_LEVELS, type TranslationResult, type WritingCorrection, type WritingLevel } from "@/lib/ai/schemas";
import type { WritingEntry } from "@/lib/server/writing";

const ISSUE_LABEL: Record<WritingCorrection["issues"][number]["type"], string> = {
  grammar: "文法",
  vocabulary: "語彙",
  naturalness: "自然さ",
  spelling: "スペル",
  punctuation: "句読点",
  style: "文体",
};

/** 入力を始めてからの時間を学習時間として記録するためのタイマー */
function useEditTimer() {
  const startedAt = useRef<number | null>(null);
  return {
    touch: () => {
      if (startedAt.current === null) startedAt.current = Date.now();
    },
    take: () => {
      const s = startedAt.current ? Math.min(1800, (Date.now() - startedAt.current) / 1000) : 60;
      startedAt.current = null;
      return Math.max(30, s);
    },
  };
}

export function WritingClient() {
  const { data: status } = useAppStatus();
  const disabled = status ? !status.openai : false;
  const history = useFetch<{ entries: WritingEntry[] }>("/api/writing");
  const [tab, setTab] = useState("correct");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">英作文</h1>
        <p className="mt-1 text-sm text-muted-foreground">自由に書いた英文をAIが添削します。日本語から自然な英語への翻訳もできます。</p>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="correct">
            <PenLine className="size-4" /> 添削
          </TabsTrigger>
          <TabsTrigger value="translate">
            <Languages className="size-4" /> 日本語→英語
          </TabsTrigger>
          <TabsTrigger value="history">履歴</TabsTrigger>
        </TabsList>
        <TabsContent value="correct">
          <CorrectPanel disabled={disabled} onSaved={history.reload} />
        </TabsContent>
        <TabsContent value="translate">
          <TranslatePanel disabled={disabled} onSaved={history.reload} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryPanel
            entries={history.data?.entries ?? []}
            loading={history.loading}
            onDelete={async (id) => {
              try {
                await apiFetch(`/api/writing/${id}`, { method: "DELETE" });
                history.setData((prev) => (prev ? { entries: prev.entries.filter((e) => e.id !== id) } : prev));
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          />
        </TabsContent>
      </Tabs>
      {disabled && <p className="text-sm text-destructive">添削・翻訳には OpenAI APIキーの設定が必要です。</p>}
    </div>
  );
}

function CorrectPanel({ disabled, onSaved }: { disabled: boolean; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [level, setLevel] = useState<WritingLevel>("casual");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ input: string; result: WritingCorrection } | null>(null);
  const timer = useEditTimer();

  const submit = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ result: WritingCorrection }>("/api/writing/correct", {
        method: "POST",
        json: { text, level, secondsSpent: timer.take() },
      });
      setResult({ input: text, result: res.result });
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">添削レベル</p>
            <Segmented value={level} onChange={setLevel} options={WRITING_LEVELS.map((l) => ({ value: l.id, label: l.label }))} ariaLabel="添削レベル" />
          </div>
          <Textarea
            value={text}
            onChange={(e) => {
              timer.touch();
              setText(e.target.value);
            }}
            placeholder={"例：I went to cafe yesterday. I drinked a coffee and it was very delicious."}
            className="min-h-40"
            maxLength={4000}
            spellCheck={false}
            aria-label="添削する英文"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">{text.length} / 4000</span>
            <Button onClick={submit} disabled={disabled || loading || !text.trim()} size="lg">
              {loading ? <Loader2 className="animate-spin" /> : <PenLine />}
              {loading ? "添削中…" : "添削する"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {result && <CorrectionResult input={result.input} result={result.result} />}
    </div>
  );
}

function CorrectionResult({ input, result }: { input: string; result: WritingCorrection }) {
  const parts = diffWords(input, result.corrected_text);
  const unchanged = input.trim() === result.corrected_text.trim();
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">修正前と修正後の比較</CardTitle>
          <CardDescription>
            <span className="rounded bg-removed-bg px-1 text-removed-fg line-through">削除</span>
            {" / "}
            <span className="rounded bg-added-bg px-1 text-added-fg">追加</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-secondary/60 p-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">修正前</p>
            <p className="text-[15px] leading-loose whitespace-pre-wrap">
              {parts.map((p, i) =>
                p.type === "added" ? null : (
                  <span key={i} className={cn(p.type === "removed" && "rounded bg-removed-bg text-removed-fg line-through")}>
                    {p.text}
                  </span>
                ),
              )}
            </p>
          </div>
          <div className="rounded-xl bg-secondary/60 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">修正後</p>
              <SpeakButton text={result.corrected_text} />
            </div>
            <p className="text-[15px] leading-loose whitespace-pre-wrap">
              {parts.map((p, i) =>
                p.type === "removed" ? null : (
                  <span key={i} className={cn(p.type === "added" && "rounded bg-added-bg font-medium text-added-fg")}>
                    {p.text}
                  </span>
                ),
              )}
            </p>
          </div>
          {unchanged && <p className="text-sm text-success md:col-span-2">修正の必要はありませんでした！</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">講評</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="leading-relaxed">{result.overall_comment_ja}</p>
        </CardContent>
      </Card>

      {result.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">修正のポイント（{result.issues.length}件）</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {result.issues.map((issue, i) => (
              <div key={i} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-[15px]">
                  <Badge variant="secondary">{ISSUE_LABEL[issue.type]}</Badge>
                  <span className="text-removed-fg line-through">{issue.original}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span className="font-medium text-added-fg">{issue.corrected}</span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{issue.explanation_ja}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {result.natural_alternatives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">より自然な表現の提案</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.natural_alternatives.map((a) => (
              <div key={a.text} className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{a.text}</p>
                  <p className="text-sm text-muted-foreground">{a.note_ja}</p>
                </div>
                <SpeakButton text={a.text} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TranslatePanel({ disabled, onSaved }: { disabled: boolean; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const timer = useEditTimer();

  const submit = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ result: TranslationResult }>("/api/writing/translate", {
        method: "POST",
        json: { text, secondsSpent: timer.take() },
      });
      setResult(res.result);
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 p-5">
          <Textarea
            value={text}
            onChange={(e) => {
              timer.touch();
              setText(e.target.value);
            }}
            placeholder="例：このコーヒーは酸味が少なくて、チョコレートのような味がします。"
            className="min-h-32"
            maxLength={2000}
            aria-label="英語にしたい日本語"
          />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={disabled || loading || !text.trim()} size="lg">
              {loading ? <Loader2 className="animate-spin" /> : <Languages />}
              {loading ? "翻訳中…" : "自然な英語にする"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {result && <TranslationView result={result} />}
    </div>
  );
}

function TranslationView({ result }: { result: TranslationResult }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
      <Card>
        <CardContent className="space-y-1 p-5">
          <p className="text-xs font-semibold text-muted-foreground">自然な英語</p>
          <div className="flex items-start justify-between gap-2">
            <p className="text-lg font-semibold leading-relaxed">{result.translation}</p>
            <SpeakButton text={result.translation} />
          </div>
          {result.notes_ja && <p className="pt-2 text-sm text-muted-foreground">{result.notes_ja}</p>}
        </CardContent>
      </Card>
      {result.alternatives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">別の言い方</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.alternatives.map((a) => (
              <div key={a.text} className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{a.text}</p>
                  <p className="text-sm text-muted-foreground">{a.nuance_ja}</p>
                </div>
                <SpeakButton text={a.text} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">文法・表現の解説</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.grammar_points.map((g) => (
            <div key={g.point}>
              <p className="font-medium">{g.point}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{g.explanation_ja}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryPanel({ entries, loading, onDelete }: { entries: WritingEntry[]; loading: boolean; onDelete: (id: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (loading && entries.length === 0) return <p className="text-sm text-muted-foreground">読み込み中…</p>;
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">まだ履歴はありません。</p>;
  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const open = openId === e.id;
        return (
          <Card key={e.id}>
            <div className="flex items-center gap-2 p-4">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(open ? null : e.id)} aria-expanded={open}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={e.kind === "correct" ? "default" : "secondary"}>{e.kind === "correct" ? "添削" : "翻訳"}</Badge>
                  {e.kind === "correct" && WRITING_LEVELS.find((l) => l.id === e.level)?.label}
                  <span>{new Date(e.createdAt).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                <p className="mt-1 truncate text-[15px]">{e.input}</p>
              </button>
              <Button variant="ghost" size="icon" aria-label="削除" onClick={() => onDelete(e.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            {open && (
              <CardContent>
                {e.kind === "correct" ? (
                  <CorrectionResult input={e.input} result={e.result as WritingCorrection} />
                ) : (
                  <TranslationView result={e.result as TranslationResult} />
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
