import { useState } from "react";
import { setBaby, setDayCutoff as saveDayCutoff } from "../api";
import { todayStr } from "../dates";
import { useLang } from "../i18n";
import type { Baby, Sex } from "../types";
import { Modal } from "./Modal";

interface Props {
  baby: Baby;
  onClose: () => void;
  onSaved: (b: Baby) => void;
}

export function ProfileModal({ baby, onClose, onSaved }: Props) {
  const { t } = useLang();
  const [name, setName] = useState(baby.name ?? "");
  const [birthday, setBirthday] = useState(baby.birthday ?? "");
  const [sex, setSex] = useState<Sex | null>(baby.sex ?? null);
  const [dayCutoff, setDayCutoff] = useState(baby.dayCutoff ?? "00:00");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!birthday) {
      setError(t("setup.needBirthday"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const b = await setBaby({
        birthday,
        sex,
        name: name.trim() || null,
        dayCutoff,
      });
      await saveDayCutoff({ globalCutoff: dayCutoff });
      onSaved({ ...b, dayCutoff });
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("profile.title")} onClose={onClose}>
      <label className="field">
        <span>{t("profile.name")}</span>
        <input
          type="text"
          value={name}
          placeholder="…"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span>{t("profile.birthday")}</span>
        <input
          type="date"
          value={birthday}
          max={todayStr()}
          onChange={(e) => setBirthday(e.target.value)}
        />
      </label>
      <div className="field">
        <span>{t("profile.sex")}</span>
        <div className="segmented">
          <button
            type="button"
            className={sex === "female" ? "active" : ""}
            onClick={() => setSex("female")}
          >
            {t("profile.girl")}
          </button>
          <button
            type="button"
            className={sex === "male" ? "active" : ""}
            onClick={() => setSex("male")}
          >
            {t("profile.boy")}
          </button>
        </div>
      </div>
      <label className="field">
        <span>{t("profile.dayStarts")}</span>
        <input
          type="time"
          value={dayCutoff}
          onChange={(e) => setDayCutoff(e.target.value || "00:00")}
        />
        <small className="hint">{t("profile.dayStartsHint")}</small>
      </label>
      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? "…" : t("common.save")}
        </button>
        <button className="btn ghost" onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </Modal>
  );
}
