export type Side = "left" | "right" | "na";
export type FeedingType = "breast" | "bottle";
export type SleepMode = "start_end" | "duration_end";
export type ElimType = "pee" | "poop";
export type PoopSize = "S" | "M" | "L";
// 3-level watery scale: 1 = formed, 2 = middle, 3 = watery
export type WateryLevel = 1 | 2 | 3;

export interface Baby {
  birthday: string | null;
}

export interface WeightEntry {
  weight: number; // grams
  side: Side;
}

export interface Feeding {
  id: string;
  datetime: string;
  type: FeedingType;
  weights?: WeightEntry[];
  bottleFormulaMl?: number;
  bottleBreastMl?: number;
  breastMl: number;
  leftMl: number;
  rightMl: number;
  formulaMl: number;
}

export interface FeedingInput {
  datetime: string;
  type: FeedingType;
  weights?: WeightEntry[];
  bottleFormulaMl?: number;
  bottleBreastMl?: number;
}

export interface Sleep {
  id: string;
  mode: SleepMode;
  endTime: string;
  startTime?: string;
  durationHours?: number;
  start: string;
  end: string;
  hours: number;
}

export interface SleepInput {
  mode: SleepMode;
  endTime: string;
  startTime?: string;
  durationHours?: number;
}

export interface Elimination {
  id: string;
  datetime: string;
  type: ElimType;
  size: PoopSize;
  watery: WateryLevel;
}

export interface EliminationInput {
  datetime: string;
  type: ElimType;
  size?: PoopSize;
  watery?: WateryLevel;
}

export interface VitaminDRec {
  date: string;
  taken: boolean;
  time: string | null;
}

export interface DailySummary {
  date: string;
  breastMl: number;
  formulaMl: number;
  sleepHours: number;
  peeCount: number;
  poopCount: number;
  vitaminD: boolean;
}
