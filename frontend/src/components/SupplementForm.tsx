import { useState } from "react";
import { createSupplement, updateSupplement } from "../api";
import { defaultDateTime } from "../dates";
import type { Supplement } from "../types";

interface Props {
  date: string;
  initial: Supplement | null;
  onSubmit: () => void;
  onCancel: () => void;
}

const CHOICES = ["Vitamin D", "Probiotic", "Iron", "Vitamin C", "Other"];

export function SupplementForm({ date, initial, onSubmit, onCancel }: Props) {
  const isCustom = initial?.name ? !CHOICES.includes(initial.name) : false;
  const [name, setName] = useState(initial?.name ?? "");
  const [custom, setCustom] = useState(isCustom ? initial!.name : "");
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDateTime(date));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveName = name === "Other" ? custom : name;

  async function submit() {
    if (!effectiveName.trim()) {
      setError("Please choose or enter a supplement.");
      return;
    }
    if (!datetime) {
      setError("Please set a time.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (initial) await updateSupplement(initial.id, { name: effectiveName.trim(), datetime });
      else await createSupplement({ name: effectiveName.trim(), datetime });
      onSubmit();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="supp-form">
      <label className="field">
        <span>Time</span>
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
        />
      </label>
      <div className="field">
        <span>Supplement</span>
        <select value={name} onChange={(e) => setName(e.target.value)}>
          <option value="">Choose…</option>
          {CHOICES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {name === "Other" && (
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. Calcium"
          />
        </label>
      )}
      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : initial ? "Update" : "Add"}
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
