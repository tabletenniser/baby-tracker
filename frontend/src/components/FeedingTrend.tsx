import { useEffect, useState } from "react";
import { getStats } from "../api";
import { addDays, prettyDate, todayStr } from "../dates";
import { useLang } from "../i18n";
import type { StatsData } from "../types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** Feeding trend: today vs yesterday vs 7-day / 14-day averages, with a 14-day bar chart. */
export function FeedingTrend() {
  const { lang, t } = useLang();
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    const end = todayStr();
    const start = addDays(end, -13);
    getStats(start, end).then(setStats).catch(console.error);
  }, []);

  if (!stats) return null;

  const milk = stats.milk;
  const totals = milk.map((m) => m.total);
  const today = totals[totals.length - 1] ?? 0;
  const yesterday = totals[totals.length - 2] ?? 0;
  const avg7 = avg(totals.slice(-7));
  const avg14 = avg(totals);

  const chartData = milk.map((m) => ({
    date: prettyDate(m.date, lang),
    total: Math.round(m.total),
  }));

  return (
    <section className="card">
      <h2 className="card-title">{t("trend.title")}</h2>
      <div className="trend-summary">
        <div className="trend-stat">
          <div className="trend-stat-value">{Math.round(today)} ml</div>
          <div className="trend-stat-label">
            {t("trend.today")} {t("trend.soFar")}
          </div>
        </div>
        <div className="trend-stat">
          <div className="trend-stat-value">{Math.round(yesterday)} ml</div>
          <div className="trend-stat-label">{t("trend.yesterday")}</div>
        </div>
        <div className="trend-stat">
          <div className="trend-stat-value">{Math.round(avg7)} ml</div>
          <div className="trend-stat-label">{t("trend.avg7")}</div>
        </div>
        <div className="trend-stat">
          <div className="trend-stat-value">{Math.round(avg14)} ml</div>
          <div className="trend-stat-label">{t("trend.avg14")}</div>
        </div>
      </div>
      <div className="chart" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any) => [`${v} ml`, ""]} />
            {avg14 > 0 && (
              <ReferenceLine
                y={Math.round(avg14)}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{ value: t("trend.avg14"), position: "insideTopRight", fontSize: 10, fill: "#64748b" }}
              />
            )}
            {avg7 > 0 && (
              <ReferenceLine
                y={Math.round(avg7)}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: t("trend.avg7"), position: "insideBottomRight", fontSize: 10, fill: "#b45309" }}
              />
            )}
            <Bar dataKey="total" fill="#ffd98a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
