import { useCallback, useEffect, useState } from "react";
import {
  deleteElimination,
  deleteFeeding,
  deleteSleep,
  deleteSupplement,
  getTimeline,
} from "../api";
import { formatHours, formatMl, shortDate, timeOf, todayStr } from "../dates";
import { supplementLabel, useLang } from "../i18n";
import type {
  Elimination,
  Feeding,
  Sleep,
  Supplement,
  TimelineData,
} from "../types";
import { DailySummaryCard } from "./DailySummary";
import { DayCutoffControl } from "./DayCutoffControl";
import { EliminationForm } from "./EliminationForm";
import { FeedingForm } from "./FeedingForm";
import { FeedingTrend } from "./FeedingTrend";
import { MilkCurve } from "./MilkCurve";
import { Modal } from "./Modal";
import { SleepForm } from "./SleepForm";
import { SupplementForm } from "./SupplementForm";

type Kind = "feeding" | "sleep" | "elimination" | "supplement";
type ModalKind = Kind | null;
type T = (key: string, vars?: Record<string, string | number>) => string;

interface Item {
  key: string;
  sortTime: string;
  displayTime: string;
  icon: string;
  title: string;
  detail?: string;
  overnight?: boolean;
  kind: Kind;
  id: string;
}

function buildItems(data: TimelineData, t: T, lang: "en" | "zh"): Item[] {
  const items: Item[] = [];
  for (const f of data.feedings) {
    const detail =
      f.type === "breast"
        ? f.breastMl > 0
          ? `${t("item.total")} ${formatMl(f.breastMl, lang)}${
              f.leftMl > 0 ? ` · ${t("item.left")} ${formatMl(f.leftMl, lang)}` : ""
            }${f.rightMl > 0 ? ` · ${t("item.right")} ${formatMl(f.rightMl, lang)}` : ""}`
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
      id: s.id,
    });
  }
  for (const e of data.eliminations) {
    const wateryLabel =
      e.watery === 1 ? t("elim.formed") : e.watery === 3 ? t("elim.wateryLevel") : t("elim.middle");
    items.push({
      key: `e-${e.id}`,
      sortTime: e.datetime,
      displayTime: timeOf(e.datetime),
      icon: e.type === "pee" ? "💧" : "💩",
      title: e.type === "pee" ? t("item.pee") : t("item.poop"),
      detail: e.type === "poop" ? `${t("item.size")} ${e.size} · ${t("item.watery")}: ${wateryLabel}` : undefined,
      kind: "elimination",
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

  function openAdd(kind: Kind) {
    setEditFeeding(null);
    setEditSleep(null);
    setEditElim(null);
    setEditSupp(null);
    setModal(kind);
  }

  function openEdit(item: Item) {
    if (!data) return;
    if (item.kind === "feeding") setEditFeeding(data.feedings.find((f) => f.id === item.id) ?? null);
    else if (item.kind === "sleep") setEditSleep(data.sleeps.find((s) => s.id === item.id) ?? null);
    else if (item.kind === "elimination")
      setEditElim(data.eliminations.find((e) => e.id === item.id) ?? null);
    else setEditSupp(data.supplements.find((s) => s.id === item.id) ?? null);
    setModal(item.kind);
  }

  function closeModal() {
    setModal(null);
    setEditFeeding(null);
    setEditSleep(null);
    setEditElim(null);
    setEditSupp(null);
  }

  async function handleDelete(item: Item) {
    if (!confirm(t("common.confirmDelete"))) return;
    try {
      if (item.kind === "feeding") await deleteFeeding(item.id);
      else if (item.kind === "sleep") await deleteSleep(item.id);
      else if (item.kind === "elimination") await deleteElimination(item.id);
      else await deleteSupplement(item.id);
      await refresh();
    } catch (e) {
      alert(String(e));
    }
  }

  const items = data ? buildItems(data, t, lang) : [];

  return (
    <>
      {data && <DailySummaryCard daily={data.daily} />}

      <div className="add-bar">
        <button className="btn add-btn" onClick={() => openAdd("feeding")}>
          {t("add.feeding")}
        </button>
        <button className="btn add-btn" onClick={() => openAdd("sleep")}>
          {t("add.sleep")}
        </button>
        <button className="btn add-btn" onClick={() => openAdd("elimination")}>
          {t("add.elim")}
        </button>
        <button className="btn add-btn" onClick={() => openAdd("supplement")}>
          {t("add.supplement")}
        </button>
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
          {items.length === 0 && <div className="empty">{t("item.noActivity")}</div>}
          {items.map((it) => (
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
    </>
  );
}
