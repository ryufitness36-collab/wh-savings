"use client";

import { Headphones, Loader2, Mic, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  ACCENTS,
  ACCENT_INFO,
  CONVERSATION_MODES,
  DURATIONS,
  LEVELS,
  LEVEL_INFO,
  MODE_INFO,
  SPEEDS,
  SPEED_INFO,
  TEACHERS,
  type LessonSettings,
} from "@/lib/learning/lesson";

export function LessonSetup({
  settings,
  onChange,
  onStart,
  starting,
  disabledReason,
  practiceTitle,
}: {
  settings: LessonSettings;
  onChange: (s: LessonSettings) => void;
  onStart: () => void;
  starting: boolean;
  disabledReason: string | null;
  practiceTitle: string | null;
}) {
  const set = <K extends keyof LessonSettings>(key: K, value: LessonSettings[K]) => onChange({ ...settings, [key]: value });
  const mode = MODE_INFO[settings.mode];

  return (
    <div className="space-y-6">
      {practiceTitle && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-accent p-4 text-sm text-accent-foreground">
          <Repeat className="mt-0.5 size-4 shrink-0" />
          <p>
            <b>復習練習モード</b>：「{practiceTitle}」で間違えた表現を、AI講師が会話の中で使わせてくれます。
          </p>
        </div>
      )}

      <section aria-labelledby="mode-heading" className="space-y-3">
        <h2 id="mode-heading" className="text-sm font-semibold text-muted-foreground">会話モード</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {CONVERSATION_MODES.map((m) => {
            const info = MODE_INFO[m];
            const active = settings.mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ ...settings, mode: m, scenarioId: info.scenarios[0].id })}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98]",
                  active ? "border-primary bg-accent shadow-sm ring-1 ring-primary" : "bg-card hover:bg-secondary",
                )}
              >
                <span className="text-xl" aria-hidden>{info.emoji}</span>
                <span className="text-sm font-semibold">{info.label}</span>
                <span className="text-xs leading-snug text-muted-foreground">{info.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{mode.emoji} {mode.label}の場面</CardTitle>
          <CardDescription>練習したい場面を選んでください</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {mode.scenarios.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => set("scenarioId", sc.id)}
                aria-pressed={settings.scenarioId === sc.id}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition-all",
                  settings.scenarioId === sc.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
                )}
              >
                {sc.label}
              </button>
            ))}
          </div>
          {(settings.mode === "free_talk" || settings.mode === "discussion") && (
            <div className="space-y-2">
              <Label htmlFor="custom-topic">話したいテーマ（任意）</Label>
              <Input
                id="custom-topic"
                placeholder="例：最近見た映画、好きなカフェ、AIについて"
                value={settings.customTopic}
                maxLength={200}
                onChange={(e) => set("customTopic", e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">レッスン設定</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="レベル">
            <Segmented
              ariaLabel="レベル"
              value={settings.level}
              onChange={(v) => set("level", v)}
              options={LEVELS.map((l) => ({ value: l, label: LEVEL_INFO[l].label }))}
            />
            <p className="text-xs text-muted-foreground">CEFR {LEVEL_INFO[settings.level].cefr}</p>
          </Field>
          <Field label="時間">
            <Segmented
              ariaLabel="時間"
              value={settings.durationMinutes}
              onChange={(v) => set("durationMinutes", v)}
              options={DURATIONS.map((d) => ({ value: d, label: d === 0 ? "無制限" : `${d}分` }))}
            />
          </Field>
          <Field label="AI講師">
            <Segmented
              ariaLabel="AI講師"
              value={settings.teacherId}
              onChange={(v) => set("teacherId", v)}
              options={TEACHERS.map((t) => ({ value: t.id, label: t.name }))}
            />
            <p className="text-xs text-muted-foreground">{TEACHERS.find((t) => t.id === settings.teacherId)?.description}</p>
          </Field>
          <Field label="話す速度">
            <Segmented
              ariaLabel="話す速度"
              value={settings.speed}
              onChange={(v) => set("speed", v)}
              options={SPEEDS.map((s) => ({ value: s, label: SPEED_INFO[s].label }))}
            />
          </Field>
          <Field label="アクセント">
            <Segmented
              ariaLabel="アクセント"
              value={settings.accent}
              onChange={(v) => set("accent", v)}
              options={ACCENTS.map((a) => ({ value: a, label: ACCENT_INFO[a].label }))}
            />
            <p className="text-xs text-muted-foreground">
              専用の音声ではなく、AIへの指示でアクセントを寄せます（再現度は保証されません）。
            </p>
          </Field>
          <Field label="添削のタイミング">
            <Segmented
              ariaLabel="添削のタイミング"
              value={settings.correctionMode}
              onChange={(v) => set("correctionMode", v)}
              options={[
                { value: "after", label: "終了後にまとめて" },
                { value: "inline", label: "会話中に指摘" },
              ]}
            />
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-secondary/60 p-3.5 md:col-span-2">
            <div>
              <Label htmlFor="ja-support">日本語サポート</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                ON：日本語で「〜って英語でどう言えばいい？」と聞くと、日本語で説明してくれます
              </p>
            </div>
            <Switch id="ja-support" checked={settings.japaneseSupport} onCheckedChange={(v) => set("japaneseSupport", v)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
        <Headphones className="mt-0.5 size-4 shrink-0" />
        <span>イヤホン・ヘッドホンの使用がおすすめです（AIの声をマイクが拾いにくくなり、会話がスムーズになります）。</span>
      </div>
      <div className="sticky bottom-20 z-10 space-y-2 md:bottom-4">
        {disabledReason && <p className="rounded-lg bg-card/95 p-2 text-center text-sm text-destructive">{disabledReason}</p>}
        <Button size="lg" className="h-14 w-full text-base shadow-lg" onClick={onStart} disabled={starting || Boolean(disabledReason)}>
          {starting ? <Loader2 className="animate-spin" /> : <Mic />}
          {starting ? "準備中…" : "会話を始める"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}
