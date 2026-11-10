import { useMemo, useState } from "react";
import { api } from "../api";
import { defaultDateTime } from "../dates";
import type { Feeding, FeedingInput, FeedingType, Side } from "../types";

interface WeightRow {
  weight: string;
  side: Side;
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
  onSubmit: () => void;
  onCancel: () => void;
}

export function FeedingForm({ date, initial, onSubmit, onCancel }: Props) {
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDateTime(date));
  const [type, setType] = useState<FeedingType>(initial?.type ?? "breast");
  const [weights, setWeights] = useState<WeightRow[]>(() => {
    if (initial && initial.type === "breast") {
      const w = (initial.weights ?? []).map((x) => ({
        weight: String(x.weight),
        side: x.side,
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
    setWeights((ws) => [...ws, { weight: "", side: "left" }]);
  }
  function removeWeight(i: number) {
    setWeights((ws) => ws.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!datetime) {
      setError("Please set a time.");
      return;
    }
    const input: FeedingInput = { datetime, type };
    if (type === "breast") {
      const valid = weights.filter(
        (r) => r.weight.trim() !== "" && !isNaN(parseFloat(r.weight))
      );
      if (valid.length < 2) {
        setError("Add at least two weights to calculate the amount fed.");
        return;
      }
      input.weights = valid.map((r, i) => ({
        weight: parseFloat(r.weight),
        side: i === 0 ? "na" : r.side,
      }));
    } else {
      input.bottleFormulaMl = parseFloat(bottleFormula) || 0;
      input.bottleBreastMl = parseFloat(bottleBreast) || 0;
    }
    setSaving(true);
    setError(null);
    try {
      if (initial) await api.updateFeeding(initial.id, input);
      else await api.createFeeding(input);
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
        <span>Time</span>
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
          🤱 Breast
        </button>
        <button
          type="button"
          className={type === "bottle" ? "active" : ""}
          onClick={() => setType("bottle")}
        >
          🍼 Bottle
        </button>
      </div>

      {type === "breast" ? (
        <div className="weights">
          <div className="weights-head">
            <span>Weight (g)</span>
            <span>Side</span>
            <span />
          </div>
          {weights.map((w, i) => (
            <div className="weight-row" key={i}>
              <input
                type="number"
                inputMode="numeric"
                placeholder={i === 0 ? "before" : "after"}
                value={w.weight}
                onChange={(e) => setWeight(i, { weight: e.target.value })}
              />
              {i === 0 ? (
                <span className="side-na">start</span>
              ) : (
                <select
                  value={w.side}
                  onChange={(e) => setWeight(i, { side: e.target.value as Side })}
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="na">N/A</option>
                </select>
              )}
              <button
                type="button"
                className="btn icon danger"
                onClick={() => removeWeight(i)}
                disabled={weights.length <= 1}
                aria-label="Remove weight"
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={addWeight}>
            + Add weight
          </button>
          <div className="preview">
            Left <b>{Math.round(preview.left)} ml</b> · Right <b>{Math.round(preview.right)} ml</b> ·{" "}
            <span className="total">Total {Math.round(preview.total)} ml</span>
          </div>
        </div>
      ) : (
        <div className="bottle">
          <label className="field">
            <span>Formula milk (ml)</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={bottleFormula}
              onChange={(e) => setBottleFormula(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Breast milk (ml)</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={bottleBreast}
              onChange={(e) => setBottleBreast(e.target.value)}
            />
          </label>
          <div className="preview">
            Formula <b>{Math.round(preview.formula)} ml</b> · Breast <b>{Math.round(preview.total)} ml</b>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : initial ? "Update feeding" : "Add feeding"}
        </button>
        {initial && (
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
