/**
 * E2Eテスト用の「偽の OpenAI Realtime サーバー」。
 * 別タブで RTCPeerConnection を作り、アプリからの WebRTC 接続（SDP オファー）に応答し、
 * データチャンネルで Realtime API と同じ形式のイベントを送る。
 */
async function setupFakeRealtime(ctx, page, BASE, log = true) {
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

  await page.route("https://api.openai.com/v1/realtime/calls", async (route) => {
    const req = route.request();
    if (log) console.log("calls endpoint auth:", req.headers()["authorization"], "ct:", req.headers()["content-type"]);
    const answer = await fake.evaluate((sdp) => window.createAnswer(sdp), req.postData());
    await route.fulfill({ status: 201, contentType: "application/sdp", body: answer });
  });
  return fake;
}

module.exports = { setupFakeRealtime };
