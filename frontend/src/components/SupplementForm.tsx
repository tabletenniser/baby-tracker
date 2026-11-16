import { useState } from "react";
import { createSupplement, deleteSupplement, updateSupplement } from "../api";
import { defaultDateTime } from "../dates";
import { supplementLabel, useLang } from "../i18n";
import type { Supplement } from "../types";

interface Props {
  date: string;
  cutoff?: string;
  initial: Supplement | null;
  onSubmit: () => void;
  onCancel: () => void;
}

const SUPP_OPTIONS = ["Vitamin D", "Probiotic", "Iron", "Vitamin C"];
const SUPP_EMOJI: Record<string, string> = {
  "Vitamin D": "☀️",
  "Probiotic": "🦠",
  "Iron": "🔩",
  "Vitamin C": "🍊",
};

export function SupplementForm({ date, cutoff, initial, onSubmit, onCancel }: Props) {
  const { t } = useLang();
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDateTime(date, cutoff));
  // multi-select: known chips + free-form "other"
  const [suppSelected, setSuppSelected] = useState<string[]>(() =>
    initial?.name && SUPP_OPTIONS.includes(initial.name) ? [initial.name] : []
  );
  const [suppOther, setSuppOther] = useState(
    initial?.name && !SUPP_OPTIONS.includes(initial.name) ? initial.name : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const suppList = [...suppSelected];
  if (suppOther.trim()) suppList.push(suppOther.trim());

  function toggleSupp(name: string) {
    setSuppSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  async function submit() {
    if (!suppList.length) {
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
      if (initial) {
        // Editing one existing record: repurpose it for the first selected
        // name, create the rest, and delete it if nothing is left selected.
        if (!suppList.length) {
          await deleteSupplement(initial.id);
        } else {
          await updateSupplement(initial.id, { name: suppList[0], datetime });
          for (const name of suppList.slice(1)) {
            await createSupplement({ name, datetime });
          }
        }
      } else {
        for (const name of suppList) {
          await createSupplement({ name, datetime });
        }
      }
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
        <div className="log-toggles">
          {SUPP_OPTIONS.map((name) => (
            <button
              type="button"
              key={name}
              className={`toggle-chip${suppSelected.includes(name) ? " active" : ""}`}
              onClick={() => toggleSupp(name)}
            >
              <span className="log-emoji">{SUPP_EMOJI[name]}</span>
              <span>{supplementLabel(name, t)}</span>
              {suppSelected.includes(name) && <span className="chip-check">✓</span>}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>{t("supp.other")}</span>
        <input
          type="text"
          value={suppOther}
          onChange={(e) => setSuppOther(e.target.value)}
          placeholder={t("supp.otherPlaceholder")}
        />
      </label>
      {suppList.length > 0 && (
        <div className="preview">
          {suppList.map((n) => supplementLabel(n, t)).join(" · ")}
        </div>
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
