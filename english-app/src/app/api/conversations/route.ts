import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { handleRouteError, parseJson } from "@/lib/api";
import { lessonSettingsSchema, lessonTitle } from "@/lib/learning/lesson";
import { listConversations } from "@/lib/server/conversations";
import { newId } from "@/lib/utils";

const createSchema = z.object({
  settings: lessonSettingsSchema,
  practiceOf: z.string().nullable().default(null),
});

export async function GET() {
  try {
    return NextResponse.json({ conversations: listConversations() });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** 英会話レッスンの記録を作成する（音声接続の前に呼ぶ） */
export async function POST(req: Request) {
  try {
    const { settings, practiceOf } = await parseJson(req, createSchema);
    const id = newId();
    const title = practiceOf ? `復習練習：${lessonTitle(settings)}` : lessonTitle(settings);
    getDb()
      .insert(schema.conversations)
      .values({
        id,
        userId: LOCAL_USER_ID,
        mode: settings.mode,
        level: settings.level,
        title,
        settingsJson: JSON.stringify(settings),
        practiceOf,
        startedAt: Date.now(),
      })
      .run();
    return NextResponse.json({ id, title });
  } catch (err) {
    return handleRouteError(err);
  }
}
