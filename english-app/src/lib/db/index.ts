import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { env } from "@/lib/env";

export type DB = BetterSQLite3Database<typeof schema>;

/** 個人利用のため現在は固定。ログイン機能追加時はセッションから取得する。 */
export const LOCAL_USER_ID = "local";

const globalForDb = globalThis as unknown as { __englishAppDb?: DB };

function createDb(): DB {
  const dbPath = path.resolve(process.cwd(), env.databasePath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  // 起動時に未適用のマイグレーションを自動で適用する（初回はテーブルを作成）
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  return db;
}

/** 開発中のホットリロードで接続が増えないよう globalThis に保持する */
export function getDb(): DB {
  if (!globalForDb.__englishAppDb) {
    globalForDb.__englishAppDb = createDb();
  }
  return globalForDb.__englishAppDb;
}

export { schema };
