import { useEffect, useState } from "react";
import { getBaby } from "./api";
import { addDays, ageLabel, todayStr } from "./dates";
import type { Baby } from "./types";
import { InsightsView } from "./components/InsightsView";
import { ProfileModal } from "./components/ProfileModal";
import { SetupScreen } from "./components/SetupScreen";
import { TimelineView } from "./components/TimelineView";

type Tab = "timeline" | "insights";

export default function App() {
  const [baby, setBaby] = useState<Baby | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [tab, setTab] = useState<Tab>("timeline");
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    getBaby()
      .then((b) => setBaby(b))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading…</div>;
  if (!baby || !baby.birthday) {
    return (
      <SetupScreen
        onDone={() =>
          getBaby()
            .then(setBaby)
            .catch((e) => console.error(e))
        }
      />
    );
  }

  const sexBadge = baby.sex === "female" ? "♀" : baby.sex === "male" ? "♂" : "";

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-emoji">🍼</span>
          <div>
            <h1>Baby Tracker</h1>
            <button className="age-link" onClick={() => setShowProfile(true)}>
              {ageLabel(baby.birthday)}
              {sexBadge ? ` · ${sexBadge}` : ""}
            </button>
          </div>
        </div>
        <div className="date-nav">
          <button
            className="btn icon"
            onClick={() => setDate(addDays(date, -1))}
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
            onClick={() => setDate(addDays(date, 1))}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={tab === "timeline" ? "active" : ""}
          onClick={() => setTab("timeline")}
        >
          📅 Timeline
        </button>
        <button
          className={tab === "insights" ? "active" : ""}
          onClick={() => setTab("insights")}
        >
          📊 Insights
        </button>
      </nav>

      <main className="content">
        {tab === "timeline" ? (
          <TimelineView date={date} />
        ) : (
          <InsightsView />
        )}
      </main>

      {showProfile && (
        <ProfileModal
          baby={baby}
          onClose={() => setShowProfile(false)}
          onSaved={(b) => {
            setBaby(b);
            setShowProfile(false);
          }}
        />
      )}
    </div>
  );
}
