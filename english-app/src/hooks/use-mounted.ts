"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** ブラウザで描画されているか（サーバー描画との差異を避ける） */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
