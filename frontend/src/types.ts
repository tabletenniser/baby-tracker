export type Sex = "male" | "female";

export interface Baby {
  birthday: string | null;
  sex: Sex | null;
  name: string | null;
  dayCutoff: string | null; // HH:MM, when the day starts (for sleep attribution)
}

export interface DayCutoffData {
  global: string;
  overrides: Record<string, string>; // YYYY-MM-DD -> HH:MM
}

export type FeedingType = "breast" | "bottle";
export type Side = "left" | "right" | "na";

export interface WeightEntry {
  weight: number;
  side: Side;
}

export interface Feeding {
  id: string;
  datetime: string;
  type: FeedingType;
  weights: WeightEntry[];
  bottleFormulaMl: number | null;
  bottleBreastMl: number | null;
  breastMl: number;
  leftMl: number;
  rightMl: number;
  formulaMl: number;
}

export interface FeedingInput {
  datetime: string;
  type: FeedingType;
  weights?: WeightEntry[];
  bottleFormulaMl?: number | null;
  bottleBreastMl?: number | null;
}

export type SleepMode = "start_end" | "duration_end";

export interface Sleep {
  id: string;
  mode: SleepMode;
  startTime: string | null;
  endTime: string;
  durationHours: number | null;
  start: string;
  end: string;
  hours: number;
  overnight?: boolean;
  dayHours?: number;
}

export interface SleepInput {
  mode: SleepMode;
  startTime?: string | null;
  endTime: string;
  durationHours?: number | null;
}

export type ElimType = "pee" | "poop";
export type PoopSize = "S" | "M" | "L";

export interface Elimination {
  id: string;
  datetime: string;
  type: ElimType;
  size: PoopSize | null;
  watery: number | null;
}

export interface EliminationInput {
  datetime: string;
  type: ElimType;
  size?: PoopSize | null;
  watery?: number | null;
}

export interface Supplement {
  id: string;
  name: string;
  datetime: string;
}

export interface DailySummary {
  date: string;
  breastMl: number;
  formulaMl: number;
  totalMl: number;
  sleepHours: number;
  peeCount: number;
  poopCount: number;
  supplements: string[];
  vitaminD: boolean;
}

export interface TimelineData {
  date: string;
  feedings: Feeding[];
  sleeps: Sleep[];
  eliminations: Elimination[];
  supplements: Supplement[];
  daily: DailySummary;
  cutoff: string;
}

export interface CurvePoint {
  t: number; // hours since the day's cutoff (0..24)
  ml: number; // cumulative ml up to that time
}
export interface CurveEvent {
  t: number;
  ml: number;
  type: "supplement" | "poop";
}
export interface MilkCurveData {
  cutoff: string;
  today: CurvePoint[];
  compare: CurvePoint[] | null;
  compareDays: number;
  events: CurveEvent[];
}

export interface MilkPoint {
  date: string;
  breast: number;
  formula: number;
  total: number;
  left: number;
  right: number;
}
export interface HourPoint {
  date: string;
  hours: number;
}
export interface CountPoint {
  date: string;
  count: number;
}
export interface Bedtime {
  avgStartHour: number | null;
  count: number;
}
export interface StatsData {
  milk: MilkPoint[];
  sleep: HourPoint[];
  poop: CountPoint[];
  pee: CountPoint[];
  bedtime: Bedtime;
}

export interface GrowthMeasurement {
  datetime: string;
  date: string;
  weightKg: number;
  ageDays: number;
}
export interface GrowthCurves {
  ageMonths: number[];
  p3: number[];
  p15: number[];
  p50: number[];
  p85: number[];
  p97: number[];
}
export interface GrowthLatest {
  weightKg: number;
  ageDays: number;
  percentile: number;
}
export interface GrowthData {
  sex: Sex | null;
  birthday: string | null;
  measurements: GrowthMeasurement[];
  curves: GrowthCurves | null;
  latest: GrowthLatest | null;
}
