import type { ConversationMetrics } from "@/lib/ai/schemas";

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** 発話の開始時刻（ミリ秒） */
  at: number;
}

export function countWords(text: string): number {
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g);
  return words ? words.length : 0;
}

export function computeMetrics(
  transcript: TranscriptEntry[],
  durationSec: number,
  userSpeakingSec: number,
  aiSpeakingSec: number,
): ConversationMetrics {
  const userEntries = transcript.filter((t) => t.role === "user" && t.text.trim() !== "");
  const userWords = userEntries.reduce((sum, t) => sum + countWords(t.text), 0);
  const userTurns = userEntries.length;
  const totalSpeaking = userSpeakingSec + aiSpeakingSec;
  return {
    durationSec,
    userTurns,
    userWords,
    avgWordsPerTurn: userTurns > 0 ? Math.round((userWords / userTurns) * 10) / 10 : 0,
    userSpeakingSec: Math.round(userSpeakingSec),
    aiSpeakingSec: Math.round(aiSpeakingSec),
    userSpeakingRatio: totalSpeaking > 5 ? Math.round((userSpeakingSec / totalSpeaking) * 100) / 100 : null,
    wordsPerMinute: userSpeakingSec > 10 ? Math.round(userWords / (userSpeakingSec / 60)) : null,
  };
}

/** AIに渡すための文字起こしテキスト */
export function transcriptToText(transcript: TranscriptEntry[]): string {
  return transcript
    .filter((t) => t.text.trim() !== "")
    .map((t) => `${t.role === "user" ? "Learner" : "Tutor"}: ${t.text.trim()}`)
    .join("\n");
}
