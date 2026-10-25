import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { handleRouteError, parseJson } from "@/lib/api";

const bodySchema = z.object({
  target: z.enum(["transcripts", "all"]),
});

/**
 * 学習データの削除。
 * - transcripts: 英会話の文字起こしだけを削除（レポートと学習時間は残す）
 * - all: すべての学習データを削除
 */
export async function DELETE(req: Request) {
  try {
    const { target } = await parseJson(req, bodySchema);
    const db = getDb();
    const uid = LOCAL_USER_ID;
    if (target === "transcripts") {
      db.update(schema.conversations).set({ transcriptJson: "[]" }).where(eq(schema.conversations.userId, uid)).run();
    } else {
      db.transaction((tx) => {
        tx.delete(schema.conversations).where(eq(schema.conversations.userId, uid)).run();
        tx.delete(schema.grammarAttempts).where(eq(schema.grammarAttempts.userId, uid)).run();
        tx.delete(schema.writingEntries).where(eq(schema.writingEntries.userId, uid)).run();
        tx.delete(schema.reviewItems).where(eq(schema.reviewItems.userId, uid)).run();
        tx.delete(schema.activityLogs).where(eq(schema.activityLogs.userId, uid)).run();
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
