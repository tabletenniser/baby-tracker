import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type {
  DailySummary,
  Elimination,
  Feeding,
  Sleep,
  VitaminDRec,
} from "../types";
import { ageLabel, todayStr } from "../dates";
import { DailySummaryCard } from "./DailySummary";
import { FeedingSection } from "./FeedingSection";
import { SleepSection } from "./SleepSection";
import { EliminationSection } from "./EliminationSection";
import { VitaminToggle } from "./VitaminToggle";

export function Dashboard({ birthday }: { birthday: string }) {
  const [date, setDate] = useState(todayStr());
  const [feedings, setFeedings] = useState<Feeding[]>([]);
  const [sleeps, setSleeps] = useState<Sleep[]>([]);
  const [eliminations, setEliminations] = useState<Elimination[]>([]);
  const [vitamin, setVitamin] = useState<VitaminDRec>({
    date,
    taken: false,
    time: null,
  });
  const [daily, setDaily] = useState<DailySummary | null>(null);

  const refresh = useCallback(async () => {
    const [f, s, e, v, d] = await Promise.all([
      api.getFeedings(date),
      api.getSleeps(date),
      api.getEliminations(date),
      api.getVitamin(date),
      api.getDaily(date),
    ]);
    setFeedings(f);
    setSleeps(s);
    setEliminations(e);
    setVitamin(v);
    setDaily(d);
  }, [date]);

  // On day change: clear immediately (no stale flash) and fetch with a guard
  // so a slow response from a previous day can't overwrite the current one.
  useEffect(() => {
    let cancelled = false;
    setFeedings([]);
    setSleeps([]);
    setEliminations([]);
    setDaily(null);
    (async () => {
      try {
        const [f, s, e, v, d] = await Promise.all([
          api.getFeedings(date),
          api.getSleeps(date),
          api.getEliminations(date),
          api.getVitamin(date),
          api.getDaily(date),
        ]);
        if (!cancelled) {
          setFeedings(f);
          setSleeps(s);
          setEliminations(e);
          setVitamin(v);
          setDaily(d);
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-emoji">🍼</span>
          <div>
            <h1>Baby Tracker</h1>
            <div className="age">{ageLabel(birthday)}</div>
          </div>
        </div>
        <div className="date-nav">
          <button
            className="btn icon"
            onClick={() => setDate(shiftDate(date, -1))}
            aria-label="Previous day"
          >
            ‹
          </button>
          <input
            type="date"
            className="date-input"
            value={date}
            max={todayStr()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button
            className="btn icon"
            onClick={() => setDate(shiftDate(date, 1))}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
      </header>

      <main className="content">
        <div className="day-label">
          {date === todayStr() ? "Today" : new Date(date + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </div>

        {daily && <DailySummaryCard daily={daily} />}

        <FeedingSection
          date={date}
          feedings={feedings}
          onChanged={refresh}
        />
        <SleepSection date={date} sleeps={sleeps} onChanged={refresh} />
        <EliminationSection
          date={date}
          eliminations={eliminations}
          onChanged={refresh}
        />
        <VitaminToggle date={date} vitamin={vitamin} onChanged={refresh} />
      </main>
    </div>
  );
}

function shiftDate(date: string, delta: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
