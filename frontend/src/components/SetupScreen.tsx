import { useState } from "react";
import { setBaby } from "../api";
import { todayStr } from "../dates";
import type { Sex } from "../types";

export function SetupScreen({ onDone }: { onDone: () => void }) {
  const [birthday, setBirthday] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!birthday) {
      setError("Please pick a birthday.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setBaby({ birthday, sex });
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
        <h1>Baby Tracker</h1>
        <p className="setup-sub">Let's set up your little one's profile to get started.</p>
        <label className="field">
          <span>Birthday</span>
          <input
            type="date"
            value={birthday}
            max={todayStr()}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </label>
        <div className="field">
          <span>Sex</span>
          <div className="segmented">
            <button
              type="button"
              className={sex === "female" ? "active" : ""}
              onClick={() => setSex("female")}
            >
              ♀ Girl
            </button>
            <button
              type="button"
              className={sex === "male" ? "active" : ""}
              onClick={() => setSex("male")}
            >
              ♂ Boy
            </button>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn primary big" onClick={submit} disabled={saving || !birthday}>
          {saving ? "Saving…" : "Get started"}
        </button>
      </div>
    </div>
  );
}
