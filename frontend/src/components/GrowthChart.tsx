import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  XAxis,
  YAxis,
} from "recharts";
import { useRef, useState } from "react";
import { useLang } from "../i18n";
import type { GrowthData } from "../types";

interface Hovered {
  label: string;
  weightG: number;
  percentile: number;
  left: number;
  top: number;
  transform: string;
}

export function GrowthChart({ growth, start, end }: { growth: GrowthData; start: string; end: string }) {
  const { t } = useLang();
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  if (!growth.curves || !growth.sex) {
    return <div className="empty">{t("growth.setSex")}</div>;
  }

  const curves = growth.curves;
  const all = growth.measurements.map((m) => ({
    x: +(m.ageDays / 30.44).toFixed(2),
    y: m.weightKg,
    label: m.date,
    weightG: Math.round(m.weightKg * 1000),
    percentile: m.percentile,
  }));
  const measurements = all.filter((m) => m.label >= start && m.label <= end);
  const ages = measurements.map((m) => m.x);
  // Adapt the x-axis to the visible points so early measurements aren't bunched at the edge.
  const minAge = ages.length > 0 ? Math.max(0, Math.min(...ages) - 1) : 0;
  const maxAge = ages.length > 0 ? Math.max(minAge + 3, Math.max(...ages) + 1) : 12;
  // Clip the WHO curves to the visible range so they don't stretch the axis to 0-24mo.
  const toXY = (arr: number[]) =>
    curves.ageMonths.map((m, i) => ({ x: m, y: arr[i] })).filter((p) => p.x >= minAge && p.x <= maxAge);

  // Custom hover tooltip: the default Recharts Tooltip is unreliable for a
  // numeric-axis Scatter, and per-point mouseleave is flaky, so the chart
  // container tracks the cursor and finds the nearest measurement point.
  const findPointAt = (clientX: number, clientY: number): Hovered | null => {
    const chart = chartRef.current;
    if (!chart) return null;
    const chartRect = chart.getBoundingClientRect();
    const svg = chart.querySelector("svg");
    if (!svg) return null;
    const svgRect = svg.getBoundingClientRect();
    const sx = svgRect.width / (svg.clientWidth || svgRect.width);
    const sy = svgRect.height / (svg.clientHeight || svgRect.height);
    const dots = Array.from(svg.querySelectorAll("circle")).filter((c) => c.getAttribute("r") === "5");
    // Pick the nearest point within the threshold (points can overlap).
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const px = svgRect.left + parseFloat(d.getAttribute("cx") || "0") * sx;
      const py = svgRect.top + parseFloat(d.getAttribute("cy") || "0") * sy;
      const dx = clientX - px;
      const dy = clientY - py;
      const dist = dx * dx + dy * dy;
      if (dist <= 144 && dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    }
    if (best < 0) return null;
    const m = measurements[best];
    if (!m) return null;
    const d = dots[best];
    const px = svgRect.left + parseFloat(d.getAttribute("cx") || "0") * sx;
    const py = svgRect.top + parseFloat(d.getAttribute("cy") || "0") * sy;
    const left = px - chartRect.left;
    let transform = "translate(-50%, -100%)";
    if (left < 150) transform = "translate(12px, -100%)";
    else if (left > chartRect.width - 150) transform = "translate(calc(-100% - 12px), -100%)";
    return { label: m.label, weightG: m.weightG, percentile: m.percentile, left, top: py - chartRect.top - 12, transform };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const p = findPointAt(e.clientX, e.clientY);
    setHovered((prev) => (p && prev && prev.label === p.label ? prev : p));
  };
  const handleMouseLeave = () => setHovered(null);

  const renderDot = (props: any) => {
    const { cx, cy } = props;
    return <circle cx={cx} cy={cy} r={5} fill="#3d3420" stroke="#fff" strokeWidth={1.5} />;
  };

  return (
    <div>
      {growth.latest && (
        <div className="growth-latest">
          {t("insights.latest")} <b>{growth.latest.weightKg.toFixed(2)} kg</b> ·{" "}
          {t("insights.percentile", { n: Math.round(growth.latest.percentile) })}
        </div>
      )}
      {measurements.length === 0 && (
        <div className="muted small" style={{ marginBottom: 8 }}>
          {growth.measurements.length === 0 ? t("growth.noPoints") : t("growth.noPointsInRange")}
        </div>
      )}
      <div
        className="chart"
        ref={chartRef}
        style={{ position: "relative" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={measurements} margin={{ top: 10, right: 12, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3e6c8" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[minAge, maxAge]}
              tickFormatter={(v) => `${v}mo`}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}kg`}
            />
            <Line data={toXY(curves.p3)} dataKey="y" name="3rd" stroke="#f0e4c4" dot={false} strokeWidth={1} isAnimationActive={false} />
            <Line data={toXY(curves.p15)} dataKey="y" name="15th" stroke="#ffd27a" dot={false} strokeWidth={1} isAnimationActive={false} />
            <Line data={toXY(curves.p50)} dataKey="y" name="50th" stroke="#d98e04" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line data={toXY(curves.p85)} dataKey="y" name="85th" stroke="#ffd27a" dot={false} strokeWidth={1} isAnimationActive={false} />
            <Line data={toXY(curves.p97)} dataKey="y" name="97th" stroke="#f0e4c4" dot={false} strokeWidth={1} isAnimationActive={false} />
            <Scatter data={measurements} dataKey="y" shape={renderDot} fill="#3d3420" name={t("growth.baby")} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        {hovered && (
          <div
            className="growth-tooltip"
            style={{ left: hovered.left, top: hovered.top, transform: hovered.transform }}
          >
            <div className="growth-tooltip-date">{hovered.label}</div>
            <div className="growth-tooltip-row">
              <span>{t("growth.weight")}</span>
              <b>{hovered.weightG} g</b>
            </div>
            <div className="growth-tooltip-row">
              <span>{t("growth.percentile")}</span>
              <b>{t("insights.percentile", { n: Math.round(hovered.percentile) })}</b>
            </div>
          </div>
        )}
      </div>
      <div className="growth-legend">
        <span><i style={{ background: "#d98e04" }} /> {t("growth.p50")}</span>
        <span><i style={{ background: "#ffd27a" }} /> {t("growth.p1585")}</span>
        <span><i style={{ background: "#f0e4c4" }} /> {t("growth.p397")}</span>
        <span><i style={{ background: "#3d3420" }} /> ● {t("growth.baby")}</span>
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>
        {t("growth.note")}
      </div>
    </div>
  );
}
