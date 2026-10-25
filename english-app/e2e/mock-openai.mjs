/**
 * E2Eテスト用の「偽の OpenAI API」。本物のAPIを呼ばずに、決まった応答を返す。
 * Structured Outputs の形式名（text.format.name）ごとに固定のJSONを返す。
 */
import http from "node:http";
const fixtures = {
  grammar_questions: { questions: [
    { format: "multiple_choice", prompt: "I ___ in Tokyo since 2020.", options: ["live", "lived", "have lived", "am living"], correct_answer: "have lived", acceptable_answers: [], hint_ja: "sinceがヒント", explanation_ja: "継続を表す現在完了形です。", grammar_point: "現在完了（継続）" },
    { format: "translation", prompt: "私は京都に2回行ったことがあります。", options: [], correct_answer: "I have been to Kyoto twice.", acceptable_answers: ["I've visited Kyoto twice."], hint_ja: null, explanation_ja: "経験はhave been toで表します。", grammar_point: "現在完了（経験）" },
    { format: "reorder", prompt: "私はまだ宿題を終えていません。", options: [], correct_answer: "I haven't finished my homework yet.", acceptable_answers: [], hint_ja: null, explanation_ja: "完了の否定はyetを文末に。", grammar_point: "現在完了（完了）" },
    { format: "fill_blank", prompt: "Have you ever ___ sushi? (寿司を食べたことはありますか)", options: [], correct_answer: "eaten", acceptable_answers: ["tried"], hint_ja: null, explanation_ja: "過去分詞を使います。", grammar_point: "過去分詞" },
    { format: "error_correction", prompt: "I have went to Paris last year.", options: [], correct_answer: "I went to Paris last year.", acceptable_answers: [], hint_ja: null, explanation_ja: "last yearは過去形。", grammar_point: "現在完了と過去形" },
  ]},
  grade_result: { score: 7, is_correct: true, verdict_ja: "惜しい！", model_answer: "I have been to Kyoto twice.", explanation_ja: "two timesよりtwiceが自然です。", mistakes: [{ part: "two times", fix: "twice", reason_ja: "2回はtwiceが一般的" }], alternatives: ["I've been to Kyoto twice."] },
  conversation_report: { title_ja: "カフェで注文", summary_ja: "カフェでコーヒーを注文しました。", corrections: [{ type: "grammar", original: "I want coffee", corrected: "I'd like a coffee, please.", explanation_ja: "注文ではI'd likeが丁寧です。", grammar_category: "modals", related: ["Can I get a coffee?"] }, { type: "naturalness", original: "Latte.", corrected: "A latte, please.", explanation_ja: "pleaseを付けると丁寧。", grammar_category: "conversation", related: [] }], good_expressions: [{ expression: "Thank you", comment_ja: "自然でした" }], improvement_points_ja: ["丁寧な依頼表現を使いましょう", "もう少し長く話しましょう"], review_phrases: [1,2,3,4,5].map(i => ({ phrase: `Phrase ${i}`, meaning_ja: `意味${i}`, example: `Example ${i}.` })), scores: { grammar: { score: 6, comment_ja: "a" }, vocabulary: { score: 5, comment_ja: "b" }, fluency: { score: 4, comment_ja: "c" }, engagement: { score: 7, comment_ja: "d" } } },
  writing_correction: { corrected_text: "I went to a café yesterday. I drank a coffee and it was delicious.", overall_comment_ja: "よく書けています。", issues: [{ type: "grammar", original: "cafe", corrected: "a café", explanation_ja: "冠詞が必要です。", grammar_category: "articles_nouns" }, { type: "grammar", original: "drinked", corrected: "drank", explanation_ja: "drinkの過去形はdrank。", grammar_category: "tenses" }, { type: "naturalness", original: "very delicious", corrected: "delicious", explanation_ja: "deliciousにveryは付けにくい。", grammar_category: "other" }], natural_alternatives: [{ text: "I stopped by a café yesterday.", note_ja: "立ち寄ったニュアンス" }] },
  study_plan: {
    message_ja: "今日は冠詞の復習と、カフェでの注文練習に集中しましょう。",
    items: [
      { kind: "review", title_ja: "間違えた表現の復習", detail_ja: "5問", reason_ja: "期限が来た復習が5問あります。", minutes: 3, grammar_category: "none", grammar_weak_drill: false, question_count: 5, conversation_mode: "none", scenario_id: null, writing_topic_ja: null },
      { kind: "grammar", title_ja: "冠詞・名詞の苦手克服ドリル", detail_ja: "5問", reason_ja: "英作文で冠詞の間違いが2回ありました。", minutes: 5, grammar_category: "articles_nouns", grammar_weak_drill: true, question_count: 5, conversation_mode: "none", scenario_id: null, writing_topic_ja: null },
      { kind: "conversation", title_ja: "カフェで注文", detail_ja: "10分", reason_ja: "前回の改善ポイント「丁寧な依頼表現」を練習します。", minutes: 10, grammar_category: "none", grammar_weak_drill: false, question_count: 0, conversation_mode: "cafe", scenario_id: "recommend", writing_topic_ja: null },
      { kind: "writing", title_ja: "英作文", detail_ja: "3文", reason_ja: "書く練習が1週間空いています。", minutes: 10, grammar_category: "none", grammar_weak_drill: false, question_count: 0, conversation_mode: "none", scenario_id: null, writing_topic_ja: "好きなカフェについて3文で書く" },
    ],
  },
  translation: { translation: "This coffee has low acidity and tastes like chocolate.", alternatives: [{ text: "This coffee isn't very acidic and has chocolatey notes.", nuance_ja: "カジュアル" }], grammar_points: [{ point: "taste like ~", explanation_ja: "〜のような味がする" }], notes_ja: null },
};
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (req.url.endsWith("/realtime/client_secrets")) {
      const b = JSON.parse(body); console.log("client_secrets", JSON.stringify(b).slice(0, 300));
      return send(200, { value: "ek_test_123", expires_at: Math.floor(Date.now() / 1000) + 600, session: { type: "realtime", id: "sess_1", object: "realtime.session" } });
    }
    if (req.url.endsWith("/responses")) {
      const b = JSON.parse(body); const name = b.text?.format?.name;
      console.log("responses", name, b.model, "store=", b.store);
      const data = fixtures[name];
      if (!data) return send(400, { error: { message: "unknown format " + name } });
      return send(200, { id: "resp_1", object: "response", created_at: 1, status: "completed", model: b.model, output: [{ id: "msg_1", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(data), annotations: [] }] }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } });
    }
    send(404, { error: { message: "not found " + req.url } });
  });
}).listen(Number(process.env.MOCK_PORT ?? 4010), () => console.log("mock ready"));
