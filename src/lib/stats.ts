/**
 * Statistical routines implemented without external dependencies so the
 * analysis layer stays testable and works fully offline.
 */

export interface Descriptive {
  n: number;
  mean: number;
  median: number;
  sd: number;
  variance: number;
  min: number;
  max: number;
  range: number;
}

export const sum = (values: number[]): number =>
  values.reduce((acc, value) => acc + value, 0);

export const mean = (values: number[]): number =>
  values.length === 0 ? Number.NaN : sum(values) / values.length;

export function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function variance(values: number[], sample = true): number {
  const n = values.length;
  if (n < 2) return Number.NaN;
  const m = mean(values);
  const ss = values.reduce((acc, value) => acc + (value - m) ** 2, 0);
  return ss / (sample ? n - 1 : n);
}

export const standardDeviation = (values: number[], sample = true): number =>
  Math.sqrt(variance(values, sample));

export function quantile(values: number[], q: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] === undefined) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

export function describe(values: number[]): Descriptive {
  if (values.length === 0) {
    return {
      n: 0,
      mean: Number.NaN,
      median: Number.NaN,
      sd: Number.NaN,
      variance: Number.NaN,
      min: Number.NaN,
      max: Number.NaN,
      range: Number.NaN,
    };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    n: values.length,
    mean: mean(values),
    median: median(values),
    sd: values.length > 1 ? standardDeviation(values) : 0,
    variance: values.length > 1 ? variance(values) : 0,
    min,
    max,
    range: max - min,
  };
}

/* ------------------------------------------------------------------ */
/* Distribution helpers                                                */
/* ------------------------------------------------------------------ */

function logGamma(x: number): number {
  const coefficients = [
    76.18009173, -86.50532033, 24.01409824, -1.231739572,
    0.1208650974e-2, -0.5395239385e-5,
  ];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const c of coefficients) {
    y += 1;
    ser += c / y;
  }
  return -tmp + Math.log((2.506628274631 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAX_ITER = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-tailed p-value for Student's t. */
export function tTestPValue(t: number, df: number): number {
  if (!Number.isFinite(t) || df <= 0) return Number.NaN;
  const x = df / (df + t * t);
  const p = incompleteBeta(df / 2, 0.5, x);
  return Math.min(1, Math.max(0, p));
}

/** Survival function of the chi-square distribution. */
export function chiSquarePValue(chi2: number, df: number): number {
  if (!Number.isFinite(chi2) || df <= 0) return Number.NaN;
  const a = df / 2;
  const x = chi2 / 2;
  // Lower regularized incomplete gamma via series / continued fraction.
  let p: number;
  if (x < a + 1) {
    let ap = a;
    let del = 1 / a;
    let total = del;
    for (let i = 0; i < 500; i++) {
      ap += 1;
      del *= x / ap;
      total += del;
      if (Math.abs(del) < Math.abs(total) * 1e-12) break;
    }
    p = total * Math.exp(-x + a * Math.log(x) - logGamma(a));
  } else {
    let b = x + 1 - a;
    let c = 1e300;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i <= 500; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-12) break;
    }
    p = 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
  }
  return Math.min(1, Math.max(0, 1 - p));
}

/** Two-tailed p-value of a standard normal statistic. */
export function normalPValue(z: number): number {
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989423 * Math.exp((-absZ * absZ) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return Math.min(1, Math.max(0, 2 * p));
}

/* ------------------------------------------------------------------ */
/* Inferential tests                                                   */
/* ------------------------------------------------------------------ */

export interface PairedTResult {
  n: number;
  meanDifference: number;
  sdDifference: number;
  t: number;
  df: number;
  p: number;
  effectSize: number;
  ciLow: number;
  ciHigh: number;
  excluded: number;
}

export function pairedTTest(pre: number[], post: number[]): PairedTResult {
  const pairs: [number, number][] = [];
  const len = Math.min(pre.length, post.length);
  for (let i = 0; i < len; i++) {
    if (Number.isFinite(pre[i]) && Number.isFinite(post[i])) {
      pairs.push([pre[i], post[i]]);
    }
  }
  const diffs = pairs.map(([a, b]) => b - a);
  const n = diffs.length;
  const excluded = len - n;
  if (n < 2) {
    return {
      n,
      meanDifference: n ? diffs[0] : Number.NaN,
      sdDifference: Number.NaN,
      t: Number.NaN,
      df: Math.max(0, n - 1),
      p: Number.NaN,
      effectSize: Number.NaN,
      ciLow: Number.NaN,
      ciHigh: Number.NaN,
      excluded,
    };
  }
  const m = mean(diffs);
  const sd = standardDeviation(diffs);
  const se = sd / Math.sqrt(n);
  const t = m / se;
  const df = n - 1;
  // Critical t approximation via search for 95% two-tailed coverage.
  let critical = 0;
  let lo = 0;
  let hi = 30;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (tTestPValue(mid, df) > 0.05) lo = mid;
    else hi = mid;
    critical = (lo + hi) / 2;
  }
  return {
    n,
    meanDifference: m,
    sdDifference: sd,
    t,
    df,
    p: tTestPValue(t, df),
    effectSize: sd === 0 ? 0 : m / sd,
    ciLow: m - critical * se,
    ciHigh: m + critical * se,
    excluded,
  };
}

export interface WilcoxonResult {
  n: number;
  positives: number;
  negatives: number;
  ties: number;
  wPlus: number;
  wMinus: number;
  z: number;
  p: number;
  effectSize: number;
  excluded: number;
}

export function wilcoxonSignedRank(
  pre: number[],
  post: number[],
): WilcoxonResult {
  const diffs: number[] = [];
  const len = Math.min(pre.length, post.length);
  for (let i = 0; i < len; i++) {
    if (Number.isFinite(pre[i]) && Number.isFinite(post[i])) {
      diffs.push(post[i] - pre[i]);
    }
  }
  const nonZero = diffs.filter((d) => d !== 0);
  const n = nonZero.length;
  const zeros = diffs.length - n;
  const result: WilcoxonResult = {
    n: diffs.length,
    positives: nonZero.filter((d) => d > 0).length,
    negatives: nonZero.filter((d) => d < 0).length,
    ties: zeros,
    wPlus: 0,
    wMinus: 0,
    z: Number.NaN,
    p: Number.NaN,
    effectSize: Number.NaN,
    excluded: len - diffs.length,
  };
  if (n < 1) return result;

  const ranks = rankAbs(nonZero);
  let wPlus = 0;
  let wMinus = 0;
  let tieCorrection = 0;
  const groups = new Map<number, number>();
  nonZero.forEach((d, index) => {
    if (d > 0) wPlus += ranks[index];
    else wMinus += ranks[index];
    const key = Math.abs(d);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  });
  groups.forEach((count) => {
    if (count > 1) tieCorrection += count ** 3 - count;
  });

  const expected = (n * (n + 1)) / 4;
  const varianceValue = (n * (n + 1) * (2 * n + 1)) / 24 - tieCorrection / 48;
  const sdValue = Math.sqrt(Math.max(varianceValue, 1e-9));
  const z = (wPlus - expected) / sdValue;
  return {
    ...result,
    wPlus,
    wMinus,
    z,
    p: normalPValue(z),
    effectSize: Math.abs(z) / Math.sqrt(n),
  };
}

function rankAbs(values: number[]): number[] {
  const indexed = values.map((value, index) => ({
    index,
    value: Math.abs(value),
  }));
  indexed.sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) {
      j++;
    }
    const averageRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[indexed[k].index] = averageRank;
    i = j + 1;
  }
  return ranks;
}

export interface FriedmanResult {
  n: number;
  k: number;
  chiSquare: number;
  df: number;
  p: number;
  kendallW: number;
  excluded: number;
}

export function friedmanTest(matrix: (number | null)[][]): FriedmanResult {
  // matrix: rows are students, columns are occasions.
  const complete = matrix.filter((row) => row.every((v) => Number.isFinite(v)));
  const n = complete.length;
  const k = matrix[0]?.length ?? 0;
  const excluded = matrix.length - n;
  if (n < 2 || k < 3) {
    return {
      n,
      k,
      chiSquare: Number.NaN,
      df: Math.max(0, k - 1),
      p: Number.NaN,
      kendallW: Number.NaN,
      excluded,
    };
  }
  const rankSums = new Array<number>(k).fill(0);
  for (const row of complete) {
    const values = row as number[];
    const ranks = rankAscending(values);
    ranks.forEach((rank, index) => {
      rankSums[index] += rank;
    });
  }
  const chiSquare =
    (12 / (n * k * (k + 1))) * sum(rankSums.map((r) => r * r)) -
    3 * n * (k + 1);
  return {
    n,
    k,
    chiSquare: Math.max(0, chiSquare),
    df: k - 1,
    p: chiSquarePValue(Math.max(0, chiSquare), k - 1),
    kendallW: Math.max(0, chiSquare) / (n * (k - 1)),
    excluded,
  };
}

function rankAscending(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ index, value }));
  indexed.sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) {
      j++;
    }
    const averageRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[indexed[k].index] = averageRank;
    i = j + 1;
  }
  return ranks;
}

export function holmAdjust(pValues: number[]): number[] {
  const indexed = pValues.map((p, index) => ({ p, index }));
  indexed.sort((a, b) => a.p - b.p);
  const m = pValues.length;
  const adjusted = new Array<number>(m).fill(Number.NaN);
  let running = 0;
  indexed.forEach(({ p, index }, rank) => {
    const value = Math.min(1, (m - rank) * p);
    running = Math.max(running, value);
    adjusted[index] = running;
  });
  return adjusted;
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
}

export function linearRegression(x: number[], y: number[]): RegressionResult {
  const n = Math.min(x.length, y.length);
  if (n < 2) {
    return { slope: Number.NaN, intercept: Number.NaN, r2: Number.NaN, n };
  }
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n };
}

export function clampScore(value: number, max: number): number {
  return Math.min(max, Math.max(0, value));
}
