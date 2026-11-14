import type { DailySummary } from "../types";
import { formatHours, formatMl } from "../dates";
import { useLang } from "../i18n";

export function DailySummaryCard({ daily }: { daily: DailySummary }) {
  const { lang, t } = useLang();
  const supps = daily.supplements.length ? daily.supplements.join(", ") : "—";
  return (
    <section className="card summary">
      <h2 className="card-title">{t("summary.title")}</h2>
      <div className="summary-grid">
        <div className="stat stat-total">
          <div className="stat-value">{formatMl(daily.totalMl, lang)}</div>
          <div className="stat-label">{t("summary.totalMilk")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatMl(daily.breastMl, lang)}</div>
          <div className="stat-label">{t("summary.breast")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatMl(daily.formulaMl, lang)}</div>
          <div className="stat-label">{t("summary.formula")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatHours(daily.sleepHours, lang)}</div>
          <div className="stat-label">{t("summary.sleep")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{daily.peeCount}</div>
          <div className="stat-label">{t("summary.pee")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{daily.poopCount}</div>
          <div className="stat-label">{t("summary.poop")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{daily.showerCount}</div>
          <div className="stat-label">{t("summary.shower")}</div>
        </div>
        <div className="stat">
          <div className="stat-value stat-supps">{supps}</div>
          <div className="stat-label">{t("summary.supplements")}</div>
        </div>
      </div>
    </section>
  );
}
