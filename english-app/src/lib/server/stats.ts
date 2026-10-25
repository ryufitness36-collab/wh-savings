import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, LOCAL_USER_ID, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { computeStreak, dateKey, lastNDays, weekStart } from "@/lib/learning/dates";
import { CORRECT_THRESHOLD, grammarCategoryLabel, isGrammarCategory } from "@/lib/learning/grammar";
import { rankWeakCategories } from "@/lib/learning/weakness";
import { countReviewItems } from "./review";
import type { ActivityKind } from "./activity";
import type { ConversationReport } from "@/lib/ai/schemas";
import { getGoals } from "./settings";

export interface DailyActivity {
  date: string;
  conversation: number;
  grammar: number;
  writing: number;
  review: number;
}

export interface ConversationTrendPoint {
  id: string;
  startedAt: number;
  grammar: number;
  vocabulary: number;
  fluency: number;
  engagement: number;
  overall: number;
  avgWordsPerTurn: number | null;
}

export interface WeakCategory {
  category: string;
  label: string;
  /** 文法問題の解答数・誤答数・平均点（解いていなければ attempts=0, avgScore=null） */
  attempts: number;
  wrong: number;
  avgScore: number | null;
  /** 英会話・英作文で指摘された間違いの数（直近60日） */
  usageMistakes: number;
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
  /** 直近30日 */
  daily: DailyActivity[];
  /** 直近12週（date は週の月曜日） */
  weekly: DailyActivity[];
  thisWeekSeconds: number;
  weeklyGoalMinutes: number;
  conversationTrend: ConversationTrendPoint[];
  categoryAccuracy: { category: string; label: string; attempts: number; accuracy: number }[];
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
  // 12週間分（週ごとの集計用）を読み、日別グラフは直近30日を使う
  const days = lastNDays(today, 7 * 12 + 6);

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
  const allDays = [...dailyMap.values()];
  const daily = allDays.slice(-30);

  const weeklyMap = new Map<string, DailyActivity>();
  for (const d of allDays) {
    const w = weekStart(d.date);
    const entry = weeklyMap.get(w) ?? { date: w, conversation: 0, grammar: 0, writing: 0, review: 0 };
    entry.conversation += d.conversation;
    entry.grammar += d.grammar;
    entry.writing += d.writing;
    entry.review += d.review;
    weeklyMap.set(w, entry);
  }
  const weekly = [...weeklyMap.values()].slice(-12);
  const thisWeek = weeklyMap.get(weekStart(today));
  const thisWeekSeconds = thisWeek ? thisWeek.conversation + thisWeek.grammar + thisWeek.writing + thisWeek.review : 0;
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
  // 英会話・英作文での間違い（AIが文法カテゴリに分類したもの）
  const since = Date.now() - 60 * 86_400_000;
  const usageRows = db
    .select({ category: schema.reviewItems.category, n: sql<number>`count(*)` })
    .from(schema.reviewItems)
    .where(
      and(
        eq(schema.reviewItems.userId, userId),
        inArray(schema.reviewItems.source, ["conversation", "writing"]),
        gte(schema.reviewItems.createdAt, since),
      ),
    )
    .groupBy(schema.reviewItems.category)
    .all();

  const weakMap = new Map<string, WeakCategory>();
  for (const r of byCategory) {
    weakMap.set(r.category, {
      category: r.category,
      label: grammarCategoryLabel(r.category),
      attempts: Number(r.attempts),
      wrong: Number(r.wrong),
      avgScore: Math.round(Number(r.avgScore) * 10) / 10,
      usageMistakes: 0,
    });
  }
  for (const r of usageRows) {
    if (!r.category || !isGrammarCategory(r.category)) continue;
    const entry = weakMap.get(r.category) ?? {
      category: r.category,
      label: grammarCategoryLabel(r.category),
      attempts: 0,
      wrong: 0,
      avgScore: null,
      usageMistakes: 0,
    };
    entry.usageMistakes = Number(r.n);
    weakMap.set(r.category, entry);
  }
  const weakCategories = rankWeakCategories([...weakMap.values()]).slice(0, 5);

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

  const reported = db
    .select({ id: schema.conversations.id, startedAt: schema.conversations.startedAt, reportJson: schema.conversations.reportJson })
    .from(schema.conversations)
    .where(and(eq(schema.conversations.userId, userId), eq(schema.conversations.status, "reported")))
    .orderBy(desc(schema.conversations.startedAt))
    .limit(12)
    .all();
  const conversationTrend: ConversationTrendPoint[] = reported
    .map((r): ConversationTrendPoint | null => {
      const report = JSON.parse(r.reportJson ?? "null") as ConversationReport | null;
      if (!report?.scores) return null;
      const { grammar, vocabulary, fluency, engagement } = report.scores;
      return {
        id: r.id,
        startedAt: r.startedAt,
        grammar: grammar.score,
        vocabulary: vocabulary.score,
        fluency: fluency.score,
        engagement: engagement.score,
        overall: Math.round(((grammar.score + vocabulary.score + fluency.score + engagement.score) / 4) * 10) / 10,
        avgWordsPerTurn: report.metrics?.avgWordsPerTurn ?? null,
      };
    })
    .filter((x): x is ConversationTrendPoint => x !== null)
    .reverse();

  const categoryAccuracy = byCategory
    .map((r) => ({
      category: r.category,
      label: grammarCategoryLabel(r.category),
      attempts: Number(r.attempts),
      accuracy: Math.round(((Number(r.attempts) - Number(r.wrong)) / Number(r.attempts)) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

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
    weekly,
    thisWeekSeconds,
    weeklyGoalMinutes: getGoals(userId).weeklyMinutes,
    conversationTrend,
    categoryAccuracy,
    lastGrammarCategory: lastGrammar?.category ?? null,
    daysSinceLastConversation: recentConversations[0]
      ? Math.floor((Date.now() - recentConversations[0].startedAt) / 86_400_000)
      : null,
  };
}
