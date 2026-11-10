import { useState } from "react";
import { setBaby } from "../api";
import { todayStr } from "../dates";
import type { Baby, Sex } from "../types";
import { Modal } from "./Modal";

interface Props {
  baby: Baby;
  onClose: () => void;
  onSaved: (b: Baby) => void;
}

export function ProfileModal({ baby, onClose, onSaved }: Props) {
  const [birthday, setBirthday] = useState(baby.birthday ?? "");
  const [sex, setSex] = useState<Sex | null>(baby.sex ?? null);
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
      const b = await setBaby({ birthday, sex });
      onSaved(b);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Baby profile" onClose={onClose}>
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
      <div className="form-actions">
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
