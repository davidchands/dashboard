/**
 * Sales Insights — rule-based, deterministic insight generation.
 * No LLM. Works with filtered rows (date, product, category, units/quantity, price, revenue).
 * Supports both "units" and "quantity" field names; revenue = (units||quantity) * price if not present.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Minimum rows to show meaningful insights */
const MIN_ROWS_FOR_INSIGHTS = 3;

/** Concentration risk: warn if top 3 products account for more than this share of revenue */
const CONCENTRATION_WARN_PCT = 60;

/** Anomaly: flag if change vs average exceeds this ratio (e.g. 0.5 = 50% change) */
const ANOMALY_CHANGE_THRESHOLD = 0.5;

/** Anomaly: or if value is more than this many standard deviations from mean */
const ANOMALY_STD_THRESHOLD = 2;

// --- Helpers ---

/**
 * Parse date string (DD-MM-YYYY or YYYY-MM-DD) to { year, month (1-12), day, weekStart (ISO), dayOfWeek (0-6) }.
 * Returns null if invalid.
 */
function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const s = dateStr.trim();
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10);
    const year = parseInt(ddmmyyyy[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    if (d.getDate() !== day || d.getMonth() !== month - 1) return null;
    return {
      year,
      month,
      day,
      date: d,
      dayOfWeek: d.getDay(),
      weekKey: getISOWeekKey(d),
    };
  }
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10);
    const month = parseInt(yyyymmdd[2], 10);
    const day = parseInt(yyyymmdd[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    if (d.getDate() !== day || d.getMonth() !== month - 1) return null;
    return {
      year,
      month,
      day,
      date: d,
      dayOfWeek: d.getDay(),
      weekKey: getISOWeekKey(d),
    };
  }
  return null;
}

function getISOWeekKey(d) {
  const d2 = new Date(d);
  d2.setHours(0, 0, 0, 0);
  d2.setDate(d2.getDate() - d2.getDay() + 1); // Monday
  const y = d2.getFullYear();
  const m = String(d2.getMonth() + 1).padStart(2, "0");
  const day = String(d2.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Get quantity from row (supports both "units" and "quantity") */
function getQuantity(row) {
  const q = row.units ?? row.quantity;
  const n = Number(q);
  return Number.isFinite(n) ? n : 0;
}

/** Get revenue from row; compute from quantity * price if not present */
function getRevenue(row) {
  if (Number.isFinite(row.revenue)) return row.revenue;
  const q = getQuantity(row);
  const p = Number(row.price);
  return Number.isFinite(p) ? q * p : 0;
}

/** Normalize category for grouping (trim, title case) */
function normCat(c) {
  const s = String(c ?? "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Aggregate rows by month. Returns Map<monthKey, { revenue, quantity }>.
 * monthKey = "YYYY-MM" for ordering; we still use month-only (1-12) later for seasonality.
 */
function aggregateByMonth(rows) {
  const byMonth = new Map();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const parsed = parseDate(row.date);
    if (!parsed) continue;
    const key = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    const rev = getRevenue(row);
    const qty = getQuantity(row);
    const cur = byMonth.get(key) || { revenue: 0, quantity: 0 };
    cur.revenue += rev;
    cur.quantity += qty;
    byMonth.set(key, cur);
  }
  return byMonth;
}

/**
 * Aggregate rows by week (Monday start). Returns Map<weekKey, { revenue, quantity }>.
 */
function aggregateByWeek(rows) {
  const byWeek = new Map();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const parsed = parseDate(row.date);
    if (!parsed) continue;
    const key = parsed.weekKey;
    const rev = getRevenue(row);
    const qty = getQuantity(row);
    const cur = byWeek.get(key) || { revenue: 0, quantity: 0 };
    cur.revenue += rev;
    cur.quantity += qty;
    byWeek.set(key, cur);
  }
  return byWeek;
}

/** Group by product. Returns array of { product, revenue, quantity, category } */
function groupByProduct(rows) {
  const byProduct = new Map();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row.product ?? "").trim() || "Unknown";
    const rev = getRevenue(row);
    const qty = getQuantity(row);
    const cat = normCat(row.category);
    const cur = byProduct.get(name) || { product: name, revenue: 0, quantity: 0, category: cat };
    cur.revenue += rev;
    cur.quantity += qty;
    byProduct.set(name, cur);
  }
  return Array.from(byProduct.values());
}

/** Group by category. Returns array of { category, revenue, quantity } */
function groupByCategory(rows) {
  const byCat = new Map();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cat = normCat(row.category) || "Uncategorized";
    const rev = getRevenue(row);
    const qty = getQuantity(row);
    const cur = byCat.get(cat) || { category: cat, revenue: 0, quantity: 0 };
    cur.revenue += rev;
    cur.quantity += qty;
    byCat.set(cat, cur);
  }
  return Array.from(byCat.values());
}

/**
 * Compute growth between two values. Returns { pct, direction: 'up'|'down'|'flat', text }.
 */
function computeGrowth(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) {
    return current > 0
      ? { pct: 100, direction: "up", text: "up from no prior sales" }
      : { pct: 0, direction: "flat", text: "no change" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { pct, direction: "up", text: `up ${pct}%` };
  if (pct < 0) return { pct, direction: "down", text: `down ${Math.abs(pct)}%` };
  return { pct: 0, direction: "flat", text: "flat" };
}

/**
 * Detect anomalies: periods with revenue > 50% change vs average or > 2 std dev.
 * Returns array of { period, value, average, type: 'spike'|'drop', message }.
 */
function detectAnomalies(periodValues) {
  const values = periodValues.map((p) => p.value).filter((v) => Number.isFinite(v) && v >= 0);
  if (values.length < 2) return [];
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const variance = values.reduce((acc, v) => acc + (v - avg) ** 2, 0) / values.length;
  const std = Math.sqrt(variance) || 0;
  const results = [];
  for (let i = 0; i < periodValues.length; i++) {
    const { period, value } = periodValues[i];
    if (!Number.isFinite(value)) continue;
    const pctChange = avg !== 0 ? Math.abs((value - avg) / avg) : 0;
    const z = std > 0 ? (value - avg) / std : 0;
    const isSpike = value > avg && (pctChange >= ANOMALY_CHANGE_THRESHOLD || z >= ANOMALY_STD_THRESHOLD);
    const isDrop = value < avg && (pctChange >= ANOMALY_CHANGE_THRESHOLD || z <= -ANOMALY_STD_THRESHOLD);
    if (isSpike) results.push({ period, value, average: avg, type: "spike", message: `Unusual spike in ${period}` });
    if (isDrop) results.push({ period, value, average: avg, type: "drop", message: `Unusual drop in ${period}` });
  }
  return results;
}

/**
 * Round number for display; avoid decimals when not needed.
 */
function roundForDisplay(n) {
  if (!Number.isFinite(n)) return 0;
  if (n >= 1000) return Math.round(n);
  if (n >= 1) return Math.round(n * 100) / 100;
  return Math.round(n * 100) / 100;
}

function formatCurrency(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// --- Main insight generation ---

/**
 * Generate insights from current filtered dataset.
 * @param {Array} rows - Filtered rows (each with date, product, category, units/quantity, price; revenue optional)
 * @param {Object} filters - Optional { dateRange, category, product } for context (not used for computation; insights are from rows only)
 * @returns { { findings: string[], actions: string[], warnings: string[] } }
 */
export function generateInsights(rows, filters = {}) {
  const findings = [];
  const actions = [];
  const warnings = [];

  if (!Array.isArray(rows) || rows.length < MIN_ROWS_FOR_INSIGHTS) {
    return { findings, actions, warnings };
  }

  const totalRevenue = rows.reduce((sum, r) => sum + getRevenue(r), 0);
  const totalQuantity = rows.reduce((sum, r) => sum + getQuantity(r), 0);

  // --- Data quality checks (warnings) ---
  let missingDates = 0;
  let invalidQty = 0;
  let invalidPrice = 0;
  const seenKeys = new Set();
  let duplicateCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.date || !parseDate(r.date)) missingDates++;
    const q = getQuantity(r);
    if (q <= 0 && (r.units !== undefined || r.quantity !== undefined)) invalidQty++;
    const p = Number(r.price);
    if (Number.isFinite(p) && p < 0) invalidPrice++;
    const key = `${r.date}-${r.product}-${r.category}-${q}-${p}`;
    if (seenKeys.has(key)) duplicateCount++;
    seenKeys.add(key);
  }
  if (missingDates > 0) warnings.push(`${missingDates} row(s) have missing or invalid dates. Check your data.`);
  if (invalidQty > 0) warnings.push(`${invalidQty} row(s) have zero or invalid quantity.`);
  if (invalidPrice > 0) warnings.push(`${invalidPrice} row(s) have negative price.`);
  if (duplicateCount > 0) warnings.push(`${duplicateCount} possible duplicate row(s). Review for data entry errors.`);

  // --- Trend: revenue last period vs previous period (monthly or weekly) ---
  const byMonth = aggregateByMonth(rows);
  const monthKeys = Array.from(byMonth.keys()).sort();
  const useWeekly = monthKeys.length < 2;
  let trendFinding = null;
  let trendAction = null;

  if (useWeekly && monthKeys.length === 0) {
    const byWeek = aggregateByWeek(rows);
    const weekKeys = Array.from(byWeek.keys()).sort();
    if (weekKeys.length >= 2) {
      const lastKey = weekKeys[weekKeys.length - 1];
      const prevKey = weekKeys[weekKeys.length - 2];
      const lastRev = byWeek.get(lastKey).revenue;
      const prevRev = byWeek.get(prevKey).revenue;
      const growth = computeGrowth(lastRev, prevRev);
      trendFinding = `Revenue is ${growth.text} this week vs last week ($${formatCurrency(lastRev)} vs $${formatCurrency(prevRev)}).`;
      if (growth.direction === "up") trendAction = "Keep up the momentum; consider restocking best sellers.";
      if (growth.direction === "down") trendAction = "Check if stock ran out or demand dipped; promote top products.";
    }
  } else if (monthKeys.length >= 2) {
    const lastKey = monthKeys[monthKeys.length - 1];
    const prevKey = monthKeys[monthKeys.length - 2];
    const lastRev = byMonth.get(lastKey).revenue;
    const prevRev = byMonth.get(prevKey).revenue;
    const growth = computeGrowth(lastRev, prevRev);
    const [lastY, lastM] = lastKey.split("-");
    const [prevY, prevM] = prevKey.split("-");
    const lastLabel = MONTH_NAMES[parseInt(lastM, 10) - 1];
    const prevLabel = MONTH_NAMES[parseInt(prevM, 10) - 1];
    trendFinding = `Revenue is ${growth.text} in ${lastLabel} vs ${prevLabel} ($${formatCurrency(lastRev)} vs $${formatCurrency(prevRev)}).`;
    if (growth.direction === "up") trendAction = "Keep stock levels healthy for your best sellers.";
    if (growth.direction === "down") trendAction = "Focus on promoting your top 3 products or run a small promotion.";
  }

  if (trendFinding) findings.push(trendFinding);
  if (trendAction) actions.push(trendAction);

  // --- Top products by revenue and by quantity; high volume low revenue ---
  const byProduct = groupByProduct(rows);
  const byRevenue = [...byProduct].sort((a, b) => b.revenue - a.revenue);
  const byQty = [...byProduct].sort((a, b) => b.quantity - a.quantity);

  const top3Revenue = byRevenue.slice(0, 3);
  const top3Qty = byQty.slice(0, 3);
  if (top3Revenue.length) {
    const names = top3Revenue.map((p) => p.product).join(", ");
    findings.push(`Top 3 products by revenue: ${names}.`);
    actions.push(`Restock and promote: ${top3Revenue[0].product}.`);
  }
  if (top3Qty.length && totalRevenue > 0) {
    const names = top3Qty.map((p) => p.product).join(", ");
    findings.push(`Top 3 products by units sold: ${names}.`);
  }

  // High volume, low revenue: high quantity share but low revenue share
  for (let i = 0; i < byProduct.length; i++) {
    const p = byProduct[i];
    const revShare = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
    const qtyShare = totalQuantity > 0 ? (p.quantity / totalQuantity) * 100 : 0;
    if (qtyShare >= 15 && revShare < 5 && p.revenue > 0) {
      findings.push(`${p.product} sells a lot (${Math.round(qtyShare)}% of units) but brings in only ${Math.round(revShare)}% of revenue.`);
      actions.push(`Review price or bundles for ${p.product}, you might be able to earn more per unit.`);
      break;
    }
  }

  // --- Category performance: top, growing, declining ---
  const byCategory = groupByCategory(rows);
  if (byCategory.length > 0) {
    const sortedCat = [...byCategory].sort((a, b) => b.revenue - a.revenue);
    const topCat = sortedCat[0];
    findings.push(`${topCat.category} is your top category ($${formatCurrency(topCat.revenue)} revenue).`);
    actions.push(`Focus on category "${topCat.category}", it drives the most revenue.`);
  }

  // Category growth (compare last month vs previous month per category)
  const catMonthMap = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const parsed = parseDate(r.date);
    if (!parsed) continue;
    const key = `${normCat(r.category)}__${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    const rev = getRevenue(r);
    catMonthMap.set(key, (catMonthMap.get(key) || 0) + rev);
  }
  if (monthKeys.length >= 2) {
    const lastKey = monthKeys[monthKeys.length - 1];
    const prevKey = monthKeys[monthKeys.length - 2];
    let fastestCat = null;
    let fastestGrowth = -Infinity;
    let decliningCat = null;
    let decliningGrowth = Infinity;
    const cats = new Set(byCategory.map((c) => c.category));
    cats.forEach((cat) => {
      const last = catMonthMap.get(`${cat}__${lastKey}`) || 0;
      const prev = catMonthMap.get(`${cat}__${prevKey}`) || 0;
      if (prev > 0) {
        const g = ((last - prev) / prev) * 100;
        if (g > fastestGrowth && last > prev) {
          fastestGrowth = g;
          fastestCat = cat;
        }
        if (g < decliningGrowth && last < prev) {
          decliningGrowth = g;
          decliningCat = cat;
        }
      }
    });
    if (fastestCat) {
      findings.push(`${fastestCat} is your fastest-growing category (up ${Math.round(fastestGrowth)}% vs last period).`);
      actions.push(`Promote ${fastestCat} — it is growing.`);
    }
    if (decliningCat && decliningGrowth < -10) {
      findings.push(`${decliningCat} revenue is down ${Math.round(Math.abs(decliningGrowth))}% vs last period.`);
      actions.push(`Check why ${decliningCat} is declining — restock or run a promo.`);
    }
  }

  // --- Concentration risk ---
  if (totalRevenue > 0 && byRevenue.length > 0) {
    const top1Rev = top3Revenue[0]?.revenue ?? 0;
    const top3Rev = top3Revenue.slice(0, 3).reduce((s, p) => s + p.revenue, 0);
    const pct1 = Math.round((top1Rev / totalRevenue) * 100);
    const pct3 = Math.round((top3Rev / totalRevenue) * 100);
    findings.push(`${pct1}% of revenue comes from your top product; ${pct3}% from the top 3.`);
    if (pct3 >= CONCENTRATION_WARN_PCT) {
      warnings.push(`Over ${pct3}% of revenue depends on 3 products. Consider diversifying to reduce risk.`);
      actions.push("Try to grow sales of other products so one slow month does not hurt too much.");
    }
  }

  // --- Stock / reorder hints: consistent demand (sold in many periods) + recent spike ---
  const productPeriods = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const parsed = parseDate(r.date);
    if (!parsed) continue;
    const periodKey = useWeekly ? parsed.weekKey : `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    const name = String(r.product ?? "").trim() || "Unknown";
    const set = productPeriods.get(name) || new Set();
    set.add(periodKey);
    productPeriods.set(name, set);
  }
  const periodCount = useWeekly ? new Set(rows.map((r) => parseDate(r.date)?.weekKey).filter(Boolean)).size : monthKeys.length;
  if (periodCount >= 2) {
    const consistent = [];
    productPeriods.forEach((set, product) => {
      if (set.size >= Math.min(3, periodCount)) consistent.push(product);
    });
    if (consistent.length > 0) {
      const name = consistent[0];
      findings.push(`${name} sells in many periods — steady demand.`);
      actions.push(`Keep ${name} in stock; reorder before you run out.`);
    }
  }

  // Recent spike: last period much higher than average for a product (mention first only)
  if (monthKeys.length >= 2 || (useWeekly && Array.from(aggregateByWeek(rows).keys()).length >= 2)) {
    const byProdPeriod = new Map();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const parsed = parseDate(r.date);
      if (!parsed) continue;
      const periodKey = useWeekly ? parsed.weekKey : `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
      const name = String(r.product ?? "").trim() || "Unknown";
      const key = `${name}__${periodKey}`;
      byProdPeriod.set(key, (byProdPeriod.get(key) || 0) + getRevenue(r));
    }
    const weekKeys = Array.from(aggregateByWeek(rows).keys()).sort();
    const lastPeriod = monthKeys.length >= 2 ? monthKeys[monthKeys.length - 1] : (weekKeys.length ? weekKeys[weekKeys.length - 1] : null);
    if (lastPeriod) {
      for (let i = 0; i < byProduct.length; i++) {
        const p = byProduct[i];
        const lastRev = byProdPeriod.get(`${p.product}__${lastPeriod}`) || 0;
        const periods = useWeekly ? (productPeriods.get(p.product)?.size ?? 0) : monthKeys.length;
        const avgRev = periods > 0 ? p.revenue / periods : 0;
        if (avgRev > 0 && lastRev >= avgRev * 1.5) {
          findings.push(`${p.product} had a recent spike in sales — might need extra stock.`);
          actions.push(`Restock ${p.product} to avoid running out.`);
          break;
        }
      }
    }
  }

  // --- Seasonality: best day of week or best month ---
  const byDay = new Map();
  const byMonthOnly = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const parsed = parseDate(r.date);
    if (!parsed) continue;
    const rev = getRevenue(r);
    byDay.set(parsed.dayOfWeek, (byDay.get(parsed.dayOfWeek) || 0) + rev);
    byMonthOnly.set(parsed.month, (byMonthOnly.get(parsed.month) || 0) + rev);
  }
  if (byDay.size >= 3) {
    const bestDayEntry = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    if (bestDayEntry) {
      const dayName = DAY_NAMES[bestDayEntry[0]];
      findings.push(`Your best day for sales is ${dayName}.`);
      actions.push(`Schedule promotions or extra stock for ${dayName}s.`);
    }
  }
  if (byMonthOnly.size >= 3) {
    const bestMonthEntry = [...byMonthOnly.entries()].sort((a, b) => b[1] - a[1])[0];
    if (bestMonthEntry) {
      const monthName = MONTH_NAMES[bestMonthEntry[0] - 1];
      findings.push(`Your best month for sales is ${monthName}.`);
    }
  }

  // --- Anomalies ---
  const periodValues = monthKeys.length >= 2
    ? monthKeys.map((k) => {
        const [y, m] = k.split("-");
        return { period: MONTH_NAMES[parseInt(m, 10) - 1], value: byMonth.get(k).revenue };
      })
    : Array.from(aggregateByWeek(rows).entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ period: `Week ${k}`, value: v.revenue }));
  const anomalies = detectAnomalies(periodValues);
  anomalies.forEach((a) => {
    if (a.type === "spike") findings.push(`Unusual revenue spike in ${a.period} ($${formatCurrency(a.value)} vs avg $${formatCurrency(a.average)}). Check for bulk orders or data errors.`);
    if (a.type === "drop") warnings.push(`Revenue dropped in ${a.period}. Confirm if real or a data issue.`);
  });

  // Dedupe and cap lengths
  const uniq = (arr) => [...new Set(arr)];
  return {
    findings: uniq(findings).slice(0, 6),
    actions: uniq(actions).slice(0, 5),
    warnings: uniq(warnings),
  };
}

// Export helpers for tests
export {
  parseDate,
  aggregateByMonth,
  aggregateByWeek,
  groupByProduct,
  groupByCategory,
  computeGrowth,
  detectAnomalies,
  getQuantity,
  getRevenue,
  normCat,
  MIN_ROWS_FOR_INSIGHTS,
  CONCENTRATION_WARN_PCT,
};
