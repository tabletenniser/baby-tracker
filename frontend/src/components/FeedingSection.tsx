import { useState } from "react";
import { api } from "../api";
import { formatMl, formatTime } from "../dates";
import type { Feeding } from "../types";
import { FeedingForm } from "./FeedingForm";

interface Props {
  date: string;
  feedings: Feeding[];
  onChanged: () => void;
}

export function FeedingSection({ date, feedings, onChanged }: Props) {
  const [editing, setEditing] = useState<Feeding | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this feeding?")) return;
    await api.deleteFeeding(id);
    setEditing(null);
    onChanged();
  }

  return (
    <section className="card">
      <h2 className="card-title">Feeding</h2>
      <FeedingForm
        key={`${date}-${editing?.id ?? "new"}`}
        date={date}
        initial={editing}
        onSubmit={() => {
          setEditing(null);
          onChanged();
        }}
        onCancel={() => setEditing(null)}
      />
      <div className="list">
        {feedings.length === 0 && <div className="empty">No feedings logged.</div>}
        {feedings.map((f) => (
          <div className="list-item" key={f.id}>
            <div className="list-main">
              <div className="list-title">
                {f.type === "breast" ? "🤱 Breast" : "🍼 Bottle"}
                <span className="muted"> · {formatTime(f.datetime)}</span>
              </div>
              <div className="list-detail">
                {f.type === "breast" ? (
                  <>
                    Total <b>{formatMl(f.breastMl)}</b>
                    {f.leftMl > 0 && <> · L {formatMl(f.leftMl)}</>}
                    {f.rightMl > 0 && <> · R {formatMl(f.rightMl)}</>}
                  </>
                ) : (
                  <>
                    Formula <b>{formatMl(f.formulaMl)}</b>
                    {f.breastMl > 0 && <> · Breast {formatMl(f.breastMl)}</>}
                  </>
                )}
              </div>
            </div>
            <div className="list-actions">
              <button className="btn ghost sm" onClick={() => setEditing(f)}>
                Edit
              </button>
              <button className="btn ghost sm danger" onClick={() => remove(f.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
