import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { formatHours, formatTime, toLocalDateTime, defaultDateTime } from "../dates";
import type { Sleep, SleepInput, SleepMode } from "../types";

interface Props {
  date: string;
  sleeps: Sleep[];
  onChanged: () => void;
}

export function SleepSection({ date, sleeps, onChanged }: Props) {
  const endDefault = defaultDateTime(date);
  const [mode, setMode] = useState<SleepMode>("start_end");
  const [startTime, setStartTime] = useState(() => {
    const end = new Date(endDefault);
    return toLocalDateTime(new Date(end.getTime() - 3 * 3600 * 1000));
  });
  const [endTime, setEndTime] = useState(endDefault);
  const [durationHours, setDurationHours] = useState("3");
  const [editing, setEditing] = useState<Sleep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset form defaults when the selected day changes (component is not remounted).
  useEffect(() => {
    const end = defaultDateTime(date);
    setEndTime(end);
    setStartTime(
      toLocalDateTime(new Date(new Date(end).getTime() - 3 * 3600 * 1000))
    );
    setMode("start_end");
    setDurationHours("3");
    setEditing(null);
    setError(null);
  }, [date]);

  const previewHours = useMemo(() => {
    if (mode === "start_end") {
      if (!startTime || !endTime) return 0;
      const ms = new Date(endTime).getTime() - new Date(startTime).getTime();
      return Math.max(0, ms / 3600000);
    }
    return parseFloat(durationHours) || 0;
  }, [mode, startTime, endTime, durationHours]);

  function startEdit(s: Sleep) {
    setEditing(s);
    setMode(s.mode);
    setStartTime(s.startTime ?? "");
    setEndTime(s.end);
    setDurationHours(String(s.durationHours ?? ""));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setError(null);
  }

  async function submit() {
    const input: SleepInput = { mode, endTime };
    if (mode === "start_end") input.startTime = startTime;
    else input.durationHours = parseFloat(durationHours) || 0;
    if (mode === "start_end" && !startTime) {
      setError("Please set a start time.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) await api.updateSleep(editing.id, input);
      else await api.createSleep(input);
      setEditing(null);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this sleep?")) return;
    await api.deleteSleep(id);
    setEditing(null);
    onChanged();
  }

  return (
    <section className="card">
      <h2 className="card-title">Sleep</h2>
      <div className="sleep-form">
        <div className="segmented">
          <button
            type="button"
            className={mode === "start_end" ? "active" : ""}
            onClick={() => setMode("start_end")}
          >
            Start + End
          </button>
          <button
            type="button"
            className={mode === "duration_end" ? "active" : ""}
            onClick={() => setMode("duration_end")}
          >
            Duration + End
          </button>
        </div>

        {mode === "start_end" ? (
          <div className="row-2">
            <label className="field">
              <span>Start</span>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label className="field">
              <span>End</span>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>
        ) : (
          <div className="row-2">
            <label className="field">
              <span>Duration (h)</span>
              <input
                type="number"
                step="0.25"
                inputMode="decimal"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
              />
            </label>
            <label className="field">
              <span>End</span>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="preview">
          Sleep <b>{formatHours(previewHours)}</b>
        </div>

        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button className="btn primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Update sleep" : "Add sleep"}
          </button>
          {editing && (
            <button className="btn ghost" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="list">
        {sleeps.length === 0 && <div className="empty">No sleep logged.</div>}
        {sleeps.map((s) => (
          <div className="list-item" key={s.id}>
            <div className="list-main">
              <div className="list-title">
                😴 {formatHours(s.hours)}
                <span className="muted">
                  {" "}
                  · {formatTime(s.start)} → {formatTime(s.end)}
                </span>
              </div>
            </div>
            <div className="list-actions">
              <button className="btn ghost sm" onClick={() => startEdit(s)}>
                Edit
              </button>
              <button className="btn ghost sm danger" onClick={() => remove(s.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
