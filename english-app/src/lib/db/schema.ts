import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * 学習データのスキーマ。
 * - 将来のログイン機能に備えて全テーブルに userId を持たせている（現在は "local" 固定）。
 * - JSON 列は text に保存し、アプリ側で型付けする（PostgreSQL 移行時は jsonb に置き換え可能）。
 * - 日時はミリ秒の UNIX 時刻（integer）で保存する。
 */

export const settings = sqliteTable("settings", {
  userId: text("user_id").notNull().default("local"),
  key: text("key").notNull(),
  value: text("value").notNull(),
}, (t) => [uniqueIndex("settings_user_key").on(t.userId, t.key)]);

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("local"),
  mode: text("mode").notNull(),
  level: text("level").notNull(),
  title: text("title").notNull(),
  /** LessonSettings を JSON で保存 */
  settingsJson: text("settings_json").notNull(),
  /** TranscriptEntry[] を JSON で保存（保存OFFの場合は空配列） */
  transcriptJson: text("transcript_json").notNull().default("[]"),
  /** ConversationReport を JSON で保存 */
  reportJson: text("report_json"),
  status: text("status", { enum: ["active", "finished", "reported", "report_failed"] }).notNull().default("active"),
  practiceOf: text("practice_of"),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  durationSec: integer("duration_sec").notNull().default(0),
  userSpeakingSec: real("user_speaking_sec").notNull().default(0),
  aiSpeakingSec: real("ai_speaking_sec").notNull().default(0),
}, (t) => [index("conversations_user_started").on(t.userId, t.startedAt)]);

export const grammarAttempts = sqliteTable("grammar_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("local"),
  category: text("category").notNull(),
  level: text("level").notNull(),
  format: text("format").notNull(),
  questionJson: text("question_json").notNull(),
  userAnswer: text("user_answer").notNull(),
  score: integer("score").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  feedbackJson: text("feedback_json").notNull(),
  secondsSpent: integer("seconds_spent").notNull().default(0),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("grammar_user_created").on(t.userId, t.createdAt)]);

export const writingEntries = sqliteTable("writing_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("local"),
  kind: text("kind", { enum: ["correct", "translate"] }).notNull(),
  level: text("level").notNull(),
  input: text("input").notNull(),
  resultJson: text("result_json").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("writing_user_created").on(t.userId, t.createdAt)]);

export const reviewItems = sqliteTable("review_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("local"),
  source: text("source", { enum: ["conversation", "grammar", "writing"] }).notNull(),
  sourceId: text("source_id"),
  category: text("category"),
  /** 出題文（例：「次の英文を自然に直してください」+ 間違えた英文、または日本語） */
  prompt: text("prompt").notNull(),
  /** 模範解答 */
  answer: text("answer").notNull(),
  explanation: text("explanation").notNull().default(""),
  ease: real("ease").notNull().default(2.5),
  intervalDays: real("interval_days").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  dueAt: integer("due_at").notNull(),
  lastReviewedAt: integer("last_reviewed_at"),
  createdAt: integer("created_at").notNull(),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
}, (t) => [index("review_user_due").on(t.userId, t.dueAt)]);

export const activityLogs = sqliteTable("activity_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("local"),
  kind: text("kind", { enum: ["conversation", "grammar", "writing", "review"] }).notNull(),
  seconds: integer("seconds").notNull(),
  /** APP_TIMEZONE での日付（YYYY-MM-DD） */
  date: text("date").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("activity_user_date").on(t.userId, t.date)]);
