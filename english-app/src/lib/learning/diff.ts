/** 修正前後の英文を単語単位で比較する（最長共通部分列による差分） */

export type DiffPart = { type: "same" | "removed" | "added"; text: string };

function tokenize(text: string): string[] {
  // 単語と空白を分けて保持し、元の空白を再現できるようにする
  return text.match(/\s+|[^\s]+/g) ?? [];
}

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const n = a.length;
  const m = b.length;
  // 長すぎる文章は計算量が大きいので差分を諦めて全体置換として扱う
  if (n * m > 400_000) {
    return [
      { type: "removed", text: before },
      { type: "added", text: after },
    ];
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("removed", a[i++]);
    } else {
      push("added", b[j++]);
    }
  }
  while (i < n) push("removed", a[i++]);
  while (j < m) push("added", b[j++]);
  return parts;
}
