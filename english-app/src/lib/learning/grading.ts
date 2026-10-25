/**
 * AIを使わずに判定できる部分の採点ロジック。
 * 確実に正解と言えるときだけローカルで判定し、それ以外は AI に採点を任せる（APIコスト削減）。
 */

/** 比較用に英文を正規化する（大文字小文字・空白・引用符・文末記号の違いを無視） */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*([,.!?;:])\s*/g, "$1 ")
    .trim()
    .replace(/[.!?。]+$/u, "")
    .trim();
}

/** 短縮形を展開して比較するためのバリエーション（I'm と I am を同一視） */
const CONTRACTIONS: [RegExp, string][] = [
  [/\bi'm\b/g, "i am"],
  [/\b(you|we|they)'re\b/g, "$1 are"],
  [/\b(he|she|it|that|there|what|who)'s\b/g, "$1 is"],
  [/\b(i|you|we|they)'ve\b/g, "$1 have"],
  [/\b(i|you|we|they|he|she|it)'ll\b/g, "$1 will"],
  [/\b(i|you|we|they|he|she|it)'d\b/g, "$1 would"],
  [/\bcan't\b/g, "cannot"],
  [/\bwon't\b/g, "will not"],
  [/\b(do|does|did|is|are|was|were|have|has|had|could|should|would|must)n't\b/g, "$1 not"],
];

export function expandContractions(normalized: string): string {
  let s = normalized;
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  return s.replace(/\bcan not\b/g, "cannot");
}

export function answersMatch(a: string, b: string): boolean {
  const na = normalizeAnswer(a);
  const nb = normalizeAnswer(b);
  if (na === nb) return true;
  return expandContractions(na) === expandContractions(nb);
}

export function matchesAny(answer: string, candidates: string[]): boolean {
  return candidates.some((c) => c.trim() !== "" && answersMatch(answer, c));
}

/** 並べ替え問題用：英文を語句に分割する（文末の記号は最後の語に付けたまま） */
export function tokenizeForReorder(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

/** 配列をシャッフルする。元と同じ順序にならないようにする（要素が2つ以上で全て同じでない場合） */
export function shuffleDifferent<T>(items: T[], random: () => number = Math.random): T[] {
  if (items.length < 2) return [...items];
  const allSame = items.every((x) => x === items[0]);
  for (let attempt = 0; attempt < 10; attempt++) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (allSame || arr.some((x, i) => x !== items[i])) return arr;
  }
  // 乱数が偏っている場合でも元の順序にはしない
  return [...items.slice(1), items[0]];
}

export type LocalGrade =
  | { decided: true; score: number; isCorrect: boolean }
  | { decided: false };

export interface GradableQuestion {
  format: "translation" | "multiple_choice" | "fill_blank" | "reorder" | "error_correction";
  correctAnswer: string;
  acceptableAnswers: string[];
}

/**
 * ローカルで採点できるか判定する。
 * - 4択：常にローカル（正解の選択肢と一致するか）
 * - それ以外：模範解答・許容解答と一致すれば満点。一致しない場合は AI に任せる
 *   （別の正しい言い方の可能性があるため、文字列不一致だけで不正解にしない）
 */
export function gradeLocally(q: GradableQuestion, userAnswer: string): LocalGrade {
  const answer = userAnswer.trim();
  if (answer === "") return { decided: true, score: 0, isCorrect: false };
  const candidates = [q.correctAnswer, ...q.acceptableAnswers];
  if (q.format === "multiple_choice") {
    const ok = answersMatch(answer, q.correctAnswer);
    return { decided: true, score: ok ? 10 : 0, isCorrect: ok };
  }
  if (matchesAny(answer, candidates)) return { decided: true, score: 10, isCorrect: true };
  return { decided: false };
}
