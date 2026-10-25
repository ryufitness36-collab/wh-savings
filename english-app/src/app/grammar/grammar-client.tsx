"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Lightbulb, Loader2, RotateCcw, Sparkles, Target, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Textarea } from "@/components/ui/textarea";
import { SpeakButton } from "@/components/speak-button";
import { useAppStatus } from "@/hooks/use-status";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import type { GradeResult } from "@/lib/ai/schemas";
import {
  GRAMMAR_CATEGORIES,
  GRAMMAR_LEVELS,
  QUESTION_FORMATS,
  formatLabel,
  grammarCategoryLabel,
  type GrammarCategoryId,
  type GrammarLevelId,
  type GrammarQuestion,
  type QuestionFormat,
} from "@/lib/learning/grammar";

interface Answered {
  question: GrammarQuestion;
  answer: string;
  result: GradeResult;
}

type Phase = "select" | "loading" | "quiz" | "summary";

export function GrammarClient() {
  const params = useSearchParams();
  const { data: status } = useAppStatus();
  const initialCategory = GRAMMAR_CATEGORIES.find((c) => c.id === params.get("category"))?.id ?? "present_perfect";
  const [category, setCategory] = useState<GrammarCategoryId>(initialCategory);
  const [level, setLevel] = useState<GrammarLevelId>("basic");
  const [format, setFormat] = useState<QuestionFormat | "mixed">("mixed");
  const [count, setCount] = useState(Number(params.get("count")) || 5);

  const [phase, setPhase] = useState<Phase>("select");
  const [questions, setQuestions] = useState<GrammarQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);

  const [focus, setFocus] = useState<"none" | "weak">(params.get("focus") === "weak" ? "weak" : "none");

  const start = async (nextFocus: "none" | "weak" = focus) => {
    setPhase("loading");
    setFocus(nextFocus);
    try {
      const res = await apiFetch<{ questions: GrammarQuestion[]; category: GrammarCategoryId; focused: boolean }>("/api/grammar/questions", {
        method: "POST",
        json: { category, level, format, count, focus: nextFocus },
      });
      if (nextFocus === "weak") {
        setCategory(res.category);
        toast.message(
          res.focused
            ? `苦手分野「${grammarCategoryLabel(res.category)}」を、最近の間違いに合わせて出題します`
            : `「${grammarCategoryLabel(res.category)}」から出題します（まだ間違いの記録が少ないため）`,
        );
      }
      setQuestions(res.questions);
      setIndex(0);
      setAnswered([]);
      setPhase("quiz");
    } catch (e) {
      toast.error(errorMessage(e));
      setPhase("select");
    }
  };

  if (phase === "quiz" && questions[index]) {
    const current = questions[index];
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{grammarCategoryLabel(category)}・{GRAMMAR_LEVELS.find((l) => l.id === level)?.label}</span>
            <span className="tabular-nums">
              {index + 1} / {questions.length}
            </span>
          </div>
          <Progress value={((index + (answered.length > index ? 1 : 0)) / questions.length) * 100} />
        </div>
        <QuestionCard
          key={current.id}
          question={current}
          onGraded={(answer, result) => setAnswered((a) => [...a, { question: current, answer, result }])}
          onNext={() => {
            if (index + 1 < questions.length) setIndex(index + 1);
            else setPhase("summary");
          }}
          isLast={index + 1 === questions.length}
        />
      </div>
    );
  }

  if (phase === "summary") {
    const total = answered.reduce((s, a) => s + a.result.score, 0);
    const max = answered.length * 10;
    const wrong = answered.filter((a) => !a.result.is_correct).length;
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Sparkles className="size-8 text-primary" />
            <p className="text-sm text-muted-foreground">今回の得点</p>
            <p className="text-5xl font-bold tabular-nums">
              {total}
              <span className="text-xl font-medium text-muted-foreground"> / {max}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {wrong > 0 ? `間違えた ${wrong} 問は「復習」に登録しました。` : "全問正解です！素晴らしい！"}
            </p>
          </CardContent>
        </Card>
        <div className="space-y-2">
          {answered.map((a, i) => (
            <div key={a.question.id} className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
              {a.result.is_correct ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground">
                  Q{i + 1}. {a.question.prompt}
                </p>
                <p className="mt-1">
                  あなた：{a.answer || "（未回答）"} → <b>{a.result.model_answer}</b>
                </p>
              </div>
              <span className="font-semibold tabular-nums">{a.result.score}点</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void start()}>
            <RotateCcw /> 同じ設定でもう一度
          </Button>
          <Button variant="outline" onClick={() => setPhase("select")}>
            分野を選び直す
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">英文法</h1>
        <p className="mt-1 text-sm text-muted-foreground">AIが問題を作成し、意味と文法から採点します。別の正しい言い方も正解になります。</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">文法カテゴリ</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {GRAMMAR_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={cn(
                "rounded-xl border p-3.5 text-left text-sm font-medium transition-all active:scale-[0.98]",
                category === c.id ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary" : "bg-card hover:bg-secondary",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">出題設定</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">難易度</p>
            <Segmented value={level} onChange={setLevel} options={GRAMMAR_LEVELS.map((l) => ({ value: l.id, label: l.label }))} ariaLabel="難易度" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">問題数</p>
            <Segmented value={count} onChange={setCount} options={[3, 5, 10].map((n) => ({ value: n, label: `${n}問` }))} ariaLabel="問題数" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <p className="text-sm font-medium">問題形式</p>
            <Segmented
              value={format}
              onChange={setFormat}
              options={[{ value: "mixed" as const, label: "ミックス" }, ...QUESTION_FORMATS.map((f) => ({ value: f.id, label: f.label }))]}
              ariaLabel="問題形式"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Button size="lg" className="h-14 text-base" onClick={() => void start("none")} disabled={phase === "loading" || (status ? !status.openai : false)}>
          {phase === "loading" ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {phase === "loading" ? "AIが問題を作成中…" : "問題を作成して始める"}
        </Button>
        <Button
          size="lg"
          variant={focus === "weak" ? "default" : "outline"}
          className={cn("h-14 text-base", focus === "weak" && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background")}
          onClick={() => void start("weak")}
          disabled={phase === "loading" || (status ? !status.openai : false)}
          title="一番苦手な分野を自動で選び、最近の間違いと同じ文法ポイントを出題します"
        >
          <Target /> 苦手克服ドリル
        </Button>
      </div>
      {status && !status.openai && <p className="text-center text-sm text-destructive">問題の作成には OpenAI APIキーの設定が必要です。</p>}
    </div>
  );
}

function QuestionCard({
  question: q,
  onGraded,
  onNext,
  isLast,
}: {
  question: GrammarQuestion;
  onGraded: (answer: string, result: GradeResult) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [picked, setPicked] = useState<number[]>([]); // 並べ替え：選んだ語句の位置
  const [showHint, setShowHint] = useState(false);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const reorderAnswer = picked.map((i) => q.options[i]).join(" ");
  const finalAnswer = q.format === "reorder" ? reorderAnswer : answer;

  const submit = async (value = finalAnswer) => {
    setGrading(true);
    try {
      const secondsSpent = Math.min(600, (Date.now() - startedAt.current) / 1000);
      const { result } = await apiFetch<{ result: GradeResult }>("/api/grammar/grade", {
        method: "POST",
        json: { question: q, userAnswer: value, secondsSpent },
      });
      setResult(result);
      onGraded(value, result);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>{formatLabel(q.format)}</Badge>
            <Badge variant="secondary">{q.grammar_point}</Badge>
          </div>
          <CardDescription className="pt-1">{q.instruction_ja}</CardDescription>
          <CardTitle className="pt-1 text-lg leading-relaxed md:text-xl">{q.prompt}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {q.format === "multiple_choice" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o) => {
                const isAnswer = result && o === q.correct_answer;
                const isWrongPick = result && o === answer && !result.is_correct;
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={Boolean(result) || grading}
                    onClick={() => {
                      setAnswer(o);
                      void submit(o);
                    }}
                    className={cn(
                      "rounded-xl border p-4 text-left text-[15px] font-medium transition-all active:scale-[0.98] disabled:cursor-default",
                      isAnswer && "border-success bg-success/10",
                      isWrongPick && "border-destructive bg-destructive/10",
                      !result && answer === o && "border-primary bg-accent",
                      !result && "hover:bg-secondary",
                    )}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          ) : q.format === "reorder" ? (
            <div className="space-y-3">
              <div className="flex min-h-14 flex-wrap gap-2 rounded-xl border-2 border-dashed p-3" aria-label="あなたの答え">
                {picked.length === 0 && <span className="text-sm text-muted-foreground">下の語句をタップして並べてください</span>}
                {picked.map((i, pos) => (
                  <button
                    key={`${i}-${pos}`}
                    type="button"
                    disabled={Boolean(result)}
                    onClick={() => setPicked(picked.filter((_, p) => p !== pos))}
                    className="rounded-lg bg-primary px-3 py-1.5 text-[15px] text-primary-foreground shadow-sm"
                  >
                    {q.options[i]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {q.options.map((word, i) =>
                  picked.includes(i) ? null : (
                    <button
                      key={`${word}-${i}`}
                      type="button"
                      disabled={Boolean(result)}
                      onClick={() => setPicked([...picked, i])}
                      className="rounded-lg border bg-card px-3 py-1.5 text-[15px] shadow-xs transition-all hover:bg-secondary active:scale-95"
                    >
                      {word}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : (
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={q.format === "fill_blank" ? "空欄に入る語句" : "英文を入力"}
              disabled={Boolean(result)}
              className="min-h-20"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && answer.trim()) void submit();
              }}
            />
          )}

          {q.hint_ja && !result && (
            <div>
              {showHint ? (
                <p className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
                  {q.hint_ja}
                </p>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setShowHint(true)}>
                  <Lightbulb /> ヒントを見る
                </Button>
              )}
            </div>
          )}

          {!result && q.format !== "multiple_choice" && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => void submit()}
              disabled={grading || (q.format === "reorder" ? picked.length !== q.options.length : !answer.trim())}
            >
              {grading && <Loader2 className="animate-spin" />}
              {grading ? "採点中…" : "採点する"}
            </Button>
          )}
          {grading && q.format === "multiple_choice" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 採点中…
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className={cn("animate-in fade-in slide-in-from-bottom-2", result.is_correct ? "border-success/40" : "border-destructive/40")}>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className={cn("flex items-center gap-2 text-lg font-bold", result.is_correct ? "text-success" : "text-destructive")}>
                {result.is_correct ? <CheckCircle2 /> : <XCircle />}
                {result.verdict_ja}
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {result.score}
                <span className="text-sm font-normal text-muted-foreground"> / 10点</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">模範解答</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold">
                  {q.format === "multiple_choice" || q.format === "fill_blank" ? q.prompt.replace("___", `【${result.model_answer}】`) : result.model_answer}
                </p>
                <SpeakButton text={q.format === "multiple_choice" || q.format === "fill_blank" ? q.prompt.replace("___", result.model_answer).replace(/（.*?）|\(.*?\)/g, "") : result.model_answer} />
              </div>
            </div>
            {result.mistakes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">間違いのポイント</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {result.mistakes.map((m, i) => (
                    <li key={i}>
                      <span className="text-removed-fg line-through">{m.part}</span> → <span className="font-medium text-added-fg">{m.fix}</span>
                      <span className="text-muted-foreground">：{m.reason_ja}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground">解説</p>
              <p className="mt-1 text-sm leading-relaxed">{result.explanation_ja}</p>
            </div>
            {result.alternatives.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">別の正しい言い方</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                  {result.alternatives.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button className="w-full" size="lg" onClick={onNext}>
              {isLast ? "結果を見る" : "次の問題"} <ArrowRight />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
