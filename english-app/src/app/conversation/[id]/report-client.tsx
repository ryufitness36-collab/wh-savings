"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessagesSquare, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportView, TranscriptPanel } from "@/components/conversation/report-view";
import { useFetch } from "@/hooks/use-fetch";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { formatDurationJa } from "@/lib/utils";
import type { ConversationReport } from "@/lib/ai/schemas";
import type { ConversationDetail } from "@/lib/server/conversations";

export function ReportClient({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, loading, setData } = useFetch<{ conversation: ConversationDetail }>(`/api/conversations/${id}`);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const autoTried = useRef(false);

  const conversation = data?.conversation ?? null;
  const hasUserSpeech = conversation?.transcript.some((t) => t.role === "user") ?? false;

  const generate = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const { report } = await apiFetch<{ report: ConversationReport }>(`/api/conversations/${id}/report`, { method: "POST" });
      setData((prev) => (prev ? { conversation: { ...prev.conversation, report, status: "reported" } } : prev));
    } catch (e) {
      setGenError(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  }, [id, setData]);

  // 会話終了直後はレポートを自動で作成する
  useEffect(() => {
    if (!conversation || autoTried.current) return;
    if (!conversation.report && conversation.status === "finished" && hasUserSpeech) {
      autoTried.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- APIの呼び出し開始（1回だけ）
      void generate();
    }
  }, [conversation, hasUserSpeech, generate]);

  const remove = async () => {
    if (!window.confirm("この会話の記録を削除しますか？（元に戻せません）")) return;
    try {
      await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
      toast.success("削除しました");
      router.push("/progress");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (loading && !conversation) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !conversation) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">{error ?? "会話が見つかりません。"}</CardContent>
      </Card>
    );
  }

  const date = new Date(conversation.startedAt).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/progress">
            <ArrowLeft /> 学習記録
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={remove} className="text-muted-foreground">
          <Trash2 /> 削除
        </Button>
      </div>
      <header>
        <p className="text-sm text-muted-foreground">
          {date}・{formatDurationJa(conversation.durationSec)}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{conversation.report?.title_ja ?? conversation.title}</h1>
        {conversation.report && <p className="mt-1 text-sm text-muted-foreground">{conversation.title}</p>}
      </header>

      {conversation.report ? (
        <ReportView conversationId={conversation.id} report={conversation.report} transcript={conversation.transcript} />
      ) : generating ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="font-medium">AIが会話を分析してレポートを作成しています…</p>
            <p className="text-sm text-muted-foreground">通常 10〜40 秒ほどかかります</p>
          </CardContent>
        </Card>
      ) : !hasUserSpeech ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm">
            <p className="font-medium">あなたの発話が記録されていないため、レポートは作成されませんでした。</p>
            <p className="text-muted-foreground">マイクが ON になっているか、声が小さすぎないかを確認して、もう一度話してみましょう。</p>
            <Button asChild>
              <Link href="/conversation">
                <MessagesSquare /> 新しい会話を始める
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm">
            <p className="font-medium text-destructive">{genError ?? "レポートはまだ作成されていません。"}</p>
            <Button onClick={() => void generate()}>
              <RefreshCw /> レポートを作成する
            </Button>
          </CardContent>
        </Card>
      )}

      {!conversation.report && conversation.transcript.length > 0 && <TranscriptPanel transcript={conversation.transcript} />}

      {conversation.report && (
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/conversation">
              <MessagesSquare /> 新しい会話
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
