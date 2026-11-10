import { useMemo, useState } from "react";
import { createSleep, updateSleep } from "../api";
import { formatHours, toLocalDateTime, defaultDateTime } from "../dates";
import type { Sleep, SleepInput, SleepMode } from "../types";

interface Props {
  date: string;
  initial: Sleep | null;
  onSubmit: () => void;
  onCancel: () => void;
}

export function SleepForm({ date, initial, onSubmit, onCancel }: Props) {
  const [mode, setMode] = useState<SleepMode>(initial?.mode ?? "start_end");
  const [startTime, setStartTime] = useState(() => {
    if (initial?.startTime) return initial.startTime;
    const end = new Date(defaultDateTime(date));
    return toLocalDateTime(new Date(end.getTime() - 3 * 3600 * 1000));
  });
  const [endTime, setEndTime] = useState(initial?.endTime ?? defaultDateTime(date));
  const [durationHours, setDurationHours] = useState(
    initial?.durationHours != null ? String(initial.durationHours) : "3"
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const previewHours = useMemo(() => {
    if (mode === "start_end") {
      if (!startTime || !endTime) return 0;
      const ms = new Date(endTime).getTime() - new Date(startTime).getTime();
      return Math.max(0, ms / 3600000);
    }
    return parseFloat(durationHours) || 0;
  }, [mode, startTime, endTime, durationHours]);

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
      if (initial) await updateSleep(initial.id, input);
      else await createSleep(input);
      onSubmit();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
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
          {saving ? "Saving…" : initial ? "Update sleep" : "Add sleep"}
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
