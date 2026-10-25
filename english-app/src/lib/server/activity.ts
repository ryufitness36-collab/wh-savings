import "server-only";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { dateKey } from "@/lib/learning/dates";
import { newId } from "@/lib/utils";

export type ActivityKind = "conversation" | "grammar" | "writing" | "review";

/** 学習時間を記録する。極端な値は上限で切る（放置による水増しを防ぐ） */
export function logActivity(kind: ActivityKind, seconds: number, userId = LOCAL_USER_ID) {
  const capped = Math.max(0, Math.min(Math.round(seconds), kind === "conversation" ? 3 * 3600 : 30 * 60));
  if (capped <= 0) return;
  const now = Date.now();
  getDb()
    .insert(schema.activityLogs)
    .values({ id: newId(), userId, kind, seconds: capped, date: dateKey(now, env.timezone), createdAt: now })
    .run();
}
