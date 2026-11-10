import { useState } from "react";
import { setBaby } from "../api";
import { todayStr } from "../dates";
import { useLang } from "../i18n";
import type { Sex } from "../types";

export function SetupScreen({ onDone }: { onDone: () => void }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
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
      await setBaby({ birthday, sex, name: name.trim() || null, dayCutoff: "00:00" });
      onDone();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="setup">
      <div className="setup-card">
        <div className="setup-emoji">🍼</div>
        <h1>{t("setup.title")}</h1>
        <p className="setup-sub">{t("setup.subtitle")}</p>
        <label className="field">
          <span>{t("setup.name")}</span>
          <input
            type="text"
            value={name}
            placeholder="…"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t("setup.birthday")}</span>
          <input
            type="date"
            value={birthday}
            max={todayStr()}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </label>
        <div className="field">
          <span>{t("setup.sex")}</span>
          <div className="segmented">
            <button
              type="button"
              className={sex === "female" ? "active" : ""}
              onClick={() => setSex("female")}
            >
              {t("setup.girl")}
            </button>
            <button
              type="button"
              className={sex === "male" ? "active" : ""}
              onClick={() => setSex("male")}
            >
              {t("setup.boy")}
            </button>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn primary big" onClick={submit} disabled={saving || !birthday}>
          {saving ? "…" : t("setup.go")}
        </button>
      </div>
    </div>
  );
}
