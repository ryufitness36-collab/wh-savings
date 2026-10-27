"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** ネットワークが切れているときに表示する */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
      <WifiOff className="size-4 shrink-0" />
      インターネットに接続されていません。AI機能と学習記録の保存は、接続が戻ってから使えます。
    </div>
  );
}
