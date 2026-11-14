import { useState } from "react";
import { createShower, updateShower } from "../api";
import { defaultDateTime } from "../dates";
import { useLang } from "../i18n";
import type { Shower } from "../types";

interface Props {
  date: string;
  initial: Shower | null;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ShowerForm({ date, initial, onSubmit, onCancel }: Props) {
  const { t } = useLang();
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDateTime(date));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!datetime) {
      setError(t("feeding.needTime"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (initial) await updateShower(initial.id, { datetime });
      else await createShower({ datetime });
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
        <span>{t("shower.time")}</span>
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
        />
      </label>
      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? "…" : initial ? t("shower.edit") : t("shower.add")}
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
