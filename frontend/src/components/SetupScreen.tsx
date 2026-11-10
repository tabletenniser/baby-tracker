import { useState } from "react";
import { api } from "../api";
import { todayStr } from "../dates";

export function SetupScreen({ onDone }: { onDone: () => void }) {
  const [birthday, setBirthday] = useState("");
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
      await api.setBaby(birthday);
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
        {error && <div className="error">{error}</div>}
        <button className="btn primary big" onClick={submit} disabled={saving || !birthday}>
          {saving ? "Saving…" : "Get started"}
        </button>
      </div>
    </div>
  );
}
