import { useEffect, useState } from "react";
import { api } from "../api";
import { formatTime, defaultDateTime } from "../dates";
import type { Elimination, EliminationInput, ElimType, PoopSize, WateryLevel } from "../types";

interface Props {
  date: string;
  eliminations: Elimination[];
  onChanged: () => void;
}

const WATERY_LABELS: Record<WateryLevel, string> = {
  1: "Formed",
  2: "Middle",
  3: "Watery",
};

export function EliminationSection({ date, eliminations, onChanged }: Props) {
  const [datetime, setDatetime] = useState(defaultDateTime(date));
  const [type, setType] = useState<ElimType>("pee");
  const [size, setSize] = useState<PoopSize>("M");
  const [watery, setWatery] = useState<WateryLevel>(2);
  const [editing, setEditing] = useState<Elimination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset the form when the selected day changes (component is not remounted).
  useEffect(() => {
    setDatetime(defaultDateTime(date));
    setEditing(null);
    setError(null);
  }, [date]);

  function startEdit(e: Elimination) {
    setEditing(e);
    setDatetime(e.datetime.slice(0, 16));
    setType(e.type);
    setSize(e.size || "M");
    setWatery(e.watery || 2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setError(null);
  }

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
      if (editing) await api.updateElimination(editing.id, input);
      else await api.createElimination(input);
      setEditing(null);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    await api.deleteElimination(id);
    setEditing(null);
    onChanged();
  }

  return (
    <section className="card">
      <h2 className="card-title">Pee &amp; Poop</h2>
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
                <select
                  value={watery}
                  onChange={(e) => setWatery(Number(e.target.value) as WateryLevel)}
                >
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
            {saving ? "Saving…" : editing ? "Update" : "Add entry"}
          </button>
          {editing && (
            <button className="btn ghost" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="list">
        {eliminations.length === 0 && <div className="empty">No entries logged.</div>}
        {eliminations.map((e) => (
          <div className="list-item" key={e.id}>
            <div className="list-main">
              <div className="list-title">
                {e.type === "pee" ? "💧 Pee" : "💩 Poop"}
                <span className="muted"> · {formatTime(e.datetime)}</span>
              </div>
              {e.type === "poop" && (
                <div className="list-detail">
                  Size <b>{e.size}</b> · {WATERY_LABELS[e.watery]}
                </div>
              )}
            </div>
            <div className="list-actions">
              <button className="btn ghost sm" onClick={() => startEdit(e)}>
                Edit
              </button>
              <button className="btn ghost sm danger" onClick={() => remove(e.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
