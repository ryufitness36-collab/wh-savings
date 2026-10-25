import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { computeStreak, dateKey, lastNDays } from "@/lib/learning/dates";
import { CORRECT_THRESHOLD, grammarCategoryLabel } from "@/lib/learning/grammar";
import { countReviewItems } from "./review";
import type { ActivityKind } from "./activity";

export interface DailyActivity {
  date: string;
  conversation: number;
  grammar: number;
  writing: number;
  review: number;
}

export interface WeakCategory {
  category: string;
  label: string;
  attempts: number;
  wrong: number;
  avgScore: number;
}

export interface Stats {
  today: string;
  todaySeconds: number;
  totalSeconds: number;
  totalConversationSeconds: number;
  streak: number;
  grammarAttempts: number;
  grammarCorrect: number;
  grammarAccuracy: number | null;
  writingCount: number;
  conversationCount: number;
  daily: DailyActivity[];
  weakCategories: WeakCategory[];
  review: { total: number; due: number };
  recentConversations: {
    id: string;
    title: string;
    mode: string;
    startedAt: number;
    durationSec: number;
    status: string;
  }[];
  recentWriting: { id: string; kind: string; input: string; createdAt: number }[];
  lastGrammarCategory: string | null;
  daysSinceLastConversation: number | null;
}

export function getStats(userId = LOCAL_USER_ID): Stats {
  const db = getDb();
  const today = dateKey(Date.now(), env.timezone);
  const days = lastNDays(today, 14);

  const perDayKind = db
    .select({
      date: schema.activityLogs.date,
      kind: schema.activityLogs.kind,
      seconds: sql<number>`sum(${schema.activityLogs.seconds})`,
    })
    .from(schema.activityLogs)
    .where(and(eq(schema.activityLogs.userId, userId), gte(schema.activityLogs.date, days[0])))
    .groupBy(schema.activityLogs.date, schema.activityLogs.kind)
    .all();

  const dailyMap = new Map<string, DailyActivity>(
    days.map((d) => [d, { date: d, conversation: 0, grammar: 0, writing: 0, review: 0 }]),
  );
  for (const row of perDayKind) {
    const entry = dailyMap.get(row.date);
    if (entry) entry[row.kind as ActivityKind] += Number(row.seconds);
  }
  const daily = [...dailyMap.values()];
  const todayEntry = dailyMap.get(today);
  const todaySeconds = todayEntry
    ? todayEntry.conversation + todayEntry.grammar + todayEntry.writing + todayEntry.review
    : 0;

  const totals = db
    .select({
      kind: schema.activityLogs.kind,
      seconds: sql<number>`sum(${schema.activityLogs.seconds})`,
    })
    .from(schema.activityLogs)
    .where(eq(schema.activityLogs.userId, userId))
    .groupBy(schema.activityLogs.kind)
    .all();
  const totalSeconds = totals.reduce((s, r) => s + Number(r.seconds), 0);
  const totalConversationSeconds = Number(totals.find((r) => r.kind === "conversation")?.seconds ?? 0);

  const studyDates = db
    .selectDistinct({ date: schema.activityLogs.date })
    .from(schema.activityLogs)
    .where(eq(schema.activityLogs.userId, userId))
    .all()
    .map((r) => r.date);
  const streak = computeStreak(studyDates, today);

  const grammarAgg = db
    .select({
      total: sql<number>`count(*)`,
      correct: sql<number>`sum(case when ${schema.grammarAttempts.isCorrect} then 1 else 0 end)`,
    })
    .from(schema.grammarAttempts)
    .where(eq(schema.grammarAttempts.userId, userId))
    .get();
  const grammarAttempts = Number(grammarAgg?.total ?? 0);
  const grammarCorrect = Number(grammarAgg?.correct ?? 0);

  const byCategory = db
    .select({
      category: schema.grammarAttempts.category,
      attempts: sql<number>`count(*)`,
      wrong: sql<number>`sum(case when ${schema.grammarAttempts.score} < ${CORRECT_THRESHOLD} then 1 else 0 end)`,
      avgScore: sql<number>`avg(${schema.grammarAttempts.score})`,
    })
    .from(schema.grammarAttempts)
    .where(eq(schema.grammarAttempts.userId, userId))
    .groupBy(schema.grammarAttempts.category)
    .all();
  const weakCategories: WeakCategory[] = byCategory
    .map((r) => ({
      category: r.category,
      label: grammarCategoryLabel(r.category),
      attempts: Number(r.attempts),
      wrong: Number(r.wrong),
      avgScore: Math.round(Number(r.avgScore) * 10) / 10,
    }))
    .filter((r) => r.wrong > 0)
    .sort((a, b) => a.avgScore - b.avgScore || b.wrong - a.wrong)
    .slice(0, 5);

  const writingCount = Number(
    db.select({ n: sql<number>`count(*)` }).from(schema.writingEntries).where(eq(schema.writingEntries.userId, userId)).get()?.n ?? 0,
  );
  const conversationCount = Number(
    db.select({ n: sql<number>`count(*)` }).from(schema.conversations).where(eq(schema.conversations.userId, userId)).get()?.n ?? 0,
  );

  const recentConversations = db
    .select({
      id: schema.conversations.id,
      title: schema.conversations.title,
      mode: schema.conversations.mode,
      startedAt: schema.conversations.startedAt,
      durationSec: schema.conversations.durationSec,
      status: schema.conversations.status,
    })
    .from(schema.conversations)
    .where(eq(schema.conversations.userId, userId))
    .orderBy(desc(schema.conversations.startedAt))
    .limit(10)
    .all();

  const recentWriting = db
    .select({
      id: schema.writingEntries.id,
      kind: schema.writingEntries.kind,
      input: schema.writingEntries.input,
      createdAt: schema.writingEntries.createdAt,
    })
    .from(schema.writingEntries)
    .where(eq(schema.writingEntries.userId, userId))
    .orderBy(desc(schema.writingEntries.createdAt))
    .limit(10)
    .all();

  const lastGrammar = db
    .select({ category: schema.grammarAttempts.category })
    .from(schema.grammarAttempts)
    .where(eq(schema.grammarAttempts.userId, userId))
    .orderBy(desc(schema.grammarAttempts.createdAt))
    .limit(1)
    .get();

  return {
    today,
    todaySeconds,
    totalSeconds,
    totalConversationSeconds,
    streak,
    grammarAttempts,
    grammarCorrect,
    grammarAccuracy: grammarAttempts > 0 ? Math.round((grammarCorrect / grammarAttempts) * 100) : null,
    writingCount,
    conversationCount,
    daily,
    weakCategories,
    review: countReviewItems(userId),
    recentConversations,
    recentWriting,
    lastGrammarCategory: lastGrammar?.category ?? null,
    daysSinceLastConversation: recentConversations[0]
      ? Math.floor((Date.now() - recentConversations[0].startedAt) / 86_400_000)
      : null,
  };
}
