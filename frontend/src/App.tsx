import { useEffect, useState } from "react";
import { getBaby } from "./api";
import { addDays, ageLabel, todayStr } from "./dates";
import { useLang } from "./i18n";
import { getUrlParam, setUrlParam } from "./url";
import type { Baby } from "./types";
import { InsightsView } from "./components/InsightsView";
import { DataModal } from "./components/DataModal";
import { ProfileModal } from "./components/ProfileModal";
import { SetupScreen } from "./components/SetupScreen";
import { TimelineView } from "./components/TimelineView";

type Tab = "timeline" | "insights";

export default function App() {
  const { lang, setLang, t } = useLang();
  const [baby, setBaby] = useState<Baby | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => {
    const d = getUrlParam("date");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayStr();
  });
  const [tab, setTab] = useState<Tab>(() => {
    const t = getUrlParam("tab");
    return t === "insights" ? "insights" : "timeline";
  });
  const [showProfile, setShowProfile] = useState(false);
  const [showData, setShowData] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Keep the current view in the URL so it can be copied/shared.
  useEffect(() => {
    setUrlParam("tab", tab);
  }, [tab]);
  useEffect(() => {
    setUrlParam("date", date);
  }, [date]);

  useEffect(() => {
    getBaby()
      .then((b) => setBaby(b))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">{t("app.loading")}</div>;
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
  const name = baby.name?.trim() || t("app.title");

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-emoji">🍼</span>
          <div>
            <h1>{name}</h1>
            <button className="age-link" onClick={() => setShowProfile(true)}>
              {ageLabel(baby.birthday, lang)}
              {sexBadge ? ` · ${sexBadge}` : ""}
            </button>
          </div>
        </div>
        <div className="date-nav">
          <button
            className="btn icon"
            onClick={() => setDate(addDays(date, -1))}
            aria-label={t("nav.prev")}
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
            aria-label={t("nav.next")}
          >
            ›
          </button>
        </div>
        <button
          className="btn icon data-toggle"
          onClick={() => setShowData(true)}
          aria-label={t("data.title")}
          title={t("data.title")}
        >
          📥
        </button>
        <button
          className="lang-toggle"
          onClick={() => setLang(lang === "en" ? "zh" : "en")}
          aria-label="language"
        >
          {lang === "en" ? "中文" : "EN"}
        </button>
      </header>

      <nav className="tabs">
        <button
          className={tab === "timeline" ? "active" : ""}
          onClick={() => setTab("timeline")}
        >
          {t("tab.timeline")}
        </button>
        <button
          className={tab === "insights" ? "active" : ""}
          onClick={() => setTab("insights")}
        >
          {t("tab.insights")}
        </button>
      </nav>

      <main className="content">
        {tab === "timeline" ? (
          <TimelineView date={date} refreshSignal={refreshSignal} />
        ) : (
          <InsightsView refreshSignal={refreshSignal} />
        )}
      </main>

      {showProfile && (
        <ProfileModal
          baby={baby}
          onClose={() => setShowProfile(false)}
          onSaved={(b) => {
            setBaby(b);
            setShowProfile(false);
            setRefreshSignal((s) => s + 1);
          }}
        />
      )}

      {showData && (
        <DataModal
          onClose={() => setShowData(false)}
          onImported={() => setRefreshSignal((s) => s + 1)}
        />
      )}
    </div>
  );
}
