import { NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/client";
import { replyHintSchema } from "@/lib/ai/schemas";
import { handleRouteError, parseJson } from "@/lib/api";
import { LEVEL_INFO, MODE_INFO, getScenario } from "@/lib/learning/lesson";
import { transcriptToText } from "@/lib/learning/transcript";
import { requireConversation } from "@/lib/server/conversations";

export const maxDuration = 60;

const bodySchema = z.object({
  transcript: z
    .array(z.object({ id: z.string().max(100), role: z.enum(["user", "assistant"]), text: z.string().max(5000), at: z.number() }))
    .min(1, "会話が始まってから使ってください")
    .max(40),
});

const INSTRUCTIONS = `あなたは英会話レッスン中の日本人学習者をそっと助けるアシスタントです。
AI講師（Tutor）が最後に言ったことに対して、学習者がそのまま言える自然な返答例を3つ作ってください。
- 学習者のレベルに合わせた語彙・文の長さにする（初級なら短く簡単に）。
- 1つ目は短く簡単な答え、2つ目は理由や具体例を1つ加えた答え、3つ目は答えたあとに講師へ質問を返す答え。
- 会話の場面や役割（ロールプレイの客・店員など）に合わせる。`;

/** 会話中の「ヒント」：AI講師の最後の質問への返答例を、テキストモデルで作る（音声会話は止めない） */
export async function POST(req: Request, ctx: RouteContext<"/api/conversations/[id]/hint">) {
  try {
    const { id } = await ctx.params;
    const { transcript } = await parseJson(req, bodySchema);
    const c = requireConversation(id);
    const s = c.settings;
    const hint = await generateStructured({
      schema: replyHintSchema,
      name: "reply_hint",
      instructions: INSTRUCTIONS,
      input: [
        `Lesson: ${MODE_INFO[s.mode].label} / ${getScenario(s.mode, s.scenarioId).brief}${s.customTopic ? ` / ${s.customTopic}` : ""}`,
        `Learner level: CEFR ${LEVEL_INFO[s.level].cefr}`,
        `Recent conversation:`,
        transcriptToText(transcript.slice(-10)),
      ].join("\n"),
      maxOutputTokens: 2000,
    });
    return NextResponse.json({ hint });
  } catch (err) {
    return handleRouteError(err);
  }
}
