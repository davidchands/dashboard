/**
 * Unit tests for Sales Insights (rule-based, deterministic).
 * Run: npx vitest run lib/insights.test.js
 */

import { describe, it, expect } from "vitest";
import {
  generateInsights,
  parseDate,
  aggregateByMonth,
  aggregateByWeek,
  groupByProduct,
  groupByCategory,
  computeGrowth,
  detectAnomalies,
  getQuantity,
  getRevenue,
  MIN_ROWS_FOR_INSIGHTS,
  CONCENTRATION_WARN_PCT,
} from "./insights.js";

describe("parseDate", () => {
  it("parses DD-MM-YYYY", () => {
    const r = parseDate("15-03-2025");
    expect(r).not.toBeNull();
    expect(r.day).toBe(15);
    expect(r.month).toBe(3);
    expect(r.year).toBe(2025);
  });
  it("parses YYYY-MM-DD", () => {
    const r = parseDate("2025-03-15");
    expect(r).not.toBeNull();
    expect(r.day).toBe(15);
    expect(r.month).toBe(3);
    expect(r.year).toBe(2025);
  });
  it("returns null for invalid", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("not-a-date")).toBeNull();
    expect(parseDate("32-01-2025")).toBeNull();
  });
});

describe("computeGrowth", () => {
  it("reports trend up", () => {
    const g = computeGrowth(120, 100);
    expect(g.direction).toBe("up");
    expect(g.pct).toBe(20);
    expect(g.text).toContain("up");
  });
  it("reports trend down", () => {
    const g = computeGrowth(80, 100);
    expect(g.direction).toBe("down");
    expect(g.pct).toBe(-20);
    expect(g.text).toContain("down");
  });
  it("reports flat when same", () => {
    const g = computeGrowth(100, 100);
    expect(g.direction).toBe("flat");
    expect(g.pct).toBe(0);
  });
});

describe("groupByProduct", () => {
  it("aggregates revenue and quantity by product", () => {
    const rows = [
      { date: "01-01-2025", product: "A", category: "X", units: 2, price: 10 },
      { date: "02-01-2025", product: "A", category: "X", units: 3, price: 10 },
      { date: "03-01-2025", product: "B", category: "Y", units: 1, price: 50 },
    ];
    const out = groupByProduct(rows);
    expect(out.length).toBe(2);
    const a = out.find((p) => p.product === "A");
    const b = out.find((p) => p.product === "B");
    expect(a.revenue).toBe(50);
    expect(a.quantity).toBe(5);
    expect(b.revenue).toBe(50);
    expect(b.quantity).toBe(1);
  });
});

describe("detectAnomalies", () => {
  it("flags spike when value >> average", () => {
    const periodValues = [
      { period: "Jan", value: 100 },
      { period: "Feb", value: 100 },
      { period: "Mar", value: 100 },
      { period: "Apr", value: 500 },
    ];
    const anomalies = detectAnomalies(periodValues);
    const spike = anomalies.find((a) => a.type === "spike");
    expect(spike).toBeDefined();
    expect(spike.period).toBe("Apr");
  });
  it("flags drop when value << average", () => {
    const periodValues = [
      { period: "Jan", value: 100 },
      { period: "Feb", value: 100 },
      { period: "Mar", value: 10 },
    ];
    const anomalies = detectAnomalies(periodValues);
    const drop = anomalies.find((a) => a.type === "drop");
    expect(drop).toBeDefined();
    expect(drop.period).toBe("Mar");
  });
});

describe("generateInsights", () => {
  it("returns empty when insufficient data", () => {
    const out = generateInsights([]);
    expect(out.findings).toEqual([]);
    expect(out.actions).toEqual([]);
    expect(out.warnings).toEqual([]);
    const out2 = generateInsights([
      { date: "01-01-2025", product: "A", category: "X", units: 1, price: 10 },
      { date: "02-01-2025", product: "B", category: "Y", units: 1, price: 20 },
    ]);
    expect(out2.findings.length).toBe(0);
  });

  it("reports trend down when last period is lower", () => {
    const rows = [
      { date: "01-01-2025", product: "A", category: "X", units: 10, price: 10 },
      { date: "15-01-2025", product: "B", category: "X", units: 10, price: 10 },
      { date: "01-02-2025", product: "A", category: "X", units: 5, price: 10 },
      { date: "15-02-2025", product: "B", category: "X", units: 5, price: 10 },
    ].map((r, i) => ({ ...r, id: i + 1, revenue: r.units * r.price }));
    const out = generateInsights(rows);
    const trendFinding = out.findings.find((f) => f.toLowerCase().includes("down") || f.toLowerCase().includes("february"));
    expect(trendFinding).toBeDefined();
  });

  it("reports top product by revenue", () => {
    const rows = [
      { date: "01-01-2025", product: "Low", category: "X", units: 1, price: 1 },
      { date: "02-01-2025", product: "High", category: "X", units: 100, price: 50 },
      { date: "03-01-2025", product: "Mid", category: "X", units: 10, price: 10 },
    ].map((r, i) => ({ ...r, id: i + 1, revenue: r.units * r.price }));
    const out = generateInsights(rows);
    const topFinding = out.findings.find((f) => f.includes("Top 3") && f.includes("High"));
    expect(topFinding).toBeDefined();
  });

  it("adds concentration warning when top 3 > 60%", () => {
    const rows = [
      { date: "01-01-2025", product: "A", category: "X", units: 100, price: 100 },
      { date: "02-01-2025", product: "B", category: "X", units: 50, price: 100 },
      { date: "03-01-2025", product: "C", category: "X", units: 25, price: 100 },
      { date: "04-01-2025", product: "D", category: "X", units: 1, price: 10 },
      { date: "05-01-2025", product: "E", category: "X", units: 1, price: 10 },
    ].map((r, i) => ({ ...r, id: i + 1, revenue: r.units * r.price }));
    const out = generateInsights(rows);
    const warn = out.warnings.find((w) => w.includes("60") || w.includes("diversif"));
    expect(warn).toBeDefined();
  });

  it("adds data quality warning for missing dates", () => {
    const rows = [
      { date: "01-01-2025", product: "A", category: "X", units: 1, price: 10 },
      { date: "", product: "B", category: "X", units: 1, price: 10 },
      { date: "03-01-2025", product: "C", category: "X", units: 1, price: 10 },
    ].map((r, i) => ({ ...r, id: i + 1, revenue: (r.units || 0) * (r.price || 0) }));
    const out = generateInsights(rows);
    const missingWarn = out.warnings.find((w) => w.toLowerCase().includes("date") || w.toLowerCase().includes("invalid"));
    expect(missingWarn).toBeDefined();
  });

  it("reports seasonality (best day or month) with enough data", () => {
    const rows = [];
    for (let d = 1; d <= 20; d++) {
      const date = `${String(d).padStart(2, "0")}-01-2025`;
      rows.push({
        id: d,
        date,
        product: "P",
        category: "X",
        units: 5,
        price: 10,
        revenue: 50,
      });
    }
    const out = generateInsights(rows);
    expect(out.findings.length).toBeGreaterThan(0);
    const hasTopOrSeason = out.findings.some(
      (f) => f.includes("Top") || f.includes("day") || f.includes("month") || f.includes("January")
    );
    expect(hasTopOrSeason).toBe(true);
  });
});

describe("getQuantity and getRevenue", () => {
  it("uses units when present", () => {
    expect(getQuantity({ units: 5 })).toBe(5);
    expect(getRevenue({ units: 5, price: 10 })).toBe(50);
  });
  it("uses quantity when units missing", () => {
    expect(getQuantity({ quantity: 3 })).toBe(3);
    expect(getRevenue({ quantity: 3, price: 20 })).toBe(60);
  });
  it("uses row.revenue when present", () => {
    expect(getRevenue({ revenue: 100, units: 1, price: 10 })).toBe(100);
  });
});
