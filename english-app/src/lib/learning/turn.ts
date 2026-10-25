import type { Level, TurnMode } from "./lesson";

/** 初級ほど考える時間が必要なので、発話終了とみなすまでの無音時間を長くする */
const SILENCE_MS: Record<Level, number> = {
  beginner: 1100,
  elementary: 900,
  intermediate: 700,
  advanced: 600,
};

export type TurnDetectionConfig =
  | {
      type: "server_vad";
      threshold: number;
      prefix_padding_ms: number;
      silence_duration_ms: number;
      idle_timeout_ms: number;
      create_response: boolean;
      interrupt_response: boolean;
    }
  | { type: "semantic_vad"; eagerness: "low" | "medium" | "high" | "auto"; create_response: boolean; interrupt_response: boolean }
  | null;

/**
 * Realtime API の発話区切り検出（turn_detection）の設定。
 * - auto：音量ベース（server_vad）。沈黙が続くと AI から話しかける（idle_timeout_ms）
 * - patient：意味ベース（semantic_vad, eagerness=low）。言いよどみでも話し終わりと判定しにくい
 * - push_to_talk：自動検出なし（null）。ボタンを離したときにアプリから返事を依頼する
 */
export function buildTurnDetection(mode: TurnMode, level: Level): TurnDetectionConfig {
  if (mode === "push_to_talk") return null;
  if (mode === "patient") {
    return { type: "semantic_vad", eagerness: "low", create_response: true, interrupt_response: true };
  }
  return {
    type: "server_vad",
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: SILENCE_MS[level],
    idle_timeout_ms: 12_000,
    create_response: true,
    interrupt_response: true,
  };
}
