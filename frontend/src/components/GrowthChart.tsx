import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GrowthData } from "../types";

export function GrowthChart({ growth }: { growth: GrowthData }) {
  if (!growth.curves || !growth.sex) {
    return (
      <div className="empty">
        Set the baby's sex in the profile (tap the age) to see the WHO growth chart.
      </div>
    );
  }

  const curves = growth.curves;
  const toXY = (arr: number[]) => curves.ageMonths.map((m, i) => ({ x: m, y: arr[i] }));
  const measurements = growth.measurements.map((m) => ({
    x: +(m.ageDays / 30.44).toFixed(2),
    y: m.weightKg,
    label: m.date,
  }));
  const maxAge = Math.max(24, ...measurements.map((m) => m.x + 2));

  return (
    <div>
      {growth.latest && (
        <div className="growth-latest">
          Latest: <b>{growth.latest.weightKg.toFixed(2)} kg</b> · about the{" "}
          <b>{Math.round(growth.latest.percentile)}th percentile</b>
        </div>
      )}
      {measurements.length === 0 && (
        <div className="muted small" style={{ marginBottom: 8 }}>
          No weight points yet — record a breast feeding with a "before" weight to add one.
        </div>
      )}
      <div className="chart">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart margin={{ top: 10, right: 12, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0e2e8" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, maxAge]}
              tickFormatter={(v) => `${v}mo`}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}kg`}
            />
            <Tooltip
              labelFormatter={(x) => `${x} months`}
              formatter={(v: any, name: any) => [
                `${Number(v).toFixed(2)} kg`,
                name,
              ]}
            />
            <Line data={toXY(curves.p3)} dataKey="y" name="3rd" stroke="#e3d5dc" dot={false} strokeWidth={1} isAnimationActive={false} />
            <Line data={toXY(curves.p15)} dataKey="y" name="15th" stroke="#f0c4d8" dot={false} strokeWidth={1} isAnimationActive={false} />
            <Line data={toXY(curves.p50)} dataKey="y" name="50th" stroke="#f0568a" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line data={toXY(curves.p85)} dataKey="y" name="85th" stroke="#f0c4d8" dot={false} strokeWidth={1} isAnimationActive={false} />
            <Line data={toXY(curves.p97)} dataKey="y" name="97th" stroke="#e3d5dc" dot={false} strokeWidth={1} isAnimationActive={false} />
            <Scatter data={measurements} fill="#3a2e39" name="Baby" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="growth-legend">
        <span><i style={{ background: "#f0568a" }} /> 50th</span>
        <span><i style={{ background: "#f0c4d8" }} /> 15th / 85th</span>
        <span><i style={{ background: "#e3d5dc" }} /> 3rd / 97th</span>
        <span><i style={{ background: "#3a2e39" }} /> ● Baby</span>
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>
        WHO weight-for-age reference. Weight = the "before" weight from each breast feeding.
      </div>
    </div>
  );
}
