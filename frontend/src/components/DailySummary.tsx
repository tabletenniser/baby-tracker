import type { DailySummary } from "../types";
import { formatHours, formatMl } from "../dates";

export function DailySummaryCard({ daily }: { daily: DailySummary }) {
  return (
    <section className="card summary">
      <h2 className="card-title">Today's totals</h2>
      <div className="summary-grid">
        <div className="stat">
          <div className="stat-value">{formatMl(daily.breastMl)}</div>
          <div className="stat-label">🤱 Breast milk</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatMl(daily.formulaMl)}</div>
          <div className="stat-label">🍼 Formula</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatHours(daily.sleepHours)}</div>
          <div className="stat-label">😴 Sleep</div>
        </div>
        <div className="stat">
          <div className="stat-value">{daily.peeCount}</div>
          <div className="stat-label">💧 Pee</div>
        </div>
        <div className="stat">
          <div className="stat-value">{daily.poopCount}</div>
          <div className="stat-label">💩 Poop</div>
        </div>
        <div className="stat">
          <div className="stat-value">{daily.vitaminD ? "✅" : "—"}</div>
          <div className="stat-label">☀️ Vitamin D</div>
        </div>
      </div>
    </section>
  );
}
