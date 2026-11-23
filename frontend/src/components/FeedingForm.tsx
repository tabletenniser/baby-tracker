import { useMemo, useState } from "react";
import { createFeeding, deleteFeeding, updateFeeding } from "../api";
import { defaultDateTime } from "../dates";
import { useLang } from "../i18n";
import type { Feeding, FeedingInput, FeedingType, Side } from "../types";

interface WeightRow {
  weight: string;
  side: Side;
  time?: string;
}

function computeBreast(rows: { weight: number; side: Side }[]) {
  let left = 0;
  let right = 0;
  let total = 0;
  let prev: number | null = null;
  for (const w of rows) {
    if (prev !== null) {
      const delta = w.weight - prev;
      if (delta > 0) {
        total += delta;
        if (w.side === "left") left += delta;
        else if (w.side === "right") right += delta;
      }
    }
    prev = w.weight;
  }
  return { left, right, total };
}

interface Props {
  date: string;
  cutoff?: string;
  initial: Feeding | null;
  initialType?: FeedingType;
  onSubmit: () => void;
  onSaved?: () => void;
  onCancel: () => void;
}

export function FeedingForm({ date, cutoff, initial, initialType, onSubmit, onSaved, onCancel }: Props) {
  const { t } = useLang();
  const isNew = !initial;
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDateTime(date, cutoff));
  const [type, setType] = useState<FeedingType>(initial?.type ?? initialType ?? "breast");
  const [weights, setWeights] = useState<WeightRow[]>(() => {
    if (initial && initial.type === "breast") {
      const w = (initial.weights ?? []).map((x) => ({
        weight: String(x.weight),
        side: x.side,
        time: x.time,
      }));
      return w.length ? w : [{ weight: "", side: "na" }];
    }
    if (initial && initial.type === "bottle") return [];
    // New feeding defaults to breast with a single "before" weight.
    return [{ weight: "", side: "na" }];
  });
  const [bottleFormula, setBottleFormula] = useState(
    initial?.type === "bottle" ? String(initial.bottleFormulaMl ?? 0) : ""
  );
  const [bottleBreast, setBottleBreast] = useState(
    initial?.type === "bottle" ? String(initial.bottleBreastMl ?? 0) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Ids of the records created by "Save" in this dialog session (add mode),
  // so later saves update the same records instead of creating duplicates.
  const [createdBreastId, setCreatedBreastId] = useState<string | null>(null);
  const [createdBottleId, setCreatedBottleId] = useState<string | null>(null);

  // Valid weight rows (non-empty, parseable). First row is the "before" weight.
  const validWeights = useMemo(
    () =>
      weights
        .filter((r) => r.weight.trim() !== "" && !isNaN(parseFloat(r.weight)))
        .map((r, i) => ({
          weight: parseFloat(r.weight),
          side: i === 0 ? ("na" as Side) : r.side,
          time: r.time,
        })),
    [weights]
  );
  const breastPreview = useMemo(() => computeBreast(validWeights), [validWeights]);
  const formulaNum = bottleFormula.trim() !== "" ? parseFloat(bottleFormula) : null;
  const bottleBreastNum = bottleBreast.trim() !== "" ? parseFloat(bottleBreast) : null;
  const hasBreast = validWeights.length > 0;
  const hasBottle = formulaNum !== null || bottleBreastNum !== null;

  function setWeight(i: number, patch: Partial<WeightRow>) {
    setWeights((ws) => ws.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  }
  function addWeight() {
    setWeights((ws) => [...ws, { weight: "", side: "left", time: "" }]);
  }
  function removeWeight(i: number) {
    setWeights((ws) => ws.filter((_, idx) => idx !== i));
  }

  async function saveBreast() {
    const input: FeedingInput = {
      datetime,
      type: "breast",
      weights: validWeights.map((r, i) => ({
        weight: r.weight,
        side: i === 0 ? "na" : r.side,
        ...(r.time ? { time: r.time } : {}),
      })),
    };
    if (createdBreastId) {
      await updateFeeding(createdBreastId, input);
    } else {
      const created = await createFeeding(input);
      setCreatedBreastId(created.id);
    }
  }

  async function saveBottle() {
    const input: FeedingInput = {
      datetime,
      type: "bottle",
      bottleFormulaMl: formulaNum ?? 0,
      bottleBreastMl: bottleBreastNum ?? 0,
    };
    if (createdBottleId) {
      await updateFeeding(createdBottleId, input);
    } else {
      const created = await createFeeding(input);
      setCreatedBottleId(created.id);
    }
  }

  async function doSave(exit: boolean) {
    if (!datetime) {
      setError(t("feeding.needTime"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        // Add mode: save whichever tabs have data (both, one, or neither).
        if (!hasBreast && !hasBottle) {
          setError(t("feeding.needSomething"));
          setSaving(false);
          return;
        }
        // Breast
        if (hasBreast) {
          await saveBreast();
        } else if (createdBreastId) {
          await deleteFeeding(createdBreastId);
          setCreatedBreastId(null);
        }
        // Bottle
        if (hasBottle) {
          await saveBottle();
        } else if (createdBottleId) {
          await deleteFeeding(createdBottleId);
          setCreatedBottleId(null);
        }
        if (exit) onSubmit();
        else onSaved?.();
      } else {
        // Edit mode: one record, exactly as before.
        const input: FeedingInput = { datetime, type };
        if (type === "breast") {
          if (validWeights.length < 1) {
            setError(t("feeding.needWeights"));
            setSaving(false);
            return;
          }
          input.weights = validWeights.map((r, i) => ({
            weight: r.weight,
            side: i === 0 ? "na" : r.side,
            ...(r.time ? { time: r.time } : {}),
          }));
        } else {
          input.bottleFormulaMl = formulaNum ?? 0;
          input.bottleBreastMl = bottleBreastNum ?? 0;
        }
        await updateFeeding(initial!.id, input);
        if (exit) onSubmit();
        else onSaved?.();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="feed-form">
      <label className="field">
        <span>{t("feeding.time")}</span>
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
        />
      </label>

      <div className="segmented">
        <button
          type="button"
          className={type === "breast" ? "active" : ""}
          onClick={() => setType("breast")}
        >
          🤱 {t("feeding.breast")}
          {isNew && hasBreast && <span className="tab-dot">•</span>}
        </button>
        <button
          type="button"
          className={type === "bottle" ? "active" : ""}
          onClick={() => setType("bottle")}
        >
          🍼 {t("feeding.bottle")}
          {isNew && hasBottle && <span className="tab-dot">•</span>}
        </button>
      </div>

      {type === "breast" ? (
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
          <div className="preview">
            {t("feeding.left")} <b>{Math.round(breastPreview.left)} ml</b> ·{" "}
            {t("feeding.right")} <b>{Math.round(breastPreview.right)} ml</b> ·{" "}
            <span className="total">
              {t("item.total")} {Math.round(breastPreview.total)} ml
            </span>
          </div>
        </div>
      ) : (
        <div className="bottle">
          <label className="field">
            <span>{t("feeding.formulaMl")}</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={bottleFormula}
              onChange={(e) => setBottleFormula(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t("feeding.breastMl")}</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={bottleBreast}
              onChange={(e) => setBottleBreast(e.target.value)}
            />
          </label>
          <div className="preview">
            {t("item.formula")} <b>{Math.round(formulaNum ?? 0)} ml</b> ·{" "}
            {t("item.breastMl")} <b>{Math.round(bottleBreastNum ?? 0)} ml</b>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" onClick={() => doSave(false)} disabled={saving}>
          {saving ? "…" : t("common.save")}
        </button>
        <button className="btn exit" onClick={() => doSave(true)} disabled={saving}>
          {t("feeding.saveExit")}
        </button>
        <button className="btn ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
