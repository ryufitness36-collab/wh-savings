/**
 * AI英会話（WebRTC）のE2Eテスト。
 * 本物の OpenAI の代わりに、別タブに「偽の Realtime サーバー」を作り、
 * 実際の WebRTC 接続・データチャンネルのイベント・字幕・再接続・終了→レポートまでを確認する。
 */
const { chromium } = require("playwright");
const { setupFakeRealtime } = require("./fake-realtime.cjs");
const SHOTS = process.argv[2] ?? require("node:path").join(__dirname, "screenshots");
require("node:fs").mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";

(async () => {
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ["microphone"] });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("[page]", m.type(), m.text().slice(0, 200)); });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  const fake = await setupFakeRealtime(ctx, page, BASE);

  await page.goto(BASE + "/conversation?mode=cafe");
  await page.screenshot({ path: `${SHOTS}/conv-setup.png`, fullPage: true });
  await page.getByRole("button", { name: "会話を始める" }).click();
  await page.getByText("Welcome to our cafe").waitFor({ timeout: 15000 });
  console.log("AI greeting subtitle shown");
  await fake.evaluate(() => window.userSays("I want to drink a coffee", "item_user_1"));
  await page.getByText("I want to drink a coffee").waitFor({ timeout: 5000 });
  await page.getByText("hot or iced").waitFor({ timeout: 5000 });
  console.log("user subtitle + AI reply shown");
  await page.screenshot({ path: `${SHOTS}/conv-live.png` });

  // 字幕 OFF
  await page.getByRole("button", { name: "字幕を非表示にする" }).click();
  await page.getByText("字幕はOFFです").waitFor();
  await page.getByRole("button", { name: "字幕を表示する" }).click();

  // テキスト入力
  await page.getByRole("button", { name: "テキスト入力" }).click();
  await page.getByLabel("テキストで送る").fill("「甘さ控えめ」って英語でどう言えばいい？");
  await page.getByRole("button", { name: "送信" }).click();
  await page.getByText("甘さ控えめ").waitFor();
  const sent = await fake.evaluate(() => window.received.map((e) => e.type));
  console.log("client->server events:", JSON.stringify(sent));

  // 接続断 → 自動再接続
  await fake.evaluate(() => window.pc.close());
  await page.getByText("再接続").first().waitFor({ timeout: 10000 }).catch(() => {});
  await page.getByText("接続中", { exact: true }).waitFor({ timeout: 15000 });
  const afterReconnect = await fake.evaluate(() => window.received.filter((e) => e.type === "conversation.item.create").length);
  console.log("history items restored after reconnect:", afterReconnect);
  await page.screenshot({ path: `${SHOTS}/conv-reconnected.png` });

  // 終了 → レポート
  await page.getByRole("button", { name: "会話を終了" }).click();
  await page.waitForURL(/\/conversation\/[0-9a-f-]+$/, { timeout: 15000 });
  await page.getByText("会話の要約").waitFor({ timeout: 20000 });
  console.log("report shown at", page.url());
  await page.screenshot({ path: `${SHOTS}/report.png`, fullPage: true });
  await browser.close();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
