import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI, toAppError } from "@/lib/ai/client";
import { handleRouteError, parseJson } from "@/lib/api";
import { env } from "@/lib/env";
import { buildTutorInstructions } from "@/lib/learning/instructions";
import { SPEED_INFO, getTeacher } from "@/lib/learning/lesson";
import { buildTurnDetection } from "@/lib/learning/turn";
import { getPracticeTargets, requireConversation } from "@/lib/server/conversations";

const bodySchema = z.object({
  conversationId: z.string().min(1),
  /** スマホなど口元に近いマイクなら near_field、PCの内蔵マイクなら far_field */
  micType: z.enum(["near_field", "far_field"]).default("far_field"),
});

/**
 * ブラウザが OpenAI Realtime API に WebRTC で直接接続するための「一時キー」を発行する。
 * 本物の APIキーはサーバーから出さず、数分で失効するキーだけをブラウザに渡す。
 */
export async function POST(req: Request) {
  try {
    const { conversationId, micType } = await parseJson(req, bodySchema);
    const conversation = requireConversation(conversationId);
    const s = conversation.settings;
    const practiceTargets = getPracticeTargets(conversation.practiceOf);
    const client = getOpenAI();

    try {
      const secret = await client.realtime.clientSecrets.create({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: env.realtimeModel,
          instructions: buildTutorInstructions(s, practiceTargets),
          output_modalities: ["audio"],
          audio: {
            input: {
              noise_reduction: { type: micType },
              transcription: {
                model: env.transcribeModel,
                prompt: "English conversation practice by a Japanese learner. The learner sometimes speaks Japanese.",
              },
              // 発話の区切り検出・割り込み・沈黙時の声かけ（押して話すモードでは無効）
              turn_detection: buildTurnDetection(s.turnMode, s.level),
            },
            output: {
              voice: getTeacher(s.teacherId).voice,
              speed: SPEED_INFO[s.speed].value,
            },
          },
        },
      });
      return NextResponse.json({
        clientSecret: secret.value,
        expiresAt: secret.expires_at,
        model: env.realtimeModel,
      });
    } catch (err) {
      throw toAppError(err);
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
