"use client";

import { useSyncExternalStore } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canInstall, promptInstall, subscribeInstallPrompt } from "@/lib/client/install-prompt";

/** ホーム画面に追加（PWA）の案内 */
export function InstallCard() {
  const installable = useSyncExternalStore(subscribeInstallPrompt, canInstall, () => false);
  const standalone = useSyncExternalStore(
    () => () => {},
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => false,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="size-4" /> ホーム画面に追加
        </CardTitle>
        <CardDescription>アプリのように全画面で起動できます（https で開いているときに使えます）</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {standalone ? (
          <p className="text-success">ホーム画面のアプリとして起動しています。</p>
        ) : installable ? (
          <Button onClick={() => void promptInstall()}>
            <Download /> ホーム画面に追加する
          </Button>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <b>iPhone / iPad（Safari）</b>：画面下の共有ボタン（□に↑）→「ホーム画面に追加」
            </li>
            <li>
              <b>Android（Chrome）</b>：右上の︙ →「ホーム画面に追加」または「アプリをインストール」
            </li>
            <li>
              <b>PC（Chrome / Edge）</b>：アドレスバー右側のインストールアイコン
            </li>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
