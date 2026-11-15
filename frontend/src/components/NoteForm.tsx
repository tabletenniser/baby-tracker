import { useState } from "react";
import { createNote, updateNote } from "../api";
import { defaultDateTime } from "../dates";
import { useLang } from "../i18n";
import type { Note } from "../types";

interface Props {
  date: string;
  initial: Note | null;
  onSubmit: () => void;
  onCancel: () => void;
}

export function NoteForm({ date, initial, onSubmit, onCancel }: Props) {
  const { t } = useLang();
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDateTime(date));
  const [text, setText] = useState(initial?.text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!datetime) {
      setError(t("feeding.needTime"));
      return;
    }
    if (!text.trim()) {
      setError(t("note.needText"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (initial) await updateNote(initial.id, { datetime, text: text.trim() });
      else await createNote({ datetime, text: text.trim() });
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
        <span>{t("note.time")}</span>
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
        />
      </label>
      <label className="field">
        <span>{t("note.text")}</span>
        <textarea
          className="note-textarea"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("note.placeholder")}
        />
      </label>
      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? "…" : initial ? t("note.edit") : t("note.add")}
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
