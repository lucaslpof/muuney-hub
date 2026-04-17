/**
 * statistics.ts — Frontend analytics utilities for muuney.hub Macro module
 * Provides: SMA, EMA, correlation, linear regression, ARIMA-lite, z-score
 */

export interface DataPoint {
  date: string;
  value: number;
}

/* ─── Simple Moving Average ─── */
export function sma(data: DataPoint[], window: number): DataPoint[] {
  if (data.length < window) return [];
  const result: DataPoint[] = [];
  for (let i = window - 1; i < data.length; i++) {
    const slice = data.slice(i - window + 1, i + 1);
    const avg = slice.reduce((sum, d) => sum + d.value, 0) / window;
    result.push({ date: data[i].date, value: Math.round(avg * 100) / 100 });
  }
  return result;
}

/* ─── Exponential Moving Average ─── */
export function ema(data: DataPoint[], window: number): DataPoint[] {
  if (data.length < 2) return [];
  const k = 2 / (window + 1);
  const result: DataPoint[] = [{ date: data[0].date, value: data[0].value }];
  for (let i = 1; i < data.length; i++) {
    const prev = result[i - 1].value;
    const val = data[i].value * k + prev * (1 - k);
    result.push({ date: data[i].date, value: Math.round(val * 100) / 100 });
  }
  return result;
}

/* ─── Pearson Correlation ─── */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
}

/* ─── Correlation Matrix ─── */
export interface CorrelationEntry {
  serieA: string;
  serieB: string;
  r: number;
}

export function correlationMatrix(
  series: Record<string, number[]>
): CorrelationEntry[] {
  const keys = Object.keys(series);
  const results: CorrelationEntry[] = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      results.push({
        serieA: keys[i],
        serieB: keys[j],
        r: pearsonCorrelation(series[keys[i]], series[keys[j]]),
      });
    }
  }
  return results;
}

/* ─── Linear Regression (OLS) ─── */
export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  forecast: DataPoint[];
}

export function linearRegression(
  data: DataPoint[],
  forecastPeriods: number = 6
): RegressionResult {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0, forecast: [] };

  const xs = data.map((_, i) => i);
  const ys = data.map((d) => d.value);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0, den = 0, ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : Math.round((1 - ssRes / ssTot) * 1000) / 1000;

  // Generate forecast points
  const lastDate = new Date(data[data.length - 1].date);
  const forecast: DataPoint[] = [];
  for (let i = 1; i <= forecastPeriods; i++) {
    const futureDate = new Date(lastDate);
    futureDate.setMonth(futureDate.getMonth() + i);
    const val = slope * (n - 1 + i) + intercept;
    forecast.push({
      date: futureDate.toISOString().split("T")[0],
      value: Math.round(val * 100) / 100,
    });
  }

  return { slope: Math.round(slope * 10000) / 10000, intercept: Math.round(intercept * 100) / 100, r2, forecast };
}

/* ─── Percent Change (MoM / QoQ / YoY) ─── */
export function percentChange(data: DataPoint[], lag: number = 1): DataPoint[] {
  return data.slice(lag).map((d, i) => ({
    date: d.date,
    value: data[i].value === 0 ? 0 : Math.round(((d.value - data[i].value) / Math.abs(data[i].value)) * 10000) / 100,
  }));
}

/* ─── Rolling Standard Deviation ─── */
export function rollingStd(data: DataPoint[], window: number): DataPoint[] {
  if (data.length < window) return [];
  const result: DataPoint[] = [];
  for (let i = window - 1; i < data.length; i++) {
    const slice = data.slice(i - window + 1, i + 1).map((d) => d.value);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / window;
    result.push({ date: data[i].date, value: Math.round(Math.sqrt(variance) * 100) / 100 });
  }
  return result;
}

/* ─── Z-Score (deviation from mean in std units) ─── */
export function zScore(data: DataPoint[]): DataPoint[] {
  if (data.length < 2) return [];
  const values = data.map((d) => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
  if (std === 0) return data.map((d) => ({ date: d.date, value: 0 }));
  return data.map((d) => ({
    date: d.date,
    value: Math.round(((d.value - mean) / std) * 100) / 100,
  }));
}

/* ─── Cumulative Return (inflação acumulada) ─── */
export function cumulativeReturn(data: DataPoint[]): DataPoint[] {
  let cum = 1;
  return data.map((d) => {
    cum *= 1 + d.value / 100;
    return { date: d.date, value: Math.round((cum - 1) * 10000) / 100 };
  });
}

/* ─── Health Index (composite score from multiple series) ─── */
export function healthIndex(
  components: { data: DataPoint[]; weight: number; higherIsBetter: boolean }[]
): DataPoint[] {
  if (components.length === 0) return [];
  const lens = components.map((c) => c.data.length);
  const minLen = lens.length > 0 ? Math.min(...lens) : 0;
  if (minLen === 0 || !Number.isFinite(minLen)) return [];

  const result: DataPoint[] = [];
  for (let i = 0; i < minLen; i++) {
    let score = 0;
    for (const comp of components) {
      const zScores = zScore(comp.data);
      if (i < zScores.length) {
        const z = comp.higherIsBetter ? zScores[i].value : -zScores[i].value;
        score += z * comp.weight;
      }
    }
    // Normalize to 0-100 scale (sigmoid-like)
    const normalized = Math.round((1 / (1 + Math.exp(-score))) * 100);
    result.push({ date: components[0].data[i].date, value: normalized });
  }
  return result;
}

/* ─── Sentiment Delta (week-over-week change in expectations) ─── */
export function sentimentDelta(data: DataPoint[]): DataPoint[] {
  return data.slice(1).map((d, i) => ({
    date: d.date,
    value: Math.round((d.value - data[i].value) * 100) / 100,
  }));
}

/* ─── Merge two series for dual-axis charts ─── */
export function mergeSeries(
  a: DataPoint[],
  b: DataPoint[],
  labelA = "value",
  labelB = "value2"
): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const d of a) map.set(d.date, { date: d.date, [labelA]: d.value });
  for (const d of b) {
    const existing = map.get(d.date) || { date: d.date };
    existing[labelB] = d.value;
    map.set(d.date, existing);
  }
  return Array.from(map.values()).sort(
    (x, y) => new Date(x.date as string).getTime() - new Date(y.date as string).getTime()
  );
}
