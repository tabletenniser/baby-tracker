import { useState } from "react";
import {
  logEvents,
  deleteFeeding,
  deleteSleep,
  deleteElimination,
  deleteSupplement,
  deleteShower,
  deleteNote,
} from "../api";
import { defaultDateTime, formatMl } from "../dates";
import { supplementLabel, useLang } from "../i18n";
import type { LogRequest, PoopSize, Side, LogInitial } from "../types";

const SUPP_OPTIONS = ["Vitamin D", "Probiotic", "Iron", "Vitamin C"];
const SUPP_EMOJI: Record<string, string> = {
  "Vitamin D": "☀️",
  Probiotic: "🦠",
  Iron: "🔩",
  "Vitamin C": "🍊",
};

const num = (s: string): number | null => {
  const v = parseFloat(s);
  return s.trim() !== "" && !isNaN(v) ? v : null;
};

interface WeightRow {
  weight: string;
  side: Side;
  time: string;
}

/** Compute left/right/total ml from a sequence of weights (first = before).
 *  Matches the backend: total = sum of all positive deltas; left/right only
 *  count deltas whose entry side is left/right (N/A deltas count toward total only).
 */
function computeBreast(rows: { weight: number; side: Side }[]) {
  let left = 0;
  let right = 0;
  let total = 0;
  for (let i = 1; i < rows.length; i++) {
    const delta = rows[i].weight - rows[i - 1].weight;
    if (delta > 0) {
      total += delta;
      if (rows[i].side === "left") left += delta;
      else if (rows[i].side === "right") right += delta;
    }
  }
  return { left, right, total };
}

interface Props {
  date: string;
  cutoff?: string;
  initial?: LogInitial | null;
  onSubmit: () => void;
  onCancel: () => void;
}

export function LogForm({ date, cutoff, initial, onSubmit, onCancel }: Props) {
  const { lang, t } = useLang();
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDateTime(date, cutoff));
  // breast (multi-weight, like the feeding form)
  const [weights, setWeights] = useState<WeightRow[]>(() => {
    if (initial?.breast?.weights?.length) {
      return initial.breast.weights.map((w) => ({
        weight: w.weight != null ? String(w.weight) : "",
        side: w.side,
        time: w.time ?? "",
      }));
    }
    return [];
  });
  // bottle
  const [formulaMl, setFormulaMl] = useState(
    initial?.bottle?.bottleFormulaMl != null ? String(initial.bottle.bottleFormulaMl) : ""
  );
  const [bottleBreastMl, setBottleBreastMl] = useState(
    initial?.bottle?.bottleBreastMl != null ? String(initial.bottle.bottleBreastMl) : ""
  );
  // sleep
  const [sleepHours, setSleepHours] = useState(initial?.sleep ? String(initial.sleep.hours) : "");
  // pee / poop
  const [pee, setPee] = useState(!!initial?.pee);
  const [poop, setPoop] = useState(!!initial?.poop);
  const [poopSize, setPoopSize] = useState<PoopSize | "">(initial?.poop?.size ?? "");
  const [poopWatery, setPoopWatery] = useState(
    initial?.poop?.watery != null ? String(initial.poop.watery) : ""
  );
  // shower
  const [shower, setShower] = useState(!!initial?.shower);
  // note / remark
  const [note, setNote] = useState(initial?.note ?? "");
  // supplements (multiple allowed)
  const [suppSelected, setSuppSelected] = useState<string[]>(() =>
    (initial?.supplements ?? []).filter((n) => SUPP_OPTIONS.includes(n))
  );
  const [suppOther, setSuppOther] = useState(() =>
    (initial?.supplements ?? []).find((n) => !SUPP_OPTIONS.includes(n)) ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Valid weights: drop empty/unparseable entries, then treat the first as "before" (na).
  const validWeights = weights
    .filter((w) => w.weight.trim() !== "" && !isNaN(parseFloat(w.weight)))
    .map((w, i) => ({ weight: parseFloat(w.weight), side: i === 0 ? ("na" as Side) : w.side }));
  const preview = computeBreast(validWeights);
  const hasBreast = validWeights.length > 0;
  const hasBottle = num(formulaMl) != null || num(bottleBreastMl) != null;
  const hasSleep = num(sleepHours) != null;

  const suppList = [...suppSelected];
  if (suppOther.trim()) suppList.push(suppOther.trim());

  function toggleSupp(name: string) {
    setSuppSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function addWeight() {
    setWeights((prev) => [...prev, { weight: "", side: "left", time: "" }]);
  }
  function setWeight(i: number, patch: Partial<WeightRow>) {
    setWeights((prev) => prev.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  }
  function removeWeight(i: number) {
    setWeights((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!hasBreast && !hasBottle && !hasSleep && !pee && !poop && !shower && !note.trim() && !suppList.length) {
      setError(t("log.needSomething"));
      return;
    }
    const req: LogRequest = { datetime };
    if (hasBreast) {
      if (preview.left > 0 || preview.right > 0) {
        req.leftMl = preview.left;
        req.rightMl = preview.right;
      } else {
        req.breastMl = preview.total;
      }
      if (validWeights.length > 0) req.beforeWeight = validWeights[0].weight;
      const leftW = weights.find((w) => w.side === "left");
      const rightW = weights.find((w) => w.side === "right");
      if (leftW?.time) req.leftTime = leftW.time;
      if (rightW?.time) req.rightTime = rightW.time;
    }
    if (hasBottle) {
      req.formulaMl = num(formulaMl) ?? 0;
      req.bottleBreastMl = num(bottleBreastMl) ?? 0;
    }
    if (hasSleep) req.sleepHours = num(sleepHours) ?? 0;
    if (pee) req.pee = true;
    if (poop) {
      req.poop = true;
      if (poopSize) req.poopSize = poopSize;
      if (poopWatery) req.poopWatery = parseInt(poopWatery, 10);
    }
    if (shower) req.shower = true;
    if (note.trim()) req.note = note.trim();
    if (suppList.length) req.supplements = suppList;
    setSaving(true);
    setError(null);
    try {
      // Edit mode: replace the old records at this timestamp with the new set.
      const ids = initial?.deleteIds;
      if (ids) {
        for (const id of ids.feedings) await deleteFeeding(id);
        for (const id of ids.sleeps) await deleteSleep(id);
        for (const id of ids.eliminations) await deleteElimination(id);
        for (const id of ids.supplements) await deleteSupplement(id);
        for (const id of ids.showers) await deleteShower(id);
        for (const id of ids.notes) await deleteNote(id);
      }
      await logEvents(req);
      onSubmit();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  function previewItems(): string[] {
    const items: string[] = [];
    if (hasBreast) items.push(`${t("item.breast")} ${formatMl(preview.total, lang)}`);
    if (hasBottle) items.push(t("item.bottle"));
    if (hasSleep) items.push(`${t("item.sleep")} ${num(sleepHours) ?? 0}h`);
    if (pee) items.push(t("item.pee"));
    if (poop) items.push(t("item.poop"));
    if (shower) items.push(t("item.shower"));
    if (note.trim()) items.push(`${t("item.note")}: ${note.trim()}`);
    if (suppList.length) items.push(suppList.map((n) => supplementLabel(n, t)).join(", "));
    return items.length ? items : [t("log.nothing")];
  }

  return (
    <div className="log-form">
      <label className="field">
        <span>{t("log.time")}</span>
        <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
      </label>

      {/* Breast (multi-weight) */}
      <div className="log-section">
        <div className="log-section-head">
          <span className="log-emoji">🤱</span>
          <span>{t("log.breast")}</span>
        </div>
        {weights.length === 0 ? (
          <button type="button" className="btn ghost" onClick={addWeight}>
            {t("feeding.addWeight")}
          </button>
        ) : (
          <div className="weights">
            <div className="weights-head">
              <span>{t("feeding.weight")}</span>
              <span>{t("feeding.side")}</span>
              <span>{t("feeding.timeCol")}</span>
            </div>
            {weights.map((w, i) => (
              <div className="weight-row" key={i}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder={i === 0 ? t("feeding.before") : t("feeding.after")}
                  value={w.weight}
                  onChange={(e) => setWeight(i, { weight: e.target.value })}
                />
                {i === 0 ? (
                  <span className="side-na">{t("feeding.before")}</span>
                ) : (
                  <select
                    value={w.side}
                    onChange={(e) => setWeight(i, { side: e.target.value as Side })}
                  >
                    <option value="left">{t("feeding.left")}</option>
                    <option value="right">{t("feeding.right")}</option>
                    <option value="na">{t("feeding.na")}</option>
                  </select>
                )}
                {i === 0 ? (
                  <span className="time-cell" />
                ) : (
                  <input
                    type="time"
                    value={w.time || ""}
                    onChange={(e) => setWeight(i, { time: e.target.value })}
                    title={t("feeding.timeTitle")}
                  />
                )}
                <button
                  type="button"
                  className="btn icon danger"
                  onClick={() => removeWeight(i)}
                  disabled={weights.length <= 1}
                  aria-label={t("common.remove")}
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn ghost" onClick={addWeight}>
              {t("feeding.addWeight")}
            </button>
            {preview.total > 0 && (
              <div className="preview">
                {t("feeding.left")} <b>{Math.round(preview.left)} ml</b> ·{" "}
                {t("feeding.right")} <b>{Math.round(preview.right)} ml</b> ·{" "}
                <span className="total">
                  {t("item.total")} {Math.round(preview.total)} ml
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottle */}
      <div className="log-section">
        <div className="log-section-head">
          <span className="log-emoji">🍼</span>
          <span>{t("log.bottle")}</span>
        </div>
        <div className="row-2">
          <label className="field">
            <span>{t("feeding.formulaMl")}</span>
            <input type="number" inputMode="decimal" value={formulaMl} onChange={(e) => setFormulaMl(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("feeding.breastMl")}</span>
            <input type="number" inputMode="decimal" value={bottleBreastMl} onChange={(e) => setBottleBreastMl(e.target.value)} />
          </label>
        </div>
      </div>

      {/* Sleep */}
      <div className="log-section">
        <div className="log-section-head">
          <span className="log-emoji">😴</span>
          <span>{t("log.sleep")}</span>
        </div>
        <label className="field">
          <span>{t("sleep.duration")}</span>
          <input type="number" step="0.25" inputMode="decimal" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} />
        </label>
      </div>

      {/* Pee / Poop */}
      <div className="log-section">
        <div className="log-toggles">
          <button type="button" className={`toggle-chip${pee ? " active" : ""}`} onClick={() => setPee(!pee)}>
            <span className="log-emoji">💧</span>
            <span>{t("log.pee")}</span>
            {pee && <span className="chip-check">✓</span>}
          </button>
          <button type="button" className={`toggle-chip${poop ? " active" : ""}`} onClick={() => setPoop(!poop)}>
            <span className="log-emoji">💩</span>
            <span>{t("log.poop")}</span>
            {poop && <span className="chip-check">✓</span>}
          </button>
        </div>
        {poop && (
          <div className="row-2">
            <label className="field">
              <span>{t("elim.size")}</span>
              <select value={poopSize} onChange={(e) => setPoopSize(e.target.value as PoopSize | "")}>
                <option value="">{t("elim.notSet")}</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
              </select>
            </label>
            <label className="field">
              <span>{t("elim.watery")}</span>
              <select value={poopWatery} onChange={(e) => setPoopWatery(e.target.value)}>
                <option value="">{t("elim.notSet")}</option>
                <option value="1">{t("elim.formed")}</option>
                <option value="2">{t("elim.middle")}</option>
                <option value="3">{t("elim.wateryLevel")}</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {/* Shower */}
      <div className="log-section">
        <div className="log-toggles">
          <button type="button" className={`toggle-chip${shower ? " active" : ""}`} onClick={() => setShower(!shower)}>
            <span className="log-emoji">🚿</span>
            <span>{t("log.shower")}</span>
            {shower && <span className="chip-check">✓</span>}
          </button>
        </div>
      </div>

      {/* Note */}
      <div className="log-section">
        <div className="log-section-head">
          <span className="log-emoji">📝</span>
          <span>{t("log.note")}</span>
        </div>
        <div className="field">
          <textarea
            className="note-textarea"
            placeholder={t("note.placeholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {/* Supplements */}
      <div className="log-section">
        <div className="log-section-head">
          <span className="log-emoji">💊</span>
          <span>{t("log.supplement")}</span>
        </div>
        <div className="log-toggles">
          {SUPP_OPTIONS.map((name) => (
            <button
              key={name}
              type="button"
              className={`toggle-chip${suppSelected.includes(name) ? " active" : ""}`}
              onClick={() => toggleSupp(name)}
            >
              {SUPP_EMOJI[name]} {name}
              {suppSelected.includes(name) && <span className="chip-check">✓</span>}
            </button>
          ))}
        </div>
        <div className="field">
          <label>{t("supp.other")}</label>
          <input
            type="text"
            placeholder={t("supp.otherPlaceholder")}
            value={suppOther}
            onChange={(e) => setSuppOther(e.target.value)}
          />
        </div>
      </div>

      {previewItems().length > 0 && (
        <div className="preview">
          {t("log.willLog", { items: previewItems().join(" · ") })}
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" disabled={saving} onClick={submit}>
          {initial ? t("common.save") : t("log.save")}
        </button>
        <button className="btn ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
