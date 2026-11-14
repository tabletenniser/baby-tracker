import { useState } from "react";
import { logEvents } from "../api";
import { defaultDateTime, formatMl } from "../dates";
import { supplementLabel, useLang } from "../i18n";
import type { LogRequest, PoopSize } from "../types";

interface Props {
  date: string;
  onSubmit: () => void;
  onCancel: () => void;
}

const num = (s: string): number | null => {
  const v = parseFloat(s);
  return s.trim() !== "" && !isNaN(v) ? v : null;
};

const SUPP_OPTIONS = ["Vitamin D", "Probiotic", "Iron", "Vitamin C"];
const SUPP_EMOJI: Record<string, string> = {
  "Vitamin D": "☀️",
  "Probiotic": "🦠",
  "Iron": "🔩",
  "Vitamin C": "🍊",
};

export function LogForm({ date, onSubmit, onCancel }: Props) {
  const { lang, t } = useLang();
  const [datetime, setDatetime] = useState(defaultDateTime(date));
  // breast
  const [breastMl, setBreastMl] = useState("");
  const [leftMl, setLeftMl] = useState("");
  const [rightMl, setRightMl] = useState("");
  const [beforeWeight, setBeforeWeight] = useState("");
  const [leftTime, setLeftTime] = useState("");
  const [rightTime, setRightTime] = useState("");
  // bottle
  const [formulaMl, setFormulaMl] = useState("");
  const [bottleBreastMl, setBottleBreastMl] = useState("");
  // sleep
  const [sleepHours, setSleepHours] = useState("");
  // pee / poop
  const [pee, setPee] = useState(false);
  const [poop, setPoop] = useState(false);
  const [poopSize, setPoopSize] = useState<PoopSize | "">("");
  const [poopWatery, setPoopWatery] = useState("");
  // shower
  const [shower, setShower] = useState(false);
  // supplements (multiple allowed)
  const [suppSelected, setSuppSelected] = useState<string[]>([]);
  const [suppOther, setSuppOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const bTotal = num(breastMl);
  const bLeft = num(leftMl);
  const bRight = num(rightMl);
  const bBefore = num(beforeWeight);
  const hasBreast = bTotal != null || bLeft != null || bRight != null || bBefore != null;
  const hasBottle = num(formulaMl) != null || num(bottleBreastMl) != null;
  const hasSleep = num(sleepHours) != null;

  const suppList = [...suppSelected];
  if (suppOther.trim()) suppList.push(suppOther.trim());

  function toggleSupp(name: string) {
    setSuppSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  async function submit() {
    if (!hasBreast && !hasBottle && !hasSleep && !pee && !poop && !shower && !suppList.length) {
      setError(t("log.needSomething"));
      return;
    }
    const req: LogRequest = { datetime };
    if (hasBreast) {
      if (bLeft != null || bRight != null) {
        req.leftMl = bLeft ?? 0;
        req.rightMl = bRight ?? 0;
      } else {
        req.breastMl = bTotal ?? 0;
      }
      if (bBefore != null) req.beforeWeight = bBefore;
      if (leftTime) req.leftTime = leftTime;
      if (rightTime) req.rightTime = rightTime;
    }
    if (hasBottle) {
      req.formulaMl = num(formulaMl) ?? 0;
      req.bottleBreastMl = num(bottleBreastMl) ?? 0;
    }
    if (hasSleep) req.sleepHours = num(sleepHours) ?? 0;
    if (pee) req.pee = true;
    if (poop) {
      req.poop = true;
      if (poopSize) req.poopSize = poopSize;
      if (poopWatery) req.poopWatery = parseInt(poopWatery, 10);
    }
    if (shower) req.shower = true;
    if (suppList.length) req.supplements = suppList;
    setSaving(true);
    setError(null);
    try {
      await logEvents(req);
      onSubmit();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  function previewItems(): string[] {
    const items: string[] = [];
    if (hasBreast) {
      const total = bLeft != null || bRight != null ? (bLeft ?? 0) + (bRight ?? 0) : bTotal ?? 0;
      items.push(`${t("item.breast")} ${formatMl(total, lang)}`);
    }
    if (hasBottle) items.push(t("item.bottle"));
    if (hasSleep) items.push(`${t("item.sleep")} ${num(sleepHours) ?? 0}h`);
    if (pee) items.push(t("item.pee"));
    if (poop) items.push(t("item.poop"));
    if (shower) items.push(t("item.shower"));
    if (suppList.length) items.push(suppList.map((n) => supplementLabel(n, t)).join(", "));
    return items.length ? items : [t("log.nothing")];
  }

  return (
    <div className="log-form">
      <label className="field">
        <span>{t("log.time")}</span>
        <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
      </label>

      <div className="log-section">
        <div className="log-section-head">
          <span className="log-emoji">🤱</span>
          <span>{t("log.breast")}</span>
        </div>
        <div className="row-3">
          <label className="field">
            <span>{t("log.breastTotal")}</span>
            <input type="number" inputMode="decimal" value={breastMl} onChange={(e) => setBreastMl(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("feeding.left")}</span>
            <input type="number" inputMode="decimal" value={leftMl} onChange={(e) => setLeftMl(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("feeding.right")}</span>
            <input type="number" inputMode="decimal" value={rightMl} onChange={(e) => setRightMl(e.target.value)} />
          </label>
        </div>
        <div className="row-2">
          <label className="field">
            <span>{t("log.breastBefore")}</span>
            <input type="number" inputMode="decimal" value={beforeWeight} onChange={(e) => setBeforeWeight(e.target.value)} />
          </label>
          <div className="row-2">
            <label className="field">
              <span>{t("log.leftTime")}</span>
              <input type="time" value={leftTime} onChange={(e) => setLeftTime(e.target.value)} />
            </label>
            <label className="field">
              <span>{t("log.rightTime")}</span>
              <input type="time" value={rightTime} onChange={(e) => setRightTime(e.target.value)} />
            </label>
          </div>
        </div>
        <div className="hint">{t("log.breastHint")}</div>
      </div>

      <div className="log-section">
        <div className="log-section-head">
          <span className="log-emoji">🍼</span>
          <span>{t("log.bottle")}</span>
        </div>
        <div className="row-2">
          <label className="field">
            <span>{t("feeding.formulaMl")}</span>
            <input type="number" inputMode="decimal" value={formulaMl} onChange={(e) => setFormulaMl(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("feeding.breastMl")}</span>
            <input type="number" inputMode="decimal" value={bottleBreastMl} onChange={(e) => setBottleBreastMl(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="log-section">
        <div className="log-section-head">
          <span className="log-emoji">😴</span>
          <span>{t("log.sleep")}</span>
        </div>
        <label className="field">
          <span>{t("sleep.duration")}</span>
          <input type="number" step="0.25" inputMode="decimal" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} />
        </label>
      </div>

      <div className="log-section">
        <div className="log-toggles">
          <button type="button" className={`toggle-chip${pee ? " active" : ""}`} onClick={() => setPee(!pee)}>
            <span className="log-emoji">💧</span>
            <span>{t("log.pee")}</span>
            {pee && <span className="chip-check">✓</span>}
          </button>
          <button type="button" className={`toggle-chip${poop ? " active" : ""}`} onClick={() => setPoop(!poop)}>
            <span className="log-emoji">💩</span>
            <span>{t("log.poop")}</span>
            {poop && <span className="chip-check">✓</span>}
          </button>
        </div>
        {poop && (
          <div className="row-2">
            <label className="field">
              <span>{t("elim.size")}</span>
              <select value={poopSize} onChange={(e) => setPoopSize(e.target.value as PoopSize | "")}>
                <option value="">{t("elim.notSet")}</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
              </select>
            </label>
            <label className="field">
              <span>{t("elim.watery")}</span>
              <select value={poopWatery} onChange={(e) => setPoopWatery(e.target.value)}>
                <option value="">{t("elim.notSet")}</option>
                <option value="1">{t("elim.formed")}</option>
                <option value="2">{t("elim.middle")}</option>
                <option value="3">{t("elim.wateryLevel")}</option>
              </select>
            </label>
          </div>
        )}
      </div>

      <div className="log-section">
        <div className="log-section-head">
          <span className="log-emoji">🚿</span>
          <span>{t("log.shower")}</span>
        </div>
        <div className="log-toggles">
          <button type="button" className={`toggle-chip${shower ? " active" : ""}`} onClick={() => setShower(!shower)}>
            <span className="log-emoji">🚿</span>
            <span>{t("log.shower")}</span>
            {shower && <span className="chip-check">✓</span>}
          </button>
        </div>
      </div>

      <div className="log-section">
        <div className="log-section-head">
          <span className="log-emoji">💊</span>
          <span>{t("log.supplement")}</span>
        </div>
        <div className="log-toggles">
          {SUPP_OPTIONS.map((name) => (
            <button
              type="button"
              key={name}
              className={`toggle-chip${suppSelected.includes(name) ? " active" : ""}`}
              onClick={() => toggleSupp(name)}
            >
              <span className="log-emoji">{SUPP_EMOJI[name]}</span>
              <span>{supplementLabel(name, t)}</span>
              {suppSelected.includes(name) && <span className="chip-check">✓</span>}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{t("supp.other")}</span>
          <input type="text" value={suppOther} onChange={(e) => setSuppOther(e.target.value)} placeholder={t("supp.otherPlaceholder")} />
        </label>
      </div>

      <div className="preview">
        {t("log.willLog", { items: previewItems().join(" · ") })}
      </div>

      {error && <div className="error">{error}</div>}
      <div className="form-actions">
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? "…" : t("log.save")}
        </button>
        <button className="btn ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
