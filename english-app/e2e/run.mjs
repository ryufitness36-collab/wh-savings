/**
 * E2E テストの実行：偽の OpenAI API とアプリ（本番ビルド）を起動し、テストを順に実行する。
 *   npm run build && npm run test:e2e
 * 学習データは一時ファイルの DB に保存され、普段使っている data/app.db には触れない。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "english-app-e2e-"));
const DATABASE_PATH = path.join(tmp, "e2e.db");
const PORT = 3199;
const MOCK_PORT = 4019;
const procs = [];

function start(cmd, args, env) {
  const p = spawn(cmd, args, { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  p.stderr.on("data", (d) => process.stderr.write(d));
  procs.push(p);
  return p;
}

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`起動しませんでした: ${url}`);
}

function run(file) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(root, "e2e", file), path.join(root, "e2e", "screenshots")], {
      cwd: root,
      env: { ...process.env, E2E_BASE: `http://localhost:${PORT}`, DATABASE_PATH },
      stdio: "inherit",
    });
    p.on("exit", (code) => resolve(code ?? 1));
  });
}

let failed = 0;
try {
  start(process.execPath, ["e2e/mock-openai.mjs"], { MOCK_PORT: String(MOCK_PORT) });
  start(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    OPENAI_API_KEY: "sk-e2e-test",
    OPENAI_BASE_URL: `http://localhost:${MOCK_PORT}/v1`,
    DATABASE_PATH,
    APP_PASSWORD: "",
  });
  await waitFor(`http://localhost:${PORT}/api/status`);
  for (const file of ["realtime.e2e.cjs", "pages.e2e.cjs", "phase2.e2e.cjs", "phase3.e2e.cjs"]) {
    console.log(`\n▶ ${file}`);
    const code = await run(file);
    console.log(code === 0 ? `✔ ${file}` : `✘ ${file}`);
    if (code !== 0) failed++;
  }
} finally {
  procs.forEach((p) => p.kill());
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
