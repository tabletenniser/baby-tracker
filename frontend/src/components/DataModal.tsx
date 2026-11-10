import { useRef, useState } from "react";
import { useLang } from "../i18n";
import { Modal } from "./Modal";

interface ImportSummary {
  imported: { feedings: number; sleeps: number; eliminations: number; supplements: number };
  skipped: number;
  errors: string[];
  clear: boolean;
}

async function download(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/** Import / export data as CSV (Google-Sheets friendly). */
export function DataModal({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doImport(file: File) {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const text = await file.text();
      const res = await fetch(`/api/import${replace ? "?clear=true" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      setSummary(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t("data.title")} onClose={onClose}>
      <div className="data-modal">
        <button className="btn" onClick={() => download("/api/export.csv", "baby-tracker.csv")}>
          {t("data.export")}
        </button>
        <button className="btn" onClick={() => download("/api/template.csv", "baby-tracker-template.csv")}>
          {t("data.template")}
        </button>

        <label className="data-check">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          {t("data.replace")}
        </label>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = "";
          }}
        />
        <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? t("data.importing") : t("data.import")}
        </button>
        <div className="data-hint">{t("data.hint")}</div>

        {error && <div className="error">{error}</div>}
        {summary && (
          <div className="data-result">
            <div>
              {t("data.result", {
                feedings: summary.imported.feedings,
                sleeps: summary.imported.sleeps,
                eliminations: summary.imported.eliminations,
                supplements: summary.imported.supplements,
                skipped: summary.skipped,
              })}
            </div>
            {summary.errors.map((e, i) => (
              <div key={i} className="err-line">{e}</div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
