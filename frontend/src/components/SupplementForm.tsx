import { useState } from "react";
import { createSupplement, updateSupplement } from "../api";
import { defaultDateTime } from "../dates";
import { SUPPLEMENT_CHOICES, supplementLabel, useLang } from "../i18n";
import type { Supplement } from "../types";

interface Props {
  date: string;
  initial: Supplement | null;
  onSubmit: () => void;
  onCancel: () => void;
}

export function SupplementForm({ date, initial, onSubmit, onCancel }: Props) {
  const { t } = useLang();
  const isCustom = initial?.name ? !SUPPLEMENT_CHOICES.includes(initial.name) : false;
  const [name, setName] = useState(initial?.name ?? "");
  const [custom, setCustom] = useState(isCustom ? initial!.name : "");
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDateTime(date));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveName = name === "Other" ? custom : name;

  async function submit() {
    if (!effectiveName.trim()) {
      setError(t("supp.needName"));
      return;
    }
    if (!datetime) {
      setError(t("feeding.needTime"));
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
        <span>{t("supp.time")}</span>
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
        />
      </label>
      <div className="field">
        <span>{t("supp.name")}</span>
        <select value={name} onChange={(e) => setName(e.target.value)}>
          <option value="">{t("supp.choose")}</option>
          {SUPPLEMENT_CHOICES.map((c) => (
            <option key={c} value={c}>
              {supplementLabel(c, t)}
            </option>
          ))}
        </select>
      </div>
      {name === "Other" && (
        <label className="field">
          <span>{t("supp.customName")}</span>
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="…"
          />
        </label>
      )}
      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? "…" : initial ? t("supp.edit") : t("supp.add")}
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
