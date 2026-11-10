import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getGrowth, getStats } from "../api";
import { addDays, formatHours, hourToTime, prettyDate, todayStr } from "../dates";
import type { CountPoint, GrowthData, HourPoint, MilkPoint, StatsData } from "../types";
import { GrowthChart } from "./GrowthChart";

type Range = "7" | "14" | "31" | "custom";

function MilkChart({ data }: { data: MilkPoint[] }) {
  return (
    <section className="card">
      <h2 className="card-title">🥛 Milk per day</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0e2e8" />
            <XAxis dataKey="date" tickFormatter={prettyDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => `${Math.round(Number(v))} ml`} />
            <Legend />
            <Bar dataKey="breast" stackId="a" fill="#ff7aa2" name="Breast" />
            <Bar dataKey="formula" stackId="a" fill="#6aa9ff" name="Formula" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function SleepChart({ data }: { data: HourPoint[] }) {
  return (
    <section className="card">
      <h2 className="card-title">😴 Sleep per day</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6aa9ff" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6aa9ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0e2e8" />
            <XAxis dataKey="date" tickFormatter={prettyDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => formatHours(Number(v))} />
            <Area type="monotone" dataKey="hours" stroke="#6aa9ff" fill="url(#sleepGrad)" name="Sleep" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function PoopChart({ data }: { data: CountPoint[] }) {
  return (
    <section className="card">
      <h2 className="card-title">💩 Poop per day</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0e2e8" />
            <XAxis dataKey="date" tickFormatter={prettyDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#c9a227" name="Poop" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function InsightsView() {
  const today = todayStr();
  const [range, setRange] = useState<Range>("14");
  const [customStart, setCustomStart] = useState(addDays(today, -13));
  const [customEnd, setCustomEnd] = useState(today);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [growth, setGrowth] = useState<GrowthData | null>(null);

  const start = range === "custom" ? customStart : addDays(today, -(parseInt(range, 10) - 1));
  const end = range === "custom" ? customEnd : today;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getStats(start, end);
        if (!cancelled) setStats(s);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [start, end]);

  useEffect(() => {
    getGrowth().then(setGrowth).catch(console.error);
  }, []);

  return (
    <div className="insights">
      <section className="card">
        <h2 className="card-title">Range</h2>
        <div className="range-tabs">
          {(["7", "14", "31", "custom"] as const).map((r) => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>
              {r === "custom" ? "Custom" : `${r} days`}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="row-2">
            <label className="field">
              <span>From</span>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => e.target.value && setCustomStart(e.target.value)}
              />
            </label>
            <label className="field">
              <span>To</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={today}
                onChange={(e) => e.target.value && setCustomEnd(e.target.value)}
              />
            </label>
          </div>
        )}
      </section>

      {stats && (
        <>
          <MilkChart data={stats.milk} />
          <SleepChart data={stats.sleep} />
          <PoopChart data={stats.poop} />
          <section className="card">
            <h2 className="card-title">🌙 Nighttime sleep</h2>
            {stats.bedtime.count > 0 && stats.bedtime.avgStartHour != null ? (
              <div className="bedtime-value">
                Usually falls asleep around <b>{hourToTime(stats.bedtime.avgStartHour)}</b>
                <span className="muted small">
                  {" "}
                  (avg of {stats.bedtime.count} night sleep{stats.bedtime.count > 1 ? "s" : ""})
                </span>
              </div>
            ) : (
              <div className="empty">No nighttime sleep in this range yet.</div>
            )}
          </section>
        </>
      )}

      <section className="card">
        <h2 className="card-title">📈 Growth</h2>
        {growth ? (
          <GrowthChart growth={growth} />
        ) : (
          <div className="empty">Loading…</div>
        )}
      </section>
    </div>
  );
}
