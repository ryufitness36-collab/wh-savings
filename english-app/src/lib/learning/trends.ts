/** 学習傾向（AIを使わずに計算できる事実） */

export interface TrendFacts {
  /** 時間帯（0〜23時）ごとの学習秒数（直近60日） */
  hourly: number[];
  /** 最もよく学習する時間帯（3時間の幅の開始時刻）。データがなければ null */
  bestTimeSlot: number | null;
  /** 直近14日の1日平均学習分（学習した日のみ） */
  avgMinutesPerStudyDay: number | null;
  /** 英会話スコア（総合）の変化：最初の3回の平均 → 最近3回の平均 */
  scoreChange: { from: number; to: number } | null;
  /** 1回あたりの発話語数の変化 */
  wordsPerTurnChange: { from: number; to: number } | null;
}

function avg(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** 0〜23時の学習秒数から、合計が最大になる連続3時間の開始時刻を返す */
export function bestTimeSlot(hourly: number[]): number | null {
  if (hourly.every((s) => s === 0)) return null;
  let best = 0;
  let bestSum = -1;
  for (let h = 0; h < 24; h++) {
    const sum = hourly[h] + hourly[(h + 1) % 24] + hourly[(h + 2) % 24];
    if (sum > bestSum) {
      bestSum = sum;
      best = h;
    }
  }
  return best;
}

/** 古い順の値から「最初の n 回の平均 → 最近の n 回の平均」を求める（2回以上ないと null） */
export function change(values: number[], n = 3): { from: number; to: number } | null {
  if (values.length < 2) return null;
  const k = Math.min(n, Math.floor(values.length / 2));
  return { from: round1(avg(values.slice(0, k))), to: round1(avg(values.slice(-k))) };
}

export function computeTrendFacts(input: {
  hourly: number[];
  dailySeconds: number[];
  overallScores: number[];
  wordsPerTurn: number[];
}): TrendFacts {
  const studied = input.dailySeconds.filter((s) => s > 0);
  return {
    hourly: input.hourly,
    bestTimeSlot: bestTimeSlot(input.hourly),
    avgMinutesPerStudyDay: studied.length ? Math.round(avg(studied) / 60) : null,
    scoreChange: change(input.overallScores),
    wordsPerTurnChange: change(input.wordsPerTurn),
  };
}
