import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { newId } from "@/lib/utils";
import { nextReview, type ReviewRating } from "@/lib/learning/srs";

export interface NewReviewItem {
  source: "conversation" | "grammar" | "writing";
  sourceId?: string;
  category?: string;
  prompt: string;
  answer: string;
  explanation?: string;
}

/** 復習アイテムを登録する。同じ出題・答えのものが未完了で残っていれば重複登録しない */
export function addReviewItems(items: NewReviewItem[], userId = LOCAL_USER_ID) {
  const db = getDb();
  const now = Date.now();
  for (const item of items) {
    const prompt = item.prompt.trim();
    const answer = item.answer.trim();
    if (!prompt || !answer) continue;
    const exists = db
      .select({ id: schema.reviewItems.id })
      .from(schema.reviewItems)
      .where(
        and(
          eq(schema.reviewItems.userId, userId),
          eq(schema.reviewItems.prompt, prompt),
          eq(schema.reviewItems.answer, answer),
          eq(schema.reviewItems.archived, false),
        ),
      )
      .get();
    if (exists) continue;
    db.insert(schema.reviewItems)
      .values({
        id: newId(),
        userId,
        source: item.source,
        sourceId: item.sourceId ?? null,
        category: item.category ?? null,
        prompt,
        answer,
        explanation: item.explanation ?? "",
        // 最初の復習は翌日（忘れかけたタイミング）に提案する
        dueAt: now + 20 * 60 * 60 * 1000,
        createdAt: now,
      })
      .run();
  }
}

export function getDueReviewItems(limit = 20, userId = LOCAL_USER_ID) {
  return getDb()
    .select()
    .from(schema.reviewItems)
    .where(and(eq(schema.reviewItems.userId, userId), eq(schema.reviewItems.archived, false), lte(schema.reviewItems.dueAt, Date.now())))
    .orderBy(asc(schema.reviewItems.dueAt))
    .limit(limit)
    .all();
}

export function countReviewItems(userId = LOCAL_USER_ID) {
  const row = getDb()
    .select({
      total: sql<number>`count(*)`,
      due: sql<number>`sum(case when ${schema.reviewItems.dueAt} <= ${Date.now()} then 1 else 0 end)`,
    })
    .from(schema.reviewItems)
    .where(and(eq(schema.reviewItems.userId, userId), eq(schema.reviewItems.archived, false)))
    .get();
  return { total: Number(row?.total ?? 0), due: Number(row?.due ?? 0) };
}

export function rateReviewItem(id: string, rating: ReviewRating, userId = LOCAL_USER_ID) {
  const db = getDb();
  const item = db
    .select()
    .from(schema.reviewItems)
    .where(and(eq(schema.reviewItems.id, id), eq(schema.reviewItems.userId, userId)))
    .get();
  if (!item) return null;
  const now = Date.now();
  const next = nextReview(item, rating, now);
  db.update(schema.reviewItems)
    .set({ ...next, lastReviewedAt: now })
    .where(eq(schema.reviewItems.id, id))
    .run();
  return next;
}

export function archiveReviewItem(id: string, userId = LOCAL_USER_ID) {
  getDb()
    .update(schema.reviewItems)
    .set({ archived: true })
    .where(and(eq(schema.reviewItems.id, id), eq(schema.reviewItems.userId, userId)))
    .run();
}
