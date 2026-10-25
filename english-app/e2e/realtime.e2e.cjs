/**
 * AI英会話（WebRTC）のE2Eテスト。
 * 本物の OpenAI の代わりに、別タブに「偽の Realtime サーバー」を作り、
 * 実際の WebRTC 接続・データチャンネルのイベント・字幕・再接続・終了→レポートまでを確認する。
 */
const { chromium } = require("playwright");
const SHOTS = process.argv[2] ?? require("node:path").join(__dirname, "screenshots");
require("node:fs").mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";

(async () => {
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ["microphone"] });
  const fake = await ctx.newPage();
  await fake.goto(BASE + "/api/status");
  // 偽の OpenAI Realtime ピア
  await fake.evaluate(() => {
    window.received = [];
    window.createAnswer = async (offerSdp) => {
      const pc = new RTCPeerConnection();
      window.pc = pc;
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      const dest = ac.createMediaStreamDestination();
      osc.connect(dest); osc.start();
      dest.stream.getTracks().forEach((t) => pc.addTrack(t, dest.stream));
      pc.ondatachannel = (e) => {
        const dc = e.channel; window.dc = dc;
        dc.onmessage = (m) => { const ev = JSON.parse(m.data); window.received.push(ev); if (ev.type === "response.create") window.respond(ev); };
      };
      await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await new Promise((r) => { if (pc.iceGatheringState === "complete") r(); else pc.onicegatheringstatechange = () => pc.iceGatheringState === "complete" && r(); setTimeout(r, 2000); });
      return pc.localDescription.sdp;
    };
    let n = 0;
    const send = (o) => window.dc.send(JSON.stringify(o));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.respond = async (req) => {
      n++;
      const rid = "resp_" + n, iid = "item_ai_" + n;
      const text = req.response?.instructions?.includes("lesson time is over") ? "Great job today! Goodbye!" : n === 1 ? "Hi there! Welcome to our cafe. What would you like to drink today?" : "Nice choice! Would you like it hot or iced?";
      send({ type: "response.created", response: { id: rid } });
      send({ type: "conversation.item.added", item: { id: iid, type: "message", role: "assistant", content: [] } });
      send({ type: "output_audio_buffer.started", response_id: rid });
      for (const w of text.split(" ")) { send({ type: "response.output_audio_transcript.delta", item_id: iid, delta: w + " " }); await sleep(60); }
      send({ type: "response.output_audio_transcript.done", item_id: iid, transcript: text });
      send({ type: "response.done", response: { id: rid, status: "completed" } });
      await sleep(300);
      send({ type: "output_audio_buffer.stopped", response_id: rid });
    };
    window.userSays = async (text, id) => {
      send({ type: "input_audio_buffer.speech_started" });
      await sleep(1200);
      send({ type: "input_audio_buffer.speech_stopped" });
      send({ type: "conversation.item.added", item: { id, type: "message", role: "user", content: [{ type: "input_audio" }] } });
      send({ type: "conversation.item.input_audio_transcription.delta", item_id: id, delta: text.slice(0, 5) });
      await sleep(200);
      send({ type: "conversation.item.input_audio_transcription.completed", item_id: id, transcript: text });
      await window.respond({});
    };
  });

  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("[page]", m.type(), m.text().slice(0, 200)); });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.route("https://api.openai.com/v1/realtime/calls", async (route) => {
    const req = route.request();
    console.log("calls endpoint auth:", req.headers()["authorization"], "ct:", req.headers()["content-type"]);
    const answer = await fake.evaluate((sdp) => window.createAnswer(sdp), req.postData());
    await route.fulfill({ status: 201, contentType: "application/sdp", body: answer });
  });

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
