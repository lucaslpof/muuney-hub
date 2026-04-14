import { describe, it, expect } from "vitest";
import {
  MACRO_SAMPLE,
  CREDITO_SAMPLE,
  generateSampleSeries,
  type LatestCard,
  type SeriesDataPoint,
} from "../useHubData";

describe("useHubData — sample data", () => {
  it("MACRO_SAMPLE has at least 6 indicators", () => {
    expect(MACRO_SAMPLE.length).toBeGreaterThanOrEqual(6);
  });

  it("CREDITO_SAMPLE has at least 10 indicators", () => {
    expect(CREDITO_SAMPLE.length).toBeGreaterThanOrEqual(10);
  });

  it("MACRO_SAMPLE items have required shape", () => {
    MACRO_SAMPLE.forEach((card: LatestCard) => {
      expect(card).toHaveProperty("serie_code");
      expect(card).toHaveProperty("category");
      expect(card).toHaveProperty("display_name");
      expect(card).toHaveProperty("last_value");
      expect(card).toHaveProperty("trend");
      expect(["up", "down", "stable"]).toContain(card.trend);
    });
  });

  it("MACRO_SAMPLE Selic has expected value range", () => {
    const selic = MACRO_SAMPLE.find((c) => c.serie_code === "selic_meta");
    expect(selic).toBeDefined();
    expect(selic!.last_value).toBeGreaterThan(0);
    expect(selic!.last_value).toBeLessThan(30);
  });
});

describe("generateSampleSeries", () => {
  it("generates correct number of points", () => {
    const series = generateSampleSeries(100, 12);
    expect(series).toHaveLength(13); // 12 + 1 (inclusive range)
  });

  it("generates valid data points", () => {
    const series = generateSampleSeries(50, 6, 0.01);
    series.forEach((point: SeriesDataPoint) => {
      expect(point).toHaveProperty("date");
      expect(point).toHaveProperty("value");
      expect(typeof point.date).toBe("string");
      expect(typeof point.value).toBe("number");
      expect(point.value).toBeGreaterThan(0);
    });
  });

  it("dates are in ISO format (YYYY-MM-DD)", () => {
    const series = generateSampleSeries(100, 3);
    series.forEach((point: SeriesDataPoint) => {
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("values stay within reasonable bounds of baseValue", () => {
    const base = 100;
    const series = generateSampleSeries(base, 24, 0.02);
    series.forEach((point: SeriesDataPoint) => {
      // With 2% volatility over 24 points, value shouldn't deviate wildly
      expect(point.value).toBeGreaterThan(base * 0.3);
      expect(point.value).toBeLessThan(base * 3);
    });
  });
});
