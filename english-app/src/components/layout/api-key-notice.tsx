"use client";

import { KeyRound } from "lucide-react";
import { useAppStatus } from "@/hooks/use-status";

/** APIキーが未設定のとき、すべての画面の上部に設定方法を表示する */
export function ApiKeyNotice() {
  const { data } = useAppStatus();
  if (!data || data.openai) return null;
  return (
    <div role="alert" className="mb-5 flex gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
      <KeyRound className="mt-0.5 size-5 shrink-0 text-warning" />
      <div className="space-y-1">
        <p className="font-semibold">OpenAI APIキーが設定されていません</p>
        <p className="text-muted-foreground">
          AI英会話・添削・問題作成を使うには、プロジェクトフォルダの <code className="rounded bg-secondary px-1">.env.local</code> に{" "}
          <code className="rounded bg-secondary px-1">OPENAI_API_KEY=sk-...</code> を書いて、アプリを再起動してください。
          学習記録や復習など、AIを使わない機能はこのまま使えます。
        </p>
      </div>
    </div>
  );
}
