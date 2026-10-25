/**
 * アプリアイコン（PNG）を SVG から作成するスクリプト。
 * ロゴを変えたときだけ実行：node scripts/generate-icons.cjs
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const logo = (size, padding, radius) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="#0d7a7f"/>
  <g transform="translate(${padding} ${padding}) scale(${(64 - padding * 2) / 64})">
    <path d="M14 42c6.5-15 12-23 18-23s11.5 8 18 23" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="32" cy="47" r="3.6" fill="#fff"/>
  </g>
</svg>`;

const targets = [
  { file: "public/icons/icon-192.png", size: 192, padding: 0, radius: 14 },
  { file: "public/icons/icon-512.png", size: 512, padding: 0, radius: 14 },
  // maskable：端末側で丸く切り抜かれても欠けないよう余白を多めに、角丸なし
  { file: "public/icons/maskable-512.png", size: 512, padding: 10, radius: 0 },
  // iPhone のホーム画面用（角丸は iOS が付ける）
  { file: "src/app/apple-icon.png", size: 180, padding: 2, radius: 0 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const t of targets) {
    await page.setViewportSize({ width: t.size, height: t.size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${logo(t.size, t.padding, t.radius)}</body></html>`);
    await page.locator("svg").screenshot({ path: path.join(root, t.file), omitBackground: true });
    console.log("wrote", t.file);
  }
  await browser.close();
  if (!fs.existsSync(path.join(root, "public/icons/icon-512.png"))) process.exit(1);
})();
