import { useState } from "react";
import { createElimination, updateElimination } from "../api";
import { defaultDateTime } from "../dates";
import { useLang } from "../i18n";
import type { Elimination, EliminationInput, ElimType, PoopSize } from "../types";

interface Props {
  date: string;
  initial: Elimination | null;
  initialType?: ElimType;
  onSubmit: () => void;
  onCancel: () => void;
}

export function EliminationForm({ date, initial, initialType, onSubmit, onCancel }: Props) {
  const { t } = useLang();
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDateTime(date));
  const [type, setType] = useState<ElimType>(initial?.type ?? initialType ?? "pee");
  const [size, setSize] = useState<PoopSize | "">(initial?.size ?? "");
  const [watery, setWatery] = useState<string>(initial?.watery != null ? String(initial.watery) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!datetime) {
      setError(t("feeding.needTime"));
      return;
    }
    const input: EliminationInput = { datetime, type };
    if (type === "poop") {
      if (size) input.size = size;
      if (watery) input.watery = parseInt(watery, 10);
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
        <span>{t("elim.time")}</span>
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
          💧 {t("elim.pee")}
        </button>
        <button
          type="button"
          className={type === "poop" ? "active" : ""}
          onClick={() => setType("poop")}
        >
          💩 {t("elim.poop")}
        </button>
      </div>

      {type === "poop" && (
        <>
          <div className="row-2">
            <label className="field">
              <span>{t("elim.size")}</span>
              <select value={size} onChange={(e) => setSize(e.target.value as PoopSize | "")}>
                <option value="">{t("elim.notSet")}</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
              </select>
            </label>
            <label className="field">
              <span>{t("elim.watery")}</span>
              <select value={watery} onChange={(e) => setWatery(e.target.value)}>
                <option value="">{t("elim.notSet")}</option>
                <option value={1}>{t("elim.formed")}</option>
                <option value={2}>{t("elim.middle")}</option>
                <option value={3}>{t("elim.wateryLevel")}</option>
              </select>
            </label>
          </div>
          <div className="preview">
            {t("item.size")} <b>{size || t("elim.notSet")}</b> · {t("item.watery")}:{" "}
            {watery === "1" ? t("elim.formed") : watery === "2" ? t("elim.middle") : watery === "3" ? t("elim.wateryLevel") : t("elim.notSet")}
          </div>
        </>
      )}

      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? "…" : initial ? t("elim.edit") : t("elim.add")}
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
