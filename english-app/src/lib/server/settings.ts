import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";

/** 利用者が制御できるプライバシー設定 */
export const privacySettingsSchema = z.object({
  /** 英会話の文字起こしを保存するか（OFFの場合、レポート作成後に文字起こしを削除する） */
  saveTranscripts: z.boolean(),
});
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;

const DEFAULT_PRIVACY: PrivacySettings = { saveTranscripts: true };

export function getPrivacySettings(userId = LOCAL_USER_ID): PrivacySettings {
  return readSetting("privacy", privacySettingsSchema, DEFAULT_PRIVACY, userId);
}

export function savePrivacySettings(value: PrivacySettings, userId = LOCAL_USER_ID) {
  writeSetting("privacy", value, userId);
}

/** 学習目標 */
export const goalsSchema = z.object({
  weeklyMinutes: z.number().int().min(10).max(3000),
});
export type Goals = z.infer<typeof goalsSchema>;

const DEFAULT_GOALS: Goals = { weeklyMinutes: 120 };

function readSetting<T>(key: string, schemaT: z.ZodType<T>, fallback: T, userId: string): T {
  const row = getDb()
    .select()
    .from(schema.settings)
    .where(and(eq(schema.settings.userId, userId), eq(schema.settings.key, key)))
    .get();
  if (!row) return fallback;
  const parsed = schemaT.safeParse(JSON.parse(row.value));
  return parsed.success ? parsed.data : fallback;
}

function writeSetting(key: string, value: unknown, userId: string) {
  getDb()
    .insert(schema.settings)
    .values({ userId, key, value: JSON.stringify(value) })
    .onConflictDoUpdate({ target: [schema.settings.userId, schema.settings.key], set: { value: JSON.stringify(value) } })
    .run();
}

export function getGoals(userId = LOCAL_USER_ID): Goals {
  return readSetting("goals", goalsSchema, DEFAULT_GOALS, userId);
}

export function saveGoals(value: Goals, userId = LOCAL_USER_ID) {
  writeSetting("goals", value, userId);
}

/** 汎用の設定読み書き（AI学習プランのキャッシュなど） */
export { readSetting, writeSetting };
