import { useMemo, useState } from "react";
import { createFeeding, updateFeeding } from "../api";
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
  let prev: number | null = null;
  for (const w of rows) {
    if (prev !== null) {
      const delta = w.weight - prev;
      if (delta > 0) {
        if (w.side === "left") left += delta;
        else if (w.side === "right") right += delta;
      }
    }
    prev = w.weight;
  }
  return { left, right, total: left + right };
}

interface Props {
  date: string;
  initial: Feeding | null;
  initialType?: FeedingType;
  onSubmit: () => void;
  onCancel: () => void;
}

export function FeedingForm({ date, initial, initialType, onSubmit, onCancel }: Props) {
  const { t } = useLang();
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDateTime(date));
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

  const preview = useMemo(() => {
    if (type === "breast") {
      const valid = weights
        .filter((r) => r.weight.trim() !== "" && !isNaN(parseFloat(r.weight)))
        .map((r, i) => ({ weight: parseFloat(r.weight), side: i === 0 ? ("na" as Side) : r.side }));
      const b = computeBreast(valid);
      return { left: b.left, right: b.right, total: b.total, formula: 0 };
    }
    return {
      left: 0,
      right: 0,
      total: parseFloat(bottleBreast) || 0,
      formula: parseFloat(bottleFormula) || 0,
    };
  }, [type, weights, bottleFormula, bottleBreast]);

  function setWeight(i: number, patch: Partial<WeightRow>) {
    setWeights((ws) => ws.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  }
  function addWeight() {
    setWeights((ws) => [...ws, { weight: "", side: "left", time: "" }]);
  }
  function removeWeight(i: number) {
    setWeights((ws) => ws.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!datetime) {
      setError(t("feeding.needTime"));
      return;
    }
    const input: FeedingInput = { datetime, type };
    if (type === "breast") {
      const valid = weights.filter(
        (r) => r.weight.trim() !== "" && !isNaN(parseFloat(r.weight))
      );
      if (valid.length < 1) {
        setError(t("feeding.needWeights"));
        return;
      }
      input.weights = valid.map((r, i) => ({
        weight: parseFloat(r.weight),
        side: i === 0 ? "na" : r.side,
        ...(r.time ? { time: r.time } : {}),
      }));
    } else {
      input.bottleFormulaMl = parseFloat(bottleFormula) || 0;
      input.bottleBreastMl = parseFloat(bottleBreast) || 0;
    }
    setSaving(true);
    setError(null);
    try {
      if (initial) await updateFeeding(initial.id, input);
      else await createFeeding(input);
      onSubmit();
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
        </button>
        <button
          type="button"
          className={type === "bottle" ? "active" : ""}
          onClick={() => setType("bottle")}
        >
          🍼 {t("feeding.bottle")}
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
            {t("feeding.left")} <b>{Math.round(preview.left)} ml</b> ·{" "}
            {t("feeding.right")} <b>{Math.round(preview.right)} ml</b> ·{" "}
            <span className="total">
              {t("item.total")} {Math.round(preview.total)} ml
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
            {t("item.formula")} <b>{Math.round(preview.formula)} ml</b> ·{" "}
            {t("item.breastMl")} <b>{Math.round(preview.total)} ml</b>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? "…" : initial ? t("feeding.edit") : t("feeding.add")}
        </button>
        {initial && (
          <button className="btn ghost" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
