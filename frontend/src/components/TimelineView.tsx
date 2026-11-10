import { useCallback, useEffect, useState } from "react";
import {
  deleteElimination,
  deleteFeeding,
  deleteSleep,
  deleteSupplement,
  getTimeline,
} from "../api";
import { formatHours, formatMl, shortDate, timeOf, todayStr } from "../dates";
import type {
  Elimination,
  Feeding,
  Sleep,
  Supplement,
  TimelineData,
} from "../types";
import { DailySummaryCard } from "./DailySummary";
import { EliminationForm } from "./EliminationForm";
import { FeedingForm } from "./FeedingForm";
import { Modal } from "./Modal";
import { SleepForm } from "./SleepForm";
import { SupplementForm } from "./SupplementForm";

type Kind = "feeding" | "sleep" | "elimination" | "supplement";
type ModalKind = Kind | null;

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

const WATERY: Record<number, string> = { 1: "Formed", 2: "Middle", 3: "Watery" };

function buildItems(data: TimelineData): Item[] {
  const items: Item[] = [];
  for (const f of data.feedings) {
    const detail =
      f.type === "breast"
        ? `Total ${formatMl(f.breastMl)}${f.leftMl > 0 ? ` · L ${formatMl(f.leftMl)}` : ""}${
            f.rightMl > 0 ? ` · R ${formatMl(f.rightMl)}` : ""
          }`
        : `Formula ${formatMl(f.formulaMl)}${f.breastMl > 0 ? ` · Breast ${formatMl(f.breastMl)}` : ""}`;
    items.push({
      key: `f-${f.id}`,
      sortTime: f.datetime,
      displayTime: timeOf(f.datetime),
      icon: f.type === "breast" ? "🤱" : "🍼",
      title: f.type === "breast" ? "Breast" : "Bottle",
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
      title: overnight ? "Slept until" : "Sleep",
      detail: overnight
        ? `${formatHours(s.dayHours ?? s.hours)} · from ${timeOf(s.start)} prev night`
        : `${formatHours(s.hours)} · ${timeOf(s.start)} → ${timeOf(s.end)}`,
      overnight,
      kind: "sleep",
      id: s.id,
    });
  }
  for (const e of data.eliminations) {
    items.push({
      key: `e-${e.id}`,
      sortTime: e.datetime,
      displayTime: timeOf(e.datetime),
      icon: e.type === "pee" ? "💧" : "💩",
      title: e.type === "pee" ? "Pee" : "Poop",
      detail: e.type === "poop" ? `Size ${e.size} · ${WATERY[e.watery ?? 2]}` : undefined,
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
      title: s.name,
      kind: "supplement",
      id: s.id,
    });
  }
  items.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
  return items;
}

interface Props {
  date: string;
}

export function TimelineView({ date }: Props) {
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
  }, [date]);

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
    if (!confirm("Delete this entry?")) return;
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

  const items = data ? buildItems(data) : [];

  return (
    <>
      {data && <DailySummaryCard daily={data.daily} />}

      <div className="add-bar">
        <button className="btn add-btn" onClick={() => openAdd("feeding")}>
          🤱 Feeding
        </button>
        <button className="btn add-btn" onClick={() => openAdd("sleep")}>
          😴 Sleep
        </button>
        <button className="btn add-btn" onClick={() => openAdd("elimination")}>
          💧 Pee/Poop
        </button>
        <button className="btn add-btn" onClick={() => openAdd("supplement")}>
          💊 Supplement
        </button>
      </div>

      <section className="card">
        <h2 className="card-title">
          {date === todayStr() ? "Today" : shortDate(date)}
        </h2>
        <div className="timeline">
          {items.length === 0 && (
            <div className="empty">Nothing logged yet. Add an activity above.</div>
          )}
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
                  Edit
                </button>
                <button className="btn ghost sm danger" onClick={() => handleDelete(it)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {modal === "feeding" && (
        <Modal title={editFeeding ? "Edit feeding" : "Add feeding"} onClose={closeModal}>
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
        <Modal title={editSleep ? "Edit sleep" : "Add sleep"} onClose={closeModal}>
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
        <Modal title={editElim ? "Edit entry" : "Add pee / poop"} onClose={closeModal}>
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
        <Modal title={editSupp ? "Edit supplement" : "Add supplement"} onClose={closeModal}>
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
