"use client";

import { useFetch } from "./use-fetch";

export interface AppStatus {
  openai: boolean;
  models: { realtime: string; transcribe: string; text: string };
  passwordProtected: boolean;
}

export function useAppStatus() {
  return useFetch<AppStatus>("/api/status");
}
