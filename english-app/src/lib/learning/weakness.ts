/** 苦手分野の順位付け（文法問題の誤答と、英会話・英作文での間違いを合わせて判定） */

export interface WeaknessInput {
  attempts: number;
  wrong: number;
  avgScore: number | null;
  usageMistakes: number;
}

/**
 * 苦手度スコア：大きいほど苦手。
 * - 文法問題の誤答率（解答数が少ないと信頼度が低いので少し割り引く）
 * - 実際の会話・英作文で間違えた回数（実践での間違いは重く見る）
 */
export function weaknessScore(w: WeaknessInput): number {
  const errorRate = w.attempts > 0 ? w.wrong / w.attempts : 0;
  const confidence = Math.min(1, w.attempts / 5);
  return errorRate * confidence * 3 + w.wrong * 0.3 + w.usageMistakes * 0.8;
}

export function rankWeakCategories<T extends WeaknessInput>(items: T[]): T[] {
  return items
    .filter((w) => w.wrong > 0 || w.usageMistakes > 0)
    .sort((a, b) => weaknessScore(b) - weaknessScore(a));
}
