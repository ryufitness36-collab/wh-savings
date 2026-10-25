import { MicOff } from "lucide-react";
import type { ConversationError } from "@/hooks/use-realtime-conversation";

/** マイクが使えないときの案内（ブラウザごとの設定方法） */
export function MicHelp({ error }: { error: ConversationError }) {
  return (
    <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <MicOff className="size-4" />
        {error.message}
      </p>
      {error.kind === "mic_denied" && (
        <div className="space-y-2 text-muted-foreground">
          <p>ブラウザの設定でこのサイトのマイクを「許可」にしてから、もう一度「会話を始める」を押してください。</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Chrome / Edge（PC）</b>：アドレスバー左のアイコン →「マイク」を「許可」</li>
            <li><b>Safari（Mac）</b>：メニューの「Safari」→「設定」→「Webサイト」→「マイク」で「許可」</li>
            <li><b>iPhone（Safari）</b>：アドレスバーの「ぁあ」→「Webサイトの設定」→「マイク」を「許可」。または「設定」アプリ →「Safari」→「マイク」</li>
            <li><b>Android（Chrome）</b>：アドレスバー左のアイコン →「権限」→「マイク」を「許可」</li>
            <li><b>Mac 本体</b>：「システム設定」→「プライバシーとセキュリティ」→「マイク」でブラウザを ON</li>
          </ul>
        </div>
      )}
      {error.kind === "insecure_context" && (
        <p className="text-muted-foreground">
          PCでは <code className="rounded bg-secondary px-1">http://localhost:3000</code> で開いてください。スマホから使う場合は HTTPS での起動が必要です（README 参照）。
        </p>
      )}
    </div>
  );
}
