import { eq } from "drizzle-orm";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { handleRouteError } from "@/lib/api";

/** すべての学習データを JSON でダウンロードする */
export async function GET() {
  try {
    const db = getDb();
    const uid = LOCAL_USER_ID;
    const data = {
      exportedAt: new Date().toISOString(),
      conversations: db.select().from(schema.conversations).where(eq(schema.conversations.userId, uid)).all(),
      grammarAttempts: db.select().from(schema.grammarAttempts).where(eq(schema.grammarAttempts.userId, uid)).all(),
      writingEntries: db.select().from(schema.writingEntries).where(eq(schema.writingEntries.userId, uid)).all(),
      reviewItems: db.select().from(schema.reviewItems).where(eq(schema.reviewItems.userId, uid)).all(),
      activityLogs: db.select().from(schema.activityLogs).where(eq(schema.activityLogs.userId, uid)).all(),
    };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="english-app-export-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
