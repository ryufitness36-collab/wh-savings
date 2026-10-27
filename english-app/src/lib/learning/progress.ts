import { z } from "zod";

export const progressSchema = z.object({
  transcript: z
    .array(
      z.object({
        id: z.string().max(100),
        role: z.enum(["user", "assistant"]),
        text: z.string().max(5000),
        at: z.number(),
      }),
    )
    .max(2000),
  durationSec: z.number().min(0).max(24 * 3600),
  userSpeakingSec: z.number().min(0).max(24 * 3600),
  aiSpeakingSec: z.number().min(0).max(24 * 3600),
});
