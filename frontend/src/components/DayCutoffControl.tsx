import { useEffect, useState } from "react";
import { getDayCutoff, setDayCutoff } from "../api";
import { useLang } from "../i18n";

interface Props {
  date: string;
  currentCutoff: string; // the effective cutoff for this day
  onChanged: () => void; // refresh the timeline after a change
}

/** Per-day override for when the day starts (for splitting sleep). */
export function DayCutoffControl({ date, currentCutoff, onChanged }: Props) {
  const { t } = useLang();
  const [value, setValue] = useState(currentCutoff);
  const [hasOverride, setHasOverride] = useState(false);

  useEffect(() => {
    setValue(currentCutoff);
    getDayCutoff()
      .then((d) => setHasOverride(!!d.overrides[date]))
      .catch(() => {});
  }, [date, currentCutoff]);

  async function apply(cutoff: string) {
    setValue(cutoff);
    try {
      const res = await setDayCutoff({ date, cutoff });
      setHasOverride(!!res.overrides[date]);
      onChanged();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="cutoff-control">
      <span className="cutoff-label">{t("cutoff.label")}</span>
      <input type="time" value={value} onChange={(e) => apply(e.target.value)} />
      {hasOverride && (
        <button className="btn ghost sm" onClick={() => apply("")}>
          {t("cutoff.clear")}
        </button>
      )}
    </div>
  );
}
