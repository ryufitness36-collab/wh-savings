"use client";

import { useEffect } from "react";
import { listenForInstallPrompt } from "@/lib/client/install-prompt";

/** 本番ビルドのときだけサービスワーカーを登録する（開発中はホットリロードの妨げになるため登録しない） */
export function PwaRegister() {
  useEffect(() => {
    listenForInstallPrompt();
  }, []);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("[pwa] service worker registration failed", err));
  }, []);
  return null;
}
