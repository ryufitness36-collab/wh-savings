/** ホーム・英文法・英作文・学習記録・設定・スマホ表示のE2Eテスト（偽の OpenAI API を使用） */
const { chromium, devices } = require("playwright");
const SHOTS = process.argv[2] ?? require("node:path").join(__dirname, "screenshots");
require("node:fs").mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // 英文法：問題作成 → 4択 → 翻訳 → 並べ替え → 空欄 → 誤文訂正 → 結果
  await page.goto(BASE + "/grammar");
  await page.getByRole("button", { name: "問題を作成して始める" }).click();
  await page.getByText("I ___ in Tokyo since 2020.").waitFor();
  await page.getByRole("button", { name: "have lived" }).click();
  await page.getByText("正解です！").waitFor();
  await page.screenshot({ path: `${SHOTS}/grammar-mc.png` });
  await page.getByRole("button", { name: "次の問題" }).click();
  await page.getByRole("textbox").fill("I went to Kyoto two times.");
  await page.getByRole("button", { name: "採点する" }).click();
  await page.getByText("惜しい！").waitFor();
  await page.screenshot({ path: `${SHOTS}/grammar-ai.png` });
  await page.getByRole("button", { name: "次の問題" }).click();
  for (const w of ["I", "haven't", "finished", "my", "homework", "yet."]) await page.locator("button", { hasText: new RegExp(`^${w.replace(".", "\\.")}$`) }).last().click();
  await page.screenshot({ path: `${SHOTS}/grammar-reorder.png` });
  await page.getByRole("button", { name: "採点する" }).click();
  await page.getByText("正解です！").waitFor();
  await page.getByRole("button", { name: "次の問題" }).click();
  await page.getByRole("textbox").fill("eaten");
  await page.getByRole("button", { name: "採点する" }).click();
  await page.getByText("正解です！").waitFor();
  await page.getByRole("button", { name: "次の問題" }).click();
  await page.getByRole("textbox").fill("I went to Paris last year.");
  await page.getByRole("button", { name: "採点する" }).click();
  await page.getByRole("button", { name: "結果を見る" }).click();
  await page.getByText("今回の得点").waitFor();
  await page.screenshot({ path: `${SHOTS}/grammar-summary.png` });

  // 英作文
  await page.goto(BASE + "/writing");
  await page.getByLabel("添削する英文").fill("I went to cafe yesterday. I drinked a coffee and it was very delicious.");
  await page.getByRole("button", { name: "添削する" }).click();
  await page.getByText("修正前と修正後の比較").waitFor();
  await page.screenshot({ path: `${SHOTS}/writing.png`, fullPage: true });
  await page.getByRole("tab", { name: "履歴" }).click();
  await page.screenshot({ path: `${SHOTS}/writing-history.png` });

  // 復習（期限を過去にするため DB を直接は触らず、空の状態の表示を確認）
  await page.goto(BASE + "/review");
  await page.getByText(/復習/).first().waitFor();
  await page.screenshot({ path: `${SHOTS}/review.png` });

  await page.goto(BASE + "/progress");
  await page.getByText("日別の学習時間（直近14日）").waitFor();
  await page.screenshot({ path: `${SHOTS}/progress.png`, fullPage: true });
  await page.goto(BASE + "/settings");
  await page.getByText("設定済み").waitFor();
  await page.screenshot({ path: `${SHOTS}/settings.png` });

  // スマホ + ダークモード
  const m = await browser.newContext({ ...devices["iPhone 13"], colorScheme: "dark" });
  const mp = await m.newPage();
  mp.on("pageerror", (e) => errors.push(e.message));
  await mp.goto(BASE + "/");
  await mp.getByText("今日のおすすめ学習").waitFor();
  await mp.screenshot({ path: `${SHOTS}/m-home-dark.png`, fullPage: true });
  await mp.goto(BASE + "/conversation");
  await mp.getByText("会話モード").waitFor();
  await mp.screenshot({ path: `${SHOTS}/m-conv-dark.png` });
  const l = await browser.newContext({ ...devices["iPhone 13"] });
  const lp = await l.newPage();
  await lp.goto(BASE + "/");
  await lp.getByText("今日のおすすめ学習").waitFor();
  await lp.screenshot({ path: `${SHOTS}/m-home.png` });
  await browser.close();
  if (errors.length) {
    console.error("ブラウザでエラーが発生しました:", errors);
    process.exit(1);
  }
  console.log("all pages OK");
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
