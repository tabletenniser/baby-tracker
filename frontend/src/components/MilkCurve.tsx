import { useEffect, useState } from "react";
import { getMilkCurve } from "../api";
import { useLang } from "../i18n";
import { getUrlParam, setUrlParam } from "../url";
import type { MilkCurveData } from "../types";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Compare = "yesterday" | "3" | "7" | "14";
const COMPARE_OPTIONS: Compare[] = ["yesterday", "3", "7", "14"];

function compareLabelFor(c: Compare, t: (k: string) => string) {
  return c === "yesterday"
    ? t("curve.yesterday")
    : c === "3"
    ? t("curve.avg3")
    : c === "7"
    ? t("curve.avg7")
    : t("curve.avg14");
}

/** Convert hours-since-cutoff to a 12-hour clock label (e.g. 3AM, 9:30PM). */
function clockAt(cutoff: string, t: number): string {
  const [ch, cm] = cutoff.split(":").map(Number);
  const totalMin = ch * 60 + cm + Math.round(t * 60);
  const hour24 = Math.floor(totalMin / 60) % 24;
  const min = totalMin % 60;
  const ampm = hour24 >= 12 ? "PM" : "AM";
  let h = hour24 % 12;
  if (h === 0) h = 12;
  return min === 0 ? `${h}${ampm}` : `${h}:${String(min).padStart(2, "0")}${ampm}`;
}

/** Draw a supplement/poop icon at the event's point on the curve. */
function eventDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const icon = payload?.type === "poop" ? "💩" : "💊";
  return (
    <text x={cx} y={cy - 7} textAnchor="middle" fontSize={13}>
      {icon}
    </text>
  );
}

/**
 * Cumulative milk over the day. X-axis runs from the day's cutoff to the next
 * cutoff (24h); Y-axis is the running total of milk. Dots mark supplements and
 * poops. Toggle compares today against yesterday or a 3/7/14-day average.
 */
export function MilkCurve({ date }: { date: string }) {
  const { t } = useLang();
  const [compare, setCompare] = useState<Compare>(() => {
    const c = getUrlParam("compare");
    return c === "yesterday" || c === "3" || c === "7" || c === "14" ? c : "yesterday";
  });
  const [data, setData] = useState<MilkCurveData | null>(null);

  useEffect(() => {
    setUrlParam("compare", compare);
  }, [compare]);

  useEffect(() => {
    let cancelled = false;
    getMilkCurve(date, compare)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [date, compare]);

  if (!data) return null;

  const { cutoff, today, compare: cmp, events } = data;
  const hasCompare = !!cmp && cmp.length > 0;
  const compareLabel = compareLabelFor(compare, t);

  const rows = today.map((p, i) => ({
    t: p.t,
    today: p.ml,
    compare: hasCompare ? (cmp as { ml: number }[])[i].ml : null,
  }));

  const ticks = [0, 6, 12, 18, 24];

  // Vertical marker for the current time (only meaningful when viewing today).
  const nowOffset = (Date.now() - new Date(`${date}T${cutoff}:00`).getTime()) / 3600000;
  const showNowLine = nowOffset >= 0 && nowOffset <= 24;

  return (
    <section className="card">
      <h2 className="card-title">{t("curve.title")}</h2>
      <div className="segmented cols-4">
        {COMPARE_OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            className={compare === c ? "active" : ""}
            onClick={() => setCompare(c)}
          >
            {compareLabelFor(c, t)}
          </button>
        ))}
      </div>
      <div className="chart" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 14, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, 24]}
              ticks={ticks}
              tickFormatter={(v) => clockAt(cutoff, Number(v))}
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const todayItem = payload.find((p) => p.dataKey === "today");
                const compareItem = payload.find((p) => p.dataKey === "compare");
                return (
                  <div className="milk-tooltip">
                    <div className="milk-tooltip-label">{clockAt(cutoff, Number(label))}</div>
                    {todayItem && (
                      <div className="milk-tooltip-row">
                        <span className="milk-dot" style={{ background: "#3d8c02" }} />
                        {t("curve.today")}: {todayItem.value} ml
                      </div>
                    )}
                    {compareItem && compareItem.value != null && (
                      <div className="milk-tooltip-row">
                        <span className="milk-dot" style={{ background: "#94a3b8" }} />
                        {compareLabel}: {compareItem.value} ml
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="today"
              stroke="#3d8c02"
              strokeWidth={2.5}
              dot={false}
            />
            {hasCompare && (
              <Line
                type="monotone"
                dataKey="compare"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
              />
            )}
            {showNowLine && (
              <ReferenceLine
                x={nowOffset}
                stroke="#c53030"
                strokeWidth={2}
                strokeDasharray="4 3"
                label={{ value: t("curve.now"), position: "top", fill: "#c53030", fontSize: 12 }}
              />
            )}
            <Scatter data={events} dataKey="ml" shape={eventDot} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="curve-legend">
        <span className="legend-item">
          <span className="legend-line" style={{ background: "#3d8c02" }} />
          {t("curve.today")}
        </span>
        {hasCompare ? (
          <span className="legend-item">
            <span className="legend-line dashed" style={{ background: "#94a3b8" }} />
            {compareLabel}
          </span>
        ) : (
          <span className="legend-item muted">{t("curve.noCompare")}</span>
        )}
        <span className="legend-item">💊 {t("curve.supplement")}</span>
        <span className="legend-item">💩 {t("curve.poop")}</span>
      </div>
    </section>
  );
}
