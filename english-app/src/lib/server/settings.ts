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
  const db = getDb();
  const row = db
    .select()
    .from(schema.settings)
    .where(and(eq(schema.settings.userId, userId), eq(schema.settings.key, "privacy")))
    .get();
  if (!row) return DEFAULT_PRIVACY;
  const parsed = privacySettingsSchema.safeParse(JSON.parse(row.value));
  return parsed.success ? parsed.data : DEFAULT_PRIVACY;
}

export function savePrivacySettings(value: PrivacySettings, userId = LOCAL_USER_ID) {
  const db = getDb();
  db.insert(schema.settings)
    .values({ userId, key: "privacy", value: JSON.stringify(value) })
    .onConflictDoUpdate({ target: [schema.settings.userId, schema.settings.key], set: { value: JSON.stringify(value) } })
    .run();
}
