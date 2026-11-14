import { useEffect, useState } from "react";
import { getUrlParam, setUrlParam } from "../url";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getGrowth, getStats } from "../api";
import { addDays, formatHours, hourToTime, prettyDate, todayStr } from "../dates";
import { useLang } from "../i18n";
import type { CountPoint, GrowthData, HourPoint, MilkPoint, StatsData } from "../types";
import { GrowthChart } from "./GrowthChart";

type Range = "7" | "14" | "31" | "custom";

// Shared clickable-legend state: clicking a legend item hides/shows that series.
function useToggleSeries() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  function onLegendClick(e: any) {
    const key = e?.dataKey ?? e?.value;
    if (key == null) return;
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function formatter(value: any, entry: any) {
    const key = entry?.dataKey ?? value;
    const isHidden = hidden.has(key);
    return (
      <span
        style={{
          color: isHidden ? "#c9c2b0" : "#3d3420",
          textDecoration: isHidden ? "line-through" : "none",
          cursor: "pointer",
        }}
      >
        {value}
      </span>
    );
  }
  return { hidden, onLegendClick, formatter };
}

function MilkChart({ data }: { data: MilkPoint[] }) {
  const { lang, t } = useLang();
  const { hidden, onLegendClick, formatter } = useToggleSeries();
  const rows = data.map((d) => ({
    ...d,
    breastPct: d.total > 0 ? Math.round((d.breast / d.total) * 100) : null,
  }));
  return (
    <section className="card">
      <h2 className="card-title">{t("insights.milk")}</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={rows} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3e6c8" />
            <XAxis dataKey="date" tickFormatter={(d: string) => prettyDate(d, lang)} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis yAxisId="ml" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} width={38} />
            <Tooltip
              formatter={(v: any, name: any) =>
                name === t("insights.breastPct") ? `${v}%` : `${Math.round(Number(v))} ml`
              }
            />
            <Legend onClick={onLegendClick} formatter={formatter} />
            <Bar yAxisId="ml" dataKey="breast" stackId="a" fill="#f5a623" name={t("insights.breast")} hide={hidden.has("breast")} />
            <Bar yAxisId="ml" dataKey="formula" stackId="a" fill="#6aa9ff" name={t("insights.formula")} hide={hidden.has("formula")} />
            <Line yAxisId="pct" type="monotone" dataKey="breastPct" stroke="#c98a00" strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} name={t("insights.breastPct")} hide={hidden.has("breastPct")} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function BreastBalanceChart({ data }: { data: MilkPoint[] }) {
  const { lang, t } = useLang();
  const { hidden, onLegendClick, formatter } = useToggleSeries();
  const leftTotal = data.reduce((s, d) => s + (d.left || 0), 0);
  const rightTotal = data.reduce((s, d) => s + (d.right || 0), 0);
  const grand = leftTotal + rightTotal;
  const leftPct = grand > 0 ? Math.round((leftTotal / grand) * 100) : 0;
  return (
    <section className="card">
      <h2 className="card-title">{t("insights.balance")}</h2>
      {grand > 0 ? (
        <div className="balance-summary">
          <span className="balance-chip left">
            {t("insights.left")}: <b>{Math.round(leftTotal)} ml</b> ({leftPct}%)
          </span>
          <span className="balance-chip right">
            {t("insights.right")}: <b>{Math.round(rightTotal)} ml</b> ({100 - leftPct}%)
          </span>
        </div>
      ) : (
        <div className="empty">{t("insights.noBreast")}</div>
      )}
      <div className="chart">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3e6c8" />
            <XAxis dataKey="date" tickFormatter={(d: string) => prettyDate(d, lang)} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => `${Math.round(Number(v))} ml`} />
            <Legend onClick={onLegendClick} formatter={formatter} />
            <Bar dataKey="left" stackId="a" fill="#f5a623" name={t("insights.left")} hide={hidden.has("left")} />
            <Bar dataKey="right" stackId="a" fill="#ffd98a" name={t("insights.right")} hide={hidden.has("right")} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function SleepChart({ data }: { data: HourPoint[] }) {
  const { lang, t } = useLang();
  const { hidden, onLegendClick, formatter } = useToggleSeries();
  return (
    <section className="card">
      <h2 className="card-title">{t("insights.sleep")}</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6aa9ff" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6aa9ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3e6c8" />
            <XAxis dataKey="date" tickFormatter={(d: string) => prettyDate(d, lang)} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => formatHours(Number(v), lang)} />
            <Legend onClick={onLegendClick} formatter={formatter} />
            <Area type="monotone" dataKey="hours" stroke="#6aa9ff" fill="url(#sleepGrad)" name={t("insights.sleep")} hide={hidden.has("hours")} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function EliminationChart({ pee, poop }: { pee: CountPoint[]; poop: CountPoint[] }) {
  const { lang, t } = useLang();
  const { hidden, onLegendClick, formatter } = useToggleSeries();
  const rows = poop.map((p, i) => ({
    date: p.date,
    poop: p.count,
    pee: pee[i]?.count ?? 0,
  }));
  return (
    <section className="card">
      <h2 className="card-title">{t("insights.elim")}</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={rows} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3e6c8" />
            <XAxis dataKey="date" tickFormatter={(d: string) => prettyDate(d, lang)} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend onClick={onLegendClick} formatter={formatter} />
            <Bar dataKey="pee" fill="#6aa9ff" name={t("insights.pee")} hide={hidden.has("pee")} radius={[4, 4, 0, 0]} />
            <Bar dataKey="poop" fill="#c9a227" name={t("insights.poop")} hide={hidden.has("poop")} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function InsightsView({ refreshSignal }: { refreshSignal?: number }) {
  const { t } = useLang();
  const today = todayStr();
  const [range, setRange] = useState<Range>(() => {
    const r = getUrlParam("range");
    return r === "7" || r === "14" || r === "31" || r === "custom" ? r : "14";
  });
  const [customStart, setCustomStart] = useState(addDays(today, -13));
  const [customEnd, setCustomEnd] = useState(today);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [growth, setGrowth] = useState<GrowthData | null>(null);

  useEffect(() => {
    setUrlParam("range", range);
  }, [range]);

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
  }, [start, end, refreshSignal]);

  useEffect(() => {
    getGrowth().then(setGrowth).catch(console.error);
  }, [refreshSignal]);

  const rangeLabel: Record<Range, string> = {
    "7": t("insights.d7"),
    "14": t("insights.d14"),
    "31": t("insights.d31"),
    custom: t("insights.custom"),
  };

  return (
    <div className="insights">
      <section className="card">
        <h2 className="card-title">{t("insights.range")}</h2>
        <div className="range-tabs">
          {(["7", "14", "31", "custom"] as const).map((r) => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>
              {rangeLabel[r]}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="row-2">
            <label className="field">
              <span>{t("insights.from")}</span>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => e.target.value && setCustomStart(e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t("insights.to")}</span>
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
          <BreastBalanceChart data={stats.milk} />
          <SleepChart data={stats.sleep} />
          <EliminationChart pee={stats.pee} poop={stats.poop} />
          <section className="card">
            <h2 className="card-title">{t("insights.bedtime")}</h2>
            {stats.bedtime.count > 0 && stats.bedtime.avgStartHour != null ? (
              <div className="bedtime-value">
                {t("insights.bedtimeText", { t: hourToTime(stats.bedtime.avgStartHour) })}
                <span className="muted small">
                  {" "}
                  {t("insights.bedtimeCount", { n: stats.bedtime.count })}
                </span>
              </div>
            ) : (
              <div className="empty">{t("insights.noBedtime")}</div>
            )}
          </section>
        </>
      )}

      <section className="card">
        <h2 className="card-title">{t("insights.growth")}</h2>
        {growth ? (
          <GrowthChart growth={growth} start={start} end={end} />
        ) : (
          <div className="empty">{t("app.loading")}</div>
        )}
      </section>
    </div>
  );
}
