"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 画面の表示中に予期しないエラーが起きたときの表示 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-bold">画面を表示できませんでした</h1>
      <p className="text-sm text-muted-foreground">
        一時的な問題の可能性があります。もう一度お試しください。繰り返し起きる場合は、ターミナルに表示されているエラー内容を確認してください。
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RefreshCw /> もう一度試す
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">ホームへ</Link>
        </Button>
      </div>
    </div>
  );
}
