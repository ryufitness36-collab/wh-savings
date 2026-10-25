"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, KeyRound, LogOut, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppStatus } from "@/hooks/use-status";
import { useFetch } from "@/hooks/use-fetch";
import { InstallCard } from "@/components/install-card";
import { apiFetch, errorMessage } from "@/lib/client/api";

interface Privacy {
  saveTranscripts: boolean;
}

export function SettingsClient() {
  const router = useRouter();
  const { data: status } = useAppStatus();
  const settings = useFetch<{ privacy: Privacy }>("/api/settings");
  const [busy, setBusy] = useState(false);

  const updatePrivacy = async (privacy: Privacy) => {
    try {
      await apiFetch("/api/settings", { method: "PUT", json: privacy });
      settings.setData(() => ({ privacy }));
      toast.success("設定を保存しました");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const deleteData = async (target: "transcripts" | "all") => {
    const msg =
      target === "all"
        ? "すべての学習データ（英会話・文法・英作文・復習・学習時間）を削除します。元に戻せません。よろしいですか？"
        : "保存されている英会話の文字起こしをすべて削除します（レポートと学習時間は残ります）。よろしいですか？";
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await apiFetch("/api/data", { method: "DELETE", json: { target } });
      toast.success("削除しました");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">設定</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" /> API の設定状況
          </CardTitle>
          <CardDescription>APIキーはサーバー側（.env.local）で管理され、ブラウザには送られません。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {status ? (
            <>
              <p className="flex items-center gap-2">
                {status.openai ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
                OpenAI APIキー：{status.openai ? "設定済み" : "未設定"}
              </p>
              <p className="text-muted-foreground">音声会話モデル：{status.models.realtime}</p>
              <p className="text-muted-foreground">文字起こしモデル：{status.models.transcribe}</p>
              <p className="text-muted-foreground">添削・採点モデル：{status.models.text}</p>
            </>
          ) : (
            <p className="text-muted-foreground">確認中…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" /> プライバシー
          </CardTitle>
          <CardDescription>
            音声そのものは保存しません。英会話中の音声は OpenAI に送信されて処理されます（添削・採点のリクエストは OpenAI 側に保存しない設定で送信しています）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="save-transcripts">英会話の文字起こしを保存する</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                OFF にすると、会話後のレポートを作成した時点で文字起こしを削除します（レポート内の添削例は残ります）。
              </p>
            </div>
            <Switch
              id="save-transcripts"
              disabled={!settings.data}
              checked={settings.data?.privacy.saveTranscripts ?? true}
              onCheckedChange={(v) => void updatePrivacy({ saveTranscripts: v })}
            />
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-5">
            <Button variant="outline" asChild>
              <a href="/api/data/export">
                <Download /> 学習データを書き出す（JSON）
              </a>
            </Button>
            <Button variant="outline" onClick={() => void deleteData("transcripts")} disabled={busy}>
              <Trash2 /> 文字起こしをすべて削除
            </Button>
            <Button variant="destructive" onClick={() => void deleteData("all")} disabled={busy}>
              <Trash2 /> すべての学習データを削除
            </Button>
          </div>
        </CardContent>
      </Card>

      <InstallCard />

      {status?.passwordProtected && (
        <Button variant="outline" onClick={logout}>
          <LogOut /> ログアウト
        </Button>
      )}
    </div>
  );
}
