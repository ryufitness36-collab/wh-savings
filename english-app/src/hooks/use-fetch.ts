"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/client/api";

interface Result<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/** GET リクエストの結果・読み込み中・エラーを管理する */
export function useFetch<T>(url: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const key = url ? `${url}#${version}` : null;

  useEffect(() => {
    if (!url || !key) return;
    let cancelled = false;
    apiFetch<T>(url)
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: null });
      })
      .catch((e) => {
        if (!cancelled) setResult((prev) => ({ key, data: prev?.data ?? null, error: errorMessage(e) }));
      });
    return () => {
      cancelled = true;
    };
  }, [url, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback(
    (updater: (prev: T | null) => T | null) =>
      setResult((prev) => (prev ? { ...prev, data: updater(prev.data) } : prev)),
    [],
  );

  return {
    data: result?.data ?? null,
    error: result?.key === key ? result.error : null,
    loading: key !== null && result?.key !== key,
    reload,
    setData,
  };
}
