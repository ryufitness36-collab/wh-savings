/** ブラウザから自分のAPIを呼ぶための関数（エラーを日本語メッセージ付きで投げる） */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("サーバーに接続できませんでした。アプリが起動しているか、ネットワークを確認してください。", 0, "network");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
  if (!res.ok) {
    if (res.status === 401 && data?.code === "unauthorized") {
      // 認証切れは画面全体を読み直してログイン画面へ
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(data?.error ?? `エラーが発生しました（${res.status}）`, res.status, data?.code);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "エラーが発生しました。";
}
