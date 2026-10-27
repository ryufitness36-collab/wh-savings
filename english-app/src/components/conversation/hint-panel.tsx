"use client";

import { Lightbulb, Loader2, X } from "lucide-react";
import { SpeakButton } from "@/components/speak-button";
import type { ReplyHint } from "@/lib/ai/schemas";

/** 会話中のヒント：AI講師の最後の質問への返答例 */
export function HintPanel({
  hint,
  loading,
  error,
  onClose,
}: {
  hint: ReplyHint | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-warning/40 bg-card p-4 shadow-sm" role="region" aria-label="返答のヒント">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Lightbulb className="size-4 text-warning" /> 返答のヒント
        </p>
        <button type="button" onClick={onClose} aria-label="ヒントを閉じる" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 返答例を考えています…（会話はそのまま続けられます）
        </p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">質問：{hint.question_ja}</p>
          <ul className="space-y-1.5">
            {hint.suggestions.map((sg) => (
              <li key={sg.en} className="flex items-start justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2">
                <span>
                  <span className="block font-medium">{sg.en}</span>
                  <span className="block text-xs text-muted-foreground">{sg.ja}</span>
                </span>
                <SpeakButton text={sg.en} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">💡 {hint.tip_ja}</p>
        </div>
      ) : null}
    </div>
  );
}
