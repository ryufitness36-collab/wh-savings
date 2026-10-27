/**
 * iPhone（スマホ）から使うための起動スクリプト：npm run iphone
 *
 * 1. パスワード（APP_PASSWORD）が設定されているか確認する（インターネットから開けるようになるため必須）
 * 2. アプリを本番モードでビルド・起動する
 * 3. Cloudflare の無料トンネルで https の URL を作る（iPhone のマイクは https でないと使えない）
 * 4. URL と QR コードを表示する（iPhone のカメラで読み取って開く）
 *
 * Control + C で、アプリとトンネルの両方を止める。
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import qrcode from "qrcode-terminal";

const root = path.resolve(import.meta.dirname, "..");
const PORT = Number(process.env.PORT ?? 3000);
// テスト用に、トンネルのコマンドを差し替えられるようにしている
const TUNNEL_CMD = process.env.HC_TUNNEL_CMD ?? `npx -y cloudflared@0.7.3 tunnel --url http://localhost:${PORT}`;

function readEnvLocal() {
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...readEnvLocal(), ...process.env };
if (!env.OPENAI_API_KEY?.trim()) {
  console.error("\n✘ OPENAI_API_KEY が設定されていません。.env.local に OPENAI_API_KEY=sk-... を書いてください。\n");
  process.exit(1);
}
if (!env.APP_PASSWORD?.trim()) {
  console.error(
    "\n✘ APP_PASSWORD が設定されていません。\n" +
      "  iPhone から使うと、インターネットからアプリを開けるようになります。他の人に使われないよう、\n" +
      "  .env.local に次の1行を追加してから、もう一度 npm run iphone を実行してください。\n\n" +
      "    APP_PASSWORD=好きなパスワード\n",
  );
  process.exit(1);
}

const children = [];
function stopAll(code = 0) {
  for (const c of children) if (!c.killed) c.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => {
  console.log("\n停止しました。");
  stopAll(0);
});

console.log("\n① アプリをビルドしています（1分ほどかかります）…");
const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) {
  console.error("\n✘ ビルドに失敗しました。上のエラーメッセージを確認してください。");
  process.exit(1);
}

console.log(`\n② アプリを起動しています（ポート ${PORT}）…`);
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  cwd: root,
  stdio: ["ignore", "ignore", "inherit"],
});
children.push(server);
server.on("exit", (code) => {
  console.error(`\n✘ アプリが停止しました（終了コード ${code}）。ポート ${PORT} が他で使われていないか確認してください。`);
  stopAll(1);
});

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      // パスワード設定時は 401（ログインが必要）が返るが、応答があれば起動している
      const r = await fetch(`http://localhost:${PORT}/api/status`);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("timeout");
}

try {
  await waitForServer();
} catch {
  console.error("\n✘ アプリが起動しませんでした。");
  stopAll(1);
}

console.log("\n③ iPhone 用の https の URL を作っています（初回はツールのダウンロードで少し時間がかかります）…");
const tunnel = spawn(TUNNEL_CMD, { cwd: root, shell: true, stdio: ["ignore", "pipe", "pipe"] });
children.push(tunnel);

let shown = false;
const onOutput = (chunk) => {
  const text = chunk.toString();
  const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && !shown) {
    shown = true;
    const url = m[0];
    console.log("\n==============================================================");
    console.log("  iPhone のカメラでこの QR コードを読み取って開いてください");
    console.log("==============================================================\n");
    qrcode.generate(url, { small: true });
    console.log(`\n  URL： ${url}`);
    console.log("\n  ・開いたらパスワード（APP_PASSWORD）を入力してログイン");
    console.log("  ・この URL は起動するたびに変わります");
    console.log("  ・使っている間はこの画面（ターミナル）を閉じず、Mac をスリープさせないでください");
    console.log("  ・終了するときは Control + C\n");
  }
};
tunnel.stdout.on("data", onOutput);
tunnel.stderr.on("data", onOutput);
tunnel.on("exit", (code) => {
  if (!shown) console.error("\n✘ https の URL を作れませんでした。インターネット接続を確認して、もう一度お試しください。");
  else console.error(`\n✘ トンネルが停止しました（終了コード ${code}）。もう一度 npm run iphone を実行してください。`);
  stopAll(1);
});
