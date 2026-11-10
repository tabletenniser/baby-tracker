import { useEffect, useState } from "react";
import { getUrlParam, setUrlParam } from "../url";
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
import { useLang } from "../i18n";
import type { CountPoint, GrowthData, HourPoint, MilkPoint, StatsData } from "../types";
import { GrowthChart } from "./GrowthChart";

type Range = "7" | "14" | "31" | "custom";

function MilkChart({ data }: { data: MilkPoint[] }) {
  const { lang, t } = useLang();
  return (
    <section className="card">
      <h2 className="card-title">{t("insights.milk")}</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0e2e8" />
            <XAxis dataKey="date" tickFormatter={(d: string) => prettyDate(d, lang)} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => `${Math.round(Number(v))} ml`} />
            <Legend />
            <Bar dataKey="breast" stackId="a" fill="#ff7aa2" name={t("insights.breast")} />
            <Bar dataKey="formula" stackId="a" fill="#6aa9ff" name={t("insights.formula")} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function SleepChart({ data }: { data: HourPoint[] }) {
  const { lang, t } = useLang();
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0e2e8" />
            <XAxis dataKey="date" tickFormatter={(d: string) => prettyDate(d, lang)} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => formatHours(Number(v), lang)} />
            <Area type="monotone" dataKey="hours" stroke="#6aa9ff" fill="url(#sleepGrad)" name={t("insights.sleep")} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function PoopChart({ data }: { data: CountPoint[] }) {
  const { lang, t } = useLang();
  return (
    <section className="card">
      <h2 className="card-title">{t("insights.poop")}</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0e2e8" />
            <XAxis dataKey="date" tickFormatter={(d: string) => prettyDate(d, lang)} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#c9a227" name={t("insights.poop")} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function InsightsView() {
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
  }, [start, end]);

  useEffect(() => {
    getGrowth().then(setGrowth).catch(console.error);
  }, []);

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
          <SleepChart data={stats.sleep} />
          <PoopChart data={stats.poop} />
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
          <GrowthChart growth={growth} />
        ) : (
          <div className="empty">{t("app.loading")}</div>
        )}
      </section>
    </div>
  );
}
