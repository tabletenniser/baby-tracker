import { useCallback, useEffect, useState } from "react";
import {
  deleteElimination,
  deleteFeeding,
  deleteShower,
  deleteSleep,
  deleteSupplement,
  getTimeline,
} from "../api";
import { formatHours, formatMins, formatMl, shortDate, timeOf, todayStr } from "../dates";
import { supplementLabel, useLang } from "../i18n";
import type {
  Elimination,
  ElimType,
  Feeding,
  FeedingType,
  Shower,
  Sleep,
  Supplement,
  TimelineData,
} from "../types";
import { DailySummaryCard } from "./DailySummary";
import { DayCutoffControl } from "./DayCutoffControl";
import { EliminationForm } from "./EliminationForm";
import { FeedingForm } from "./FeedingForm";
import { FeedingTrend } from "./FeedingTrend";
import { LogForm } from "./LogForm";
import { MilkCurve } from "./MilkCurve";
import { Modal } from "./Modal";
import { SleepForm } from "./SleepForm";
import { ShowerForm } from "./ShowerForm";
import { SupplementForm } from "./SupplementForm";

type Kind = "feeding" | "sleep" | "elimination" | "supplement" | "shower";
type ModalKind = Kind | "log" | null;
type Cat = "breast" | "bottle" | "sleep" | "pee" | "poop" | "shower" | "supplement";
type T = (key: string, vars?: Record<string, string | number>) => string;

const FILTER_CATS: { cat: Cat; emoji: string; labelKey: string }[] = [
  { cat: "breast", emoji: "🤱", labelKey: "add.breast" },
  { cat: "bottle", emoji: "🍼", labelKey: "add.bottle" },
  { cat: "sleep", emoji: "😴", labelKey: "add.sleep" },
  { cat: "pee", emoji: "💧", labelKey: "add.pee" },
  { cat: "poop", emoji: "💩", labelKey: "add.poop" },
  { cat: "shower", emoji: "🚿", labelKey: "add.shower" },
  { cat: "supplement", emoji: "💊", labelKey: "add.supplement" },
];

interface Item {
  key: string;
  sortTime: string;
  displayTime: string;
  icon: string;
  title: string;
  detail?: string;
  overnight?: boolean;
  kind: Kind;
  cat: Cat;
  id: string;
}

function buildItems(data: TimelineData, t: T, lang: "en" | "zh"): Item[] {
  const items: Item[] = [];
  for (const f of data.feedings) {
    const detail =
      f.type === "breast"
        ? f.breastMl > 0
          ? `${t("item.total")} ${formatMl(f.breastMl, lang)}${
              f.leftMl > 0 ? ` · ${t("item.left")} ${formatMl(f.leftMl, lang)}${f.leftMinutes ? ` (${formatMins(f.leftMinutes, lang)})` : ""}` : ""
            }${f.rightMl > 0 ? ` · ${t("item.right")} ${formatMl(f.rightMl, lang)}${f.rightMinutes ? ` (${formatMins(f.rightMinutes, lang)})` : ""}` : ""}`
          : t("item.beforeOnly")
        : `${t("item.formula")} ${formatMl(f.formulaMl, lang)}${
            f.breastMl > 0 ? ` · ${t("item.breastMl")} ${formatMl(f.breastMl, lang)}` : ""
          }`;
    items.push({
      key: `f-${f.id}`,
      sortTime: f.datetime,
      displayTime: timeOf(f.datetime),
      icon: f.type === "breast" ? "🤱" : "🍼",
      title: f.type === "breast" ? t("item.breast") : t("item.bottle"),
      detail,
      kind: "feeding",
      cat: f.type === "breast" ? "breast" : "bottle",
      id: f.id,
    });
  }
  for (const s of data.sleeps) {
    const overnight = !!s.overnight;
    items.push({
      key: `s-${s.id}`,
      sortTime: overnight ? s.end : s.start,
      displayTime: timeOf(overnight ? s.end : s.start),
      icon: "😴",
      title: overnight ? t("item.sleptUntil") : t("item.sleep"),
      detail: overnight
        ? `${formatHours(s.dayHours ?? s.hours, lang)} · ${t("item.fromPrevNight", {
            t: timeOf(s.start),
          })}`
        : `${formatHours(s.hours, lang)} · ${timeOf(s.start)} → ${timeOf(s.end)}`,
      overnight,
      kind: "sleep",
      cat: "sleep",
      id: s.id,
    });
  }
  for (const e of data.eliminations) {
    let detail: string | undefined;
    if (e.type === "poop") {
      const parts: string[] = [];
      if (e.size) parts.push(`${t("item.size")} ${e.size}`);
      if (e.watery != null) {
        const wateryLabel =
          e.watery === 1 ? t("elim.formed") : e.watery === 3 ? t("elim.wateryLevel") : t("elim.middle");
        parts.push(`${t("item.watery")}: ${wateryLabel}`);
      }
      detail = parts.join(" · ") || undefined;
    }
    items.push({
      key: `e-${e.id}`,
      sortTime: e.datetime,
      displayTime: timeOf(e.datetime),
      icon: e.type === "pee" ? "💧" : "💩",
      title: e.type === "pee" ? t("item.pee") : t("item.poop"),
      detail,
      kind: "elimination",
      cat: e.type === "pee" ? "pee" : "poop",
      id: e.id,
    });
  }
  for (const s of data.supplements) {
    items.push({
      key: `supp-${s.id}`,
      sortTime: s.datetime,
      displayTime: timeOf(s.datetime),
      icon: "💊",
      title: supplementLabel(s.name, t),
      kind: "supplement",
      cat: "supplement",
      id: s.id,
    });
  }
  for (const s of data.showers) {
    items.push({
      key: `shower-${s.id}`,
      sortTime: s.datetime,
      displayTime: timeOf(s.datetime),
      icon: "🚿",
      title: t("item.shower"),
      kind: "shower",
      cat: "shower",
      id: s.id,
    });
  }
  items.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
  return items;
}

interface Props {
  date: string;
  refreshSignal?: number;
}

export function TimelineView({ date, refreshSignal }: Props) {
  const { lang, t } = useLang();
  const [data, setData] = useState<TimelineData | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [editFeeding, setEditFeeding] = useState<Feeding | null>(null);
  const [editSleep, setEditSleep] = useState<Sleep | null>(null);
  const [editElim, setEditElim] = useState<Elimination | null>(null);
  const [editSupp, setEditSupp] = useState<Supplement | null>(null);
  const [editShower, setEditShower] = useState<Shower | null>(null);
  const [addType, setAddType] = useState<FeedingType | ElimType | null>(null);
  const [hiddenCats, setHiddenCats] = useState<Set<Cat>>(new Set());

  function toggleCat(cat: Cat) {
    setHiddenCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const refresh = useCallback(async () => {
    try {
      setData(await getTimeline(date));
    } catch (e) {
      console.error(e);
    }
  }, [date]);

  // On day change: clear immediately (no stale flash), close modals, refetch with a guard.
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setModal(null);
    setEditFeeding(null);
    setEditSleep(null);
    setEditElim(null);
    setEditSupp(null);
    setEditShower(null);
    setAddType(null);
    (async () => {
      try {
        const d = await getTimeline(date);
        if (!cancelled) setData(d);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, refreshSignal]);

  function openAdd(kind: Kind | "log", addType?: FeedingType | ElimType) {
    setEditFeeding(null);
    setEditSleep(null);
    setEditElim(null);
    setEditSupp(null);
    setEditShower(null);
    setAddType(addType ?? null);
    setModal(kind);
  }

  function openEdit(item: Item) {
    if (!data) return;
    if (item.kind === "feeding") setEditFeeding(data.feedings.find((f) => f.id === item.id) ?? null);
    else if (item.kind === "sleep") setEditSleep(data.sleeps.find((s) => s.id === item.id) ?? null);
    else if (item.kind === "elimination")
      setEditElim(data.eliminations.find((e) => e.id === item.id) ?? null);
    else if (item.kind === "shower")
      setEditShower(data.showers.find((s) => s.id === item.id) ?? null);
    else setEditSupp(data.supplements.find((s) => s.id === item.id) ?? null);
    setModal(item.kind);
  }

  function closeModal() {
    setModal(null);
    setEditFeeding(null);
    setEditSleep(null);
    setEditElim(null);
    setEditSupp(null);
    setEditShower(null);
    setAddType(null);
  }

  async function handleDelete(item: Item) {
    if (!confirm(t("common.confirmDelete"))) return;
    try {
      if (item.kind === "feeding") await deleteFeeding(item.id);
      else if (item.kind === "sleep") await deleteSleep(item.id);
      else if (item.kind === "elimination") await deleteElimination(item.id);
      else if (item.kind === "shower") await deleteShower(item.id);
      else await deleteSupplement(item.id);
      await refresh();
    } catch (e) {
      alert(String(e));
    }
  }

  const items = data ? buildItems(data, t, lang) : [];
  const visibleItems = items.filter((it) => !hiddenCats.has(it.cat));

  return (
    <>
      {data && <DailySummaryCard daily={data.daily} />}

      <div className="add-bar">
        <button className="btn add-btn" onClick={() => openAdd("feeding", "breast")}>
          <span className="add-emoji">🤱</span>
          <span className="add-label">{t("add.breast")}</span>
        </button>
        <button className="btn add-btn" onClick={() => openAdd("feeding", "bottle")}>
          <span className="add-emoji">🍼</span>
          <span className="add-label">{t("add.bottle")}</span>
        </button>
        <button className="btn add-btn" onClick={() => openAdd("sleep")}>
          <span className="add-emoji">😴</span>
          <span className="add-label">{t("add.sleep")}</span>
        </button>
        <button className="btn add-btn" onClick={() => openAdd("elimination", "pee")}>
          <span className="add-emoji">💧</span>
          <span className="add-label">{t("add.pee")}</span>
        </button>
        <button className="btn add-btn" onClick={() => openAdd("elimination", "poop")}>
          <span className="add-emoji">💩</span>
          <span className="add-label">{t("add.poop")}</span>
        </button>
        <button className="btn add-btn" onClick={() => openAdd("shower")}>
          <span className="add-emoji">🚿</span>
          <span className="add-label">{t("add.shower")}</span>
        </button>
        <button className="btn add-btn" onClick={() => openAdd("supplement")}>
          <span className="add-emoji">💊</span>
          <span className="add-label">{t("add.supplement")}</span>
        </button>
      </div>

      <button className="btn log-btn" onClick={() => openAdd("log")}>
        ⏱️ {t("add.log")}
      </button>

      <div className="filter-bar">
        <span className="filter-label">{t("filter.title")}</span>
        {FILTER_CATS.map(({ cat, emoji, labelKey }) => {
          const hidden = hiddenCats.has(cat);
          return (
            <button
              key={cat}
              className={`filter-chip${hidden ? "" : " active"}`}
              onClick={() => toggleCat(cat)}
              aria-pressed={!hidden}
            >
              <span className="filter-emoji">{emoji}</span>
              <span>{t(labelKey)}</span>
            </button>
          );
        })}
      </div>

      <section className="card">
        <div className="timeline-head">
          <h2 className="card-title">
            {date === todayStr() ? t("timeline.today") : shortDate(date, lang)}
          </h2>
          {data && (
            <DayCutoffControl date={date} currentCutoff={data.cutoff} onChanged={refresh} />
          )}
        </div>
        <div className="timeline">
          {visibleItems.length === 0 && (
            <div className="empty">
              {hiddenCats.size > 0 ? t("filter.noneShown") : t("item.noActivity")}
            </div>
          )}
          {visibleItems.map((it) => (
            <div className={`timeline-item ${it.overnight ? "overnight" : ""}`} key={it.key}>
              <div className="timeline-time">{it.displayTime}</div>
              <div className="timeline-icon">{it.icon}</div>
              <div className="timeline-main">
                <div className="timeline-title">{it.title}</div>
                {it.detail && <div className="timeline-detail">{it.detail}</div>}
              </div>
              <div className="list-actions">
                <button className="btn ghost sm" onClick={() => openEdit(it)}>
                  {t("item.edit")}
                </button>
                <button className="btn ghost sm danger" onClick={() => handleDelete(it)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <MilkCurve date={date} />

      <FeedingTrend />

      {modal === "feeding" && (
        <Modal title={editFeeding ? t("feeding.edit") : t("feeding.add")} onClose={closeModal}>
          <FeedingForm
            key={editFeeding?.id ?? "new"}
            date={date}
            initial={editFeeding}
            initialType={addType as FeedingType | undefined}
            onSubmit={async () => {
              closeModal();
              await refresh();
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}
      {modal === "sleep" && (
        <Modal title={editSleep ? t("sleep.edit") : t("sleep.add")} onClose={closeModal}>
          <SleepForm
            key={editSleep?.id ?? "new"}
            date={date}
            initial={editSleep}
            onSubmit={async () => {
              closeModal();
              await refresh();
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}
      {modal === "elimination" && (
        <Modal title={editElim ? t("elim.edit") : t("elim.add")} onClose={closeModal}>
          <EliminationForm
            key={editElim?.id ?? "new"}
            date={date}
            initial={editElim}
            initialType={addType as ElimType | undefined}
            onSubmit={async () => {
              closeModal();
              await refresh();
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}
      {modal === "supplement" && (
        <Modal title={editSupp ? t("supp.edit") : t("supp.add")} onClose={closeModal}>
          <SupplementForm
            key={editSupp?.id ?? "new"}
            date={date}
            initial={editSupp}
            onSubmit={async () => {
              closeModal();
              await refresh();
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}
      {modal === "shower" && (
        <Modal title={editShower ? t("shower.edit") : t("shower.add")} onClose={closeModal}>
          <ShowerForm
            key={editShower?.id ?? "new"}
            date={date}
            initial={editShower}
            onSubmit={async () => {
              closeModal();
              await refresh();
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}
      {modal === "log" && (
        <Modal title={t("log.title")} onClose={closeModal}>
          <LogForm
            date={date}
            onSubmit={async () => {
              closeModal();
              await refresh();
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}
    </>
  );
}
