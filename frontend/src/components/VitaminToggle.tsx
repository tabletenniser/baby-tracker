import { useState } from "react";
import { api } from "../api";
import { formatTime, toLocalDateTime } from "../dates";
import type { VitaminDRec } from "../types";

interface Props {
  date: string;
  vitamin: VitaminDRec;
  onChanged: () => void;
}

export function VitaminToggle({ date, vitamin, onChanged }: Props) {
  const [time, setTime] = useState(vitamin.time ?? toLocalDateTime(new Date()));
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !vitamin.taken;
    setSaving(true);
    try {
      await api.setVitamin(date, next, next ? time : null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function changeTime(e: React.ChangeEvent<HTMLInputElement>) {
    setTime(e.target.value);
    if (vitamin.taken && e.target.value) {
      await api.setVitamin(date, true, e.target.value);
      onChanged();
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Vitamin D</h2>
      <div className="vitamin">
        <button
          className={`vitamin-toggle ${vitamin.taken ? "on" : ""}`}
          onClick={toggle}
          disabled={saving}
        >
          {vitamin.taken ? "✅ Given today" : "☀️ Not given yet"}
        </button>
        {vitamin.taken && (
          <label className="field">
            <span>Time</span>
            <input
              type="datetime-local"
              value={time}
              onChange={changeTime}
            />
          </label>
        )}
        {vitamin.taken && vitamin.time && (
          <div className="muted small">Last updated {formatTime(vitamin.time)}</div>
        )}
      </div>
    </section>
  );
}
