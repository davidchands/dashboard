"use client";

import { useState, useEffect } from "react";
import { generateInsights } from "@/lib/insights";

const MIN_ROWS = 3;

function SkeletonBullets({ count = 4 }) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-200" />
          <span className="h-4 flex-1 animate-pulse rounded bg-slate-100" style={{ width: `${60 + (i % 3) * 15}%` }} />
        </li>
      ))}
    </ul>
  );
}

function BulletList({ items, className = "" }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-700">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function WarningList({ items, className = "" }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-amber-800">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SalesInsightsCard({ rows = [] }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const result = generateInsights(rows, {});
      setInsights(result);
      setLoading(false);
    }, 0);
    return () => clearTimeout(t);
  }, [rows]);

  const insufficient = !loading && (!rows || rows.length < MIN_ROWS);

  return (
    <section className="mt-6">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sales Insights</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Pattern-based findings and next steps from your current data.
        </p>

        {loading && (
          <div className="mt-4 space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Key findings</h3>
              <div className="mt-2">
                <SkeletonBullets count={4} />
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">What to do next</h3>
              <div className="mt-2">
                <SkeletonBullets count={3} />
              </div>
            </div>
          </div>
        )}

        {!loading && insufficient && (
          <div className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-slate-600">
            <p className="text-sm">Add more sales to unlock insights.</p>
            <p className="mt-1 text-xs">Import a CSV or add products; we need at least {MIN_ROWS} rows to spot patterns.</p>
          </div>
        )}

        {!loading && !insufficient && insights && (
          <div className="mt-4 space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Key findings</h3>
              <div className="mt-2">
                {insights.findings.length > 0 ? (
                  <BulletList items={insights.findings} />
                ) : (
                  <p className="text-sm text-slate-500">No findings yet. Add more data across different dates and products.</p>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">What to do next</h3>
              <div className="mt-2">
                {insights.actions.length > 0 ? (
                  <BulletList items={insights.actions} />
                ) : (
                  <p className="text-sm text-slate-500">No specific actions yet. Keep selling and check back.</p>
                )}
              </div>
            </div>
            {insights.warnings && insights.warnings.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700">Warnings</h3>
                <div className="mt-2">
                  <WarningList items={insights.warnings} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
