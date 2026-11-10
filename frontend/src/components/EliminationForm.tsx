import { useState } from "react";
import { createElimination, updateElimination } from "../api";
import { defaultDateTime } from "../dates";
import type { Elimination, EliminationInput, ElimType, PoopSize } from "../types";

interface Props {
  date: string;
  initial: Elimination | null;
  onSubmit: () => void;
  onCancel: () => void;
}

const WATERY_LABELS: Record<number, string> = {
  1: "Formed",
  2: "Middle",
  3: "Watery",
};

export function EliminationForm({ date, initial, onSubmit, onCancel }: Props) {
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDateTime(date));
  const [type, setType] = useState<ElimType>(initial?.type ?? "pee");
  const [size, setSize] = useState<PoopSize>(initial?.size ?? "M");
  const [watery, setWatery] = useState<number>(initial?.watery ?? 2);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!datetime) {
      setError("Please set a time.");
      return;
    }
    const input: EliminationInput = { datetime, type };
    if (type === "poop") {
      input.size = size;
      input.watery = watery;
    }
    setSaving(true);
    setError(null);
    try {
      if (initial) await updateElimination(initial.id, input);
      else await createElimination(input);
      onSubmit();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="elim-form">
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
          className={type === "pee" ? "active" : ""}
          onClick={() => setType("pee")}
        >
          💧 Pee
        </button>
        <button
          type="button"
          className={type === "poop" ? "active" : ""}
          onClick={() => setType("poop")}
        >
          💩 Poop
        </button>
      </div>

      {type === "poop" && (
        <>
          <div className="row-2">
            <label className="field">
              <span>Size</span>
              <select value={size} onChange={(e) => setSize(e.target.value as PoopSize)}>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
              </select>
            </label>
            <label className="field">
              <span>Watery</span>
              <select value={watery} onChange={(e) => setWatery(Number(e.target.value))}>
                <option value={1}>Formed</option>
                <option value={2}>Middle</option>
                <option value={3}>Watery</option>
              </select>
            </label>
          </div>
          <div className="preview">
            Size <b>{size}</b> · {WATERY_LABELS[watery]}
          </div>
        </>
      )}

      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : initial ? "Update" : "Add entry"}
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
