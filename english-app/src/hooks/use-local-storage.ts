"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";

/** localStorage に保存される設定値（読み込み失敗時は既定値） */
export function useLocalStorage<T>(key: string, fallback: T, schema?: z.ZodType<T>) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const result = schema ? schema.safeParse(parsed) : { success: true as const, data: parsed as T };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部ストレージからの初回読み込み
        if (result.success) setValue(result.data);
      }
    } catch {
      // 読み込めない場合は既定値のまま
    }
    setLoaded(true);
  }, [key, schema]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {}
    },
    [key],
  );

  return [value, update, loaded] as const;
}
