"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, CaptionsOff, Hand, Keyboard, Loader2, Mic, MicOff, PhoneOff, RefreshCw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatClock } from "@/lib/utils";
import type { useRealtimeConversation } from "@/hooks/use-realtime-conversation";
import { TutorAvatar } from "./tutor-avatar";
import { MicHelp } from "./mic-help";

type Session = ReturnType<typeof useRealtimeConversation>;

const STATUS_LABEL: Record<string, string> = {
  idle: "待機中",
  requesting_mic: "マイクの許可を確認中…",
  connecting: "AI講師に接続中…",
  connected: "接続中",
  reconnecting: "再接続中…",
  disconnected: "接続が切れました",
  ending: "保存中…",
  ended: "終了しました",
  error: "エラー",
};

export function LiveSession({
  session,
  title,
  teacherName,
  timeLimitSec,
  onEnd,
  onRetry,
}: {
  session: Session;
  title: string;
  teacherName: string;
  timeLimitSec: number | null;
  onEnd: () => void;
  onRetry: () => void;
}) {
  const { status, aiState, entries, error, notice, micEnabled, elapsedSec, wrappingUp } = session;
  const [subtitles, setSubtitles] = useState(true);
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新しい発言が来たら一番下までスクロール
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [entries]);

  const connected = status === "connected";
  const busy = status === "requesting_mic" || status === "connecting" || status === "reconnecting";
  const remaining = timeLimitSec ? Math.max(0, timeLimitSec - elapsedSec) : null;
  const stats = session.getSpeakingStats();
  const totalSpeak = stats.user + stats.ai;
  const userRatio = totalSpeak > 5 ? Math.round((stats.user / totalSpeak) * 100) : null;

  const stateText = !connected
    ? STATUS_LABEL[status]
    : wrappingUp
      ? "時間になりました。まとめに入ります…"
      : !micEnabled
        ? "マイクがOFFです"
        : aiState === "speaking"
          ? `${teacherName} が話しています（話し始めると割り込めます）`
          : aiState === "thinking"
            ? "考え中…"
            : aiState === "user_speaking"
              ? "聞いています…"
              : "あなたの番です。英語で話してみましょう";

  return (
    <div className="flex h-[calc(100dvh-11.5rem)] min-h-[520px] flex-col gap-3 md:h-[calc(100dvh-5rem)]">
      {/* 上部：タイトル・時間・字幕切り替え */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold md:text-lg">{title}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={connected ? "success" : status === "disconnected" || status === "error" ? "destructive" : "secondary"}>
              <span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-muted-foreground")} />
              {STATUS_LABEL[status]}
            </Badge>
            {userRatio !== null && <span>あなたの発話 {userRatio}%</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right font-mono text-sm tabular-nums" aria-label="経過時間">
            {formatClock(elapsedSec)}
            {remaining !== null && <div className="text-[11px] text-muted-foreground">残り {formatClock(remaining)}</div>}
          </div>
          <Button
            variant={subtitles ? "secondary" : "outline"}
            size="icon"
            onClick={() => setSubtitles((v) => !v)}
            aria-pressed={subtitles}
            aria-label={subtitles ? "字幕を非表示にする" : "字幕を表示する"}
            title={subtitles ? "字幕：ON" : "字幕：OFF"}
          >
            {subtitles ? <Captions /> : <CaptionsOff />}
          </Button>
        </div>
      </div>

      {/* 中央：アバターと状態 */}
      <div className="flex flex-col items-center gap-3 py-2">
        <TutorAvatar name={teacherName} aiState={aiState} status={status} size={entries.length > 0 && subtitles ? "md" : "lg"} />
        <p className="min-h-5 text-center text-sm font-medium text-muted-foreground" aria-live="polite">
          {busy && <Loader2 className="mr-1.5 inline size-4 animate-spin" />}
          {stateText}
        </p>
      </div>

      {error && (status === "error" || status === "disconnected") && (
        <div className="space-y-3">
          {error.kind.startsWith("mic") || error.kind === "insecure_context" ? (
            <MicHelp error={error} />
          ) : (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error.message}</div>
          )}
        </div>
      )}

      {notice && !error && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-warning/15 px-4 py-2.5 text-sm">
          <span>{notice}</span>
          <button onClick={session.dismissNotice} aria-label="閉じる" className="text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* 字幕（会話の文字起こし） */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-2xl border bg-card/60 p-4"
        aria-label="会話の字幕"
        aria-live="polite"
      >
        {!subtitles ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <CaptionsOff className="size-6" />
            字幕はOFFです。耳だけで聞き取ってみましょう。
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            {connected ? `${teacherName} が話しかけてきます…` : "ここに会話の英語字幕が表示されます"}
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className={cn("flex", e.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-xs",
                  e.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary",
                  e.partial && "opacity-70",
                )}
              >
                {e.text || <span className="italic opacity-70">{e.role === "user" ? "（文字起こし中…）" : "…"}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {textMode && connected && (
        <form
          className="flex gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (session.sendText(text)) setText("");
          }}
        >
          <Input
            autoFocus
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            placeholder="英語で入力（日本語で「〜って英語で何て言う？」もOK）"
            maxLength={500}
            aria-label="テキストで送る"
          />
          <Button type="submit" size="icon" disabled={!text.trim()} aria-label="送信">
            <Send />
          </Button>
        </form>
      )}

      {/* 下部：操作ボタン */}
      <div className="flex items-center justify-center gap-3 pb-1 md:gap-5">
        {status === "disconnected" || status === "error" ? (
          <>
            <Button size="lg" onClick={status === "error" ? onRetry : session.reconnect} className="h-14 px-6">
              <RefreshCw />
              {status === "error" ? "もう一度試す" : "再接続"}
            </Button>
            {status === "disconnected" && (
              <Button size="lg" variant="outline" onClick={onEnd} className="h-14 px-6">
                終了してレポートへ
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="icon-lg"
              onClick={() => setTextMode((v) => !v)}
              aria-pressed={textMode}
              aria-label="テキスト入力"
              title="テキストで送る"
              disabled={!connected}
            >
              <Keyboard className="size-5" />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              onClick={session.interrupt}
              disabled={!connected || aiState !== "speaking"}
              aria-label="AIの発話を止める"
              title="AIの発話を止める（割り込み）"
            >
              <Hand className="size-5" />
            </Button>
            <button
              type="button"
              onClick={session.toggleMic}
              disabled={!connected}
              aria-pressed={micEnabled}
              aria-label={micEnabled ? "マイクをOFFにする" : "マイクをONにする"}
              className={cn(
                "relative flex size-20 items-center justify-center rounded-full shadow-lg transition-all active:scale-95 disabled:opacity-50",
                micEnabled ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {micEnabled && connected && aiState === "user_speaking" && (
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/40" />
              )}
              {micEnabled ? <Mic className="size-8" /> : <MicOff className="size-8" />}
            </button>
            <Button
              variant="destructive"
              size="icon-lg"
              onClick={onEnd}
              disabled={status === "ending"}
              aria-label="会話を終了"
              title="会話を終了"
            >
              {status === "ending" ? <Loader2 className="size-5 animate-spin" /> : <PhoneOff className="size-5" />}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
