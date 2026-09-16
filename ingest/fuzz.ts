// String similarity in the style of rapidfuzz (Indel-normalised ratios, 0–100).

function lcsLength(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let prev = new Uint16Array(b.length + 1);
  let cur = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
    cur.fill(0);
  }
  return prev[b.length];
}

export function ratio(a: string, b: string): number {
  if (!a.length && !b.length) return 100;
  return (200 * lcsLength(a, b)) / (a.length + b.length);
}

const tokens = (s: string) => s.split(/\s+/).filter(Boolean);

export function tokenSortRatio(a: string, b: string): number {
  return ratio(tokens(a).sort().join(" "), tokens(b).sort().join(" "));
}

export function tokenSetRatio(a: string, b: string): number {
  const ta = new Set(tokens(a)), tb = new Set(tokens(b));
  const inter = [...ta].filter((t) => tb.has(t)).sort();
  const da = [...ta].filter((t) => !tb.has(t)).sort();
  const db = [...tb].filter((t) => !ta.has(t)).sort();
  if (!inter.length) return ratio([...ta].sort().join(" "), [...tb].sort().join(" "));
  if (!da.length || !db.length) return 100;
  const s = inter.join(" ");
  const sa = [s, ...da].join(" "), sb = [s, ...db].join(" ");
  return Math.max(ratio(s, sa), ratio(s, sb), ratio(sa, sb));
}

export function partialRatio(a: string, b: string): number {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (!short.length) return 0;
  let best = 0;
  for (let i = 0; i + short.length <= long.length; i++) {
    best = Math.max(best, ratio(short, long.slice(i, i + short.length)));
    if (best === 100) break;
  }
  return long.length < short.length ? ratio(short, long) : best;
}
