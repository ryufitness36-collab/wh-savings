import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI, toAppError } from "@/lib/ai/client";
import { handleRouteError, parseJson } from "@/lib/api";
import { env } from "@/lib/env";
import { buildTutorInstructions } from "@/lib/learning/instructions";
import { SPEED_INFO, getTeacher, type Level } from "@/lib/learning/lesson";
import { getPracticeTargets, requireConversation } from "@/lib/server/conversations";

const bodySchema = z.object({
  conversationId: z.string().min(1),
  /** スマホなど口元に近いマイクなら near_field、PCの内蔵マイクなら far_field */
  micType: z.enum(["near_field", "far_field"]).default("far_field"),
});

/** 初級ほど考える時間が必要なので、発話終了とみなすまでの無音時間を長くする */
const SILENCE_MS: Record<Level, number> = {
  beginner: 1100,
  elementary: 900,
  intermediate: 700,
  advanced: 600,
};

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
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: SILENCE_MS[s.level],
                // 会話が止まったら AI から話しかける（AIの音声再生終了から数える）
                idle_timeout_ms: 12_000,
                create_response: true,
                // ユーザーが話し始めたら AI の発話を止める（割り込み）
                interrupt_response: true,
              },
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
