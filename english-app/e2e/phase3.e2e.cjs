/** Phase 3 機能のE2Eテスト：押して話す・返答ヒント・マイクレベル・学習傾向の分析・PWA（オフライン）・エラー画面 */
const { chromium } = require("playwright");
const path = require("node:path");
const { setupFakeRealtime } = require("./fake-realtime.cjs");
const SHOTS = process.argv[2] ?? path.join(__dirname, "screenshots");
require("node:fs").mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";

(async () => {
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ["microphone"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const fake = await setupFakeRealtime(ctx, page, BASE, false);

  // ---- 押して話す ----
  await page.goto(BASE + "/conversation?mode=travel");
  await page.getByRole("radio", { name: "押して話す" }).click();
  await page.getByRole("button", { name: "会話を始める" }).click();
  await page.getByText("Welcome to our cafe").waitFor({ timeout: 15000 });
  const sessionBody = await page.evaluate(() => JSON.parse(localStorage.getItem("lesson-settings")).turnMode);
  if (sessionBody !== "push_to_talk") throw new Error("turnMode not saved");

  const ptt = page.getByRole("button", { name: "押している間だけ話す" });
  await ptt.hover();
  await page.mouse.down();
  await page.getByText("話してください（離すと送信）").waitFor();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await page.waitForTimeout(600);
  let sent = await fake.evaluate(() => window.received.map((e) => e.type));
  const tail = sent.slice(-3);
  if (JSON.stringify(tail) !== JSON.stringify(["input_audio_buffer.clear", "input_audio_buffer.commit", "response.create"])) {
    throw new Error("unexpected PTT events: " + JSON.stringify(sent));
  }
  console.log("push-to-talk (pointer) OK:", JSON.stringify(tail));

  // スペースキーでも話せる
  await page.keyboard.down("Space");
  await page.waitForTimeout(700);
  await page.keyboard.up("Space");
  await page.waitForTimeout(600);
  sent = await fake.evaluate(() => window.received.map((e) => e.type));
  if (sent.filter((t) => t === "input_audio_buffer.commit").length !== 2) throw new Error("space PTT failed: " + JSON.stringify(sent));
  console.log("push-to-talk (space key) OK");

  // 短すぎる押下は送信しない
  await ptt.click();
  await page.getByText("ボタンを押したまま話し").waitFor();
  console.log("too-short press guarded OK");

  // マイクレベル表示
  await page.locator('[title="マイクの入力レベル"]').waitFor();

  // ---- 返答ヒント ----
  await page.getByRole("button", { name: "返答のヒント" }).click();
  await page.getByText("I'd like it iced, because it's hot today.").waitFor();
  await page.screenshot({ path: `${SHOTS}/p3-ptt-hint.png` });
  console.log("reply hint OK");

  await page.getByRole("button", { name: "会話を終了" }).click();
  await page.waitForURL(/\/conversation\/[0-9a-f-]+$/, { timeout: 15000 });

  // ---- 学習傾向の分析 ----
  await page.goto(BASE + "/progress");
  await page.getByRole("heading", { name: "学習傾向の分析" }).waitFor();
  await page.getByRole("img", { name: "時間帯別の学習時間（直近60日）" }).waitFor();
  await page.getByRole("button", { name: "AIで分析する" }).click();
  await page.getByText("冠詞の間違いが続いています").waitFor();
  await page.screenshot({ path: `${SHOTS}/p3-insights.png`, fullPage: true });
  console.log("insights OK");

  // ---- エラー画面 ----
  await page.goto(BASE + "/no-such-page");
  await page.getByText("ページが見つかりません").waitFor();
  console.log("404 page OK");

  // ---- PWA ----
  const manifest = await (await page.request.get(BASE + "/manifest.webmanifest")).json();
  if (manifest.display !== "standalone" || manifest.icons.length < 3) throw new Error("bad manifest");
  for (const icon of manifest.icons) {
    const r = await page.request.get(BASE + icon.src);
    if (!r.ok()) throw new Error("icon missing " + icon.src);
  }
  await page.goto(BASE + "/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  // サービスワーカーが制御を始めてから、オフラインでも開けるようにページを一度表示しておく
  await page.reload();
  await page.getByText("今日のおすすめ学習").waitFor();
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  if (!controlled) throw new Error("service worker is not controlling the page");
  await ctx.setOffline(true);
  await page.reload();
  await page.getByText("今日のおすすめ学習").waitFor({ timeout: 10000 });
  await page.getByText("インターネットに接続されていません").first().waitFor();
  await page.goto(BASE + "/writing").catch(() => {});
  await page.getByText(/インターネットに接続されていません|英作文/).first().waitFor();
  await page.goto(BASE + "/settings?never-visited=1").catch(() => {});
  await page.screenshot({ path: `${SHOTS}/p3-offline.png` });
  await page.getByText("インターネットに接続されていません").first().waitFor();
  await ctx.setOffline(false);
  console.log("PWA manifest/icons/offline OK");

  await browser.close();
  const real = errors.filter((e) => !/Failed to fetch|NetworkError|Load failed/.test(e));
  if (real.length) {
    console.error("ブラウザでエラーが発生しました:", real);
    process.exit(1);
  }
  console.log("phase3 OK");
})().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
