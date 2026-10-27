/** Phase 2 機能のE2Eテスト：AI学習プラン・苦手克服ドリル・復習のAI採点・ダッシュボード・講師設定（偽の OpenAI API を使用） */
const { chromium } = require("playwright");
const path = require("node:path");
const Database = require("better-sqlite3");
const SHOTS = process.argv[2] ?? path.join(__dirname, "screenshots");
require("node:fs").mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";

(async () => {
  // 前のテストで登録された復習項目を「期限切れ」にして、復習画面に出るようにする
  const db = new Database(process.env.DATABASE_PATH);
  const updated = db.prepare("update review_items set due_at = 0").run().changes;
  db.close();
  console.log("review items made due:", updated);

  const browser = await chromium.launch();
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // 復習：AIで採点 → おすすめの自己評価
  await page.goto(BASE + "/review");
  await page.getByPlaceholder("英文を入力（任意）").fill("I would like coffee please");
  await page.getByRole("button", { name: "AIで採点する" }).click();
  await page.getByText("AIのおすすめ").waitFor();
  await page.screenshot({ path: `${SHOTS}/p2-review-ai.png` });
  await page.getByRole("button", { name: /^できた/ }).click();
  console.log("review AI check OK");

  // 苦手克服ドリル
  await page.goto(BASE + "/grammar");
  await page.getByRole("button", { name: "苦手克服ドリル" }).click();
  await page.getByText("I ___ in Tokyo since 2020.").waitFor();
  await page.getByText(/苦手分野「|から出題します/).first().waitFor();
  console.log("weak drill OK");

  // ダッシュボード
  await page.goto(BASE + "/progress");
  await page.getByRole("heading", { name: "英会話スコアの推移" }).waitFor();
  await page.getByRole("img", { name: "英会話の総合スコアの推移（10点満点）" }).waitFor();
  await page.getByText(/会話・英作文での間違い/).first().waitFor();
  await page.getByRole("heading", { name: "分野別の正答率" }).waitFor();
  await page.getByRole("radio", { name: "週別（12週）" }).click();
  await page.getByRole("img", { name: "週別の学習時間（分）" }).waitFor();
  await page.getByRole("button", { name: "目標を変更" }).click();
  await page.getByRole("radio", { name: "3時間" }).click();
  await page.getByText("目標 3時間").waitFor();
  await page.screenshot({ path: `${SHOTS}/p2-progress.png`, fullPage: true });
  console.log("dashboard OK");

  // AI学習プラン → 各リンク
  await page.goto(BASE + "/");
  await page.getByRole("radio", { name: "30分" }).click();
  await page.getByRole("button", { name: "AIでプランを作る" }).click();
  await page.getByText("AIプラン", { exact: true }).waitFor();
  await page.getByText(/英作文で冠詞の間違いが2回/).waitFor();
  await page.screenshot({ path: `${SHOTS}/p2-home-plan.png`, fullPage: true });
  // 再読み込みしてもキャッシュされたプランが出る
  await page.reload();
  await page.getByText("AIプラン", { exact: true }).waitFor();
  await page.getByRole("link", { name: /カフェで注文/ }).click();
  await page.waitForURL(/mode=cafe&scenario=recommend&minutes=10/);
  await page.getByRole("button", { name: "おすすめを聞く（客）", pressed: true }).waitFor();
  await page.getByRole("radio", { name: "10分", checked: true }).waitFor();
  console.log("plan -> conversation link OK");

  // 講師設定
  await page.getByRole("radio", { name: /Mia/ }).click();
  await page.getByRole("radio", { name: "しっかり指導" }).click();
  await page.getByLabel(/講師へのお願い/).fill("サッカーの話題が好きです");
  await page.screenshot({ path: `${SHOTS}/p2-teacher.png`, fullPage: true });
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem("lesson-settings") ?? "null"));
  await page.goto(BASE + "/");
  await page.getByRole("link", { name: /英作文/ }).first().waitFor();
  await page.goto(BASE + `/writing?topic=${encodeURIComponent("好きなカフェについて3文で書く")}`);
  await page.getByText("今日のお題：").waitFor();
  console.log("writing topic OK");

  // 講師設定でセッションを作れる（サーバー側の検証が通る）
  const created = await page.request.post(BASE + "/api/conversations", {
    data: { settings: { mode: "cafe", scenarioId: "recommend", customTopic: "", level: "elementary", durationMinutes: 10, speed: "normal", accent: "australian", teacherId: "mia", teacherStyle: "coach", teacherNote: "サッカーの話題が好きです", correctionMode: "inline", japaneseSupport: true } },
  });
  const { id } = await created.json();
  const sess = await page.request.post(BASE + "/api/realtime/session", { data: { conversationId: id } });
  if (!sess.ok()) throw new Error("session failed " + (await sess.text()));
  console.log("teacher settings session OK; settings saved before start:", settings === null ? "not yet (saved on start)" : "yes");

  await browser.close();
  if (errors.length) {
    console.error("ブラウザでエラーが発生しました:", errors);
    process.exit(1);
  }
  console.log("phase2 OK");
})().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
