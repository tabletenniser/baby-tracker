import type {
  Baby,
  DailySummary,
  DayCutoffData,
  Elimination,
  EliminationInput,
  Feeding,
  FeedingInput,
  GrowthData,
  LogRequest,
  MilkCurveData,
  Sleep,
  SleepInput,
  StatsData,
  Supplement,
  TimelineData,
} from "./types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// Baby
export const getBaby = () => request<Baby>("/api/baby");
export const setBaby = (baby: Baby) =>
  request<Baby>("/api/baby", { method: "PUT", body: JSON.stringify(baby) });

// Day cutoff
export const getDayCutoff = () => request<DayCutoffData>("/api/day-cutoff");
export const setDayCutoff = (body: {
  globalCutoff?: string;
  date?: string;
  cutoff?: string;
}) =>
  request<DayCutoffData>("/api/day-cutoff", {
    method: "PUT",
    body: JSON.stringify(body),
  });

// Feedings
export const getFeedings = (date?: string) =>
  request<Feeding[]>(`/api/feedings${date ? `?date=${date}` : ""}`);
export const createFeeding = (f: FeedingInput) =>
  request<Feeding>("/api/feedings", { method: "POST", body: JSON.stringify(f) });
export const updateFeeding = (id: string, f: FeedingInput) =>
  request<Feeding>(`/api/feedings/${id}`, { method: "PUT", body: JSON.stringify(f) });
export const deleteFeeding = (id: string) =>
  request<{ ok: boolean }>(`/api/feedings/${id}`, { method: "DELETE" });

// Sleep
export const getSleeps = (date?: string) =>
  request<Sleep[]>(`/api/sleeps${date ? `?date=${date}` : ""}`);
export const createSleep = (s: SleepInput) =>
  request<Sleep>("/api/sleeps", { method: "POST", body: JSON.stringify(s) });
export const updateSleep = (id: string, s: SleepInput) =>
  request<Sleep>(`/api/sleeps/${id}`, { method: "PUT", body: JSON.stringify(s) });
export const deleteSleep = (id: string) =>
  request<{ ok: boolean }>(`/api/sleeps/${id}`, { method: "DELETE" });

// Eliminations
export const getEliminations = (date?: string) =>
  request<Elimination[]>(`/api/eliminations${date ? `?date=${date}` : ""}`);
export const createElimination = (e: EliminationInput) =>
  request<Elimination>("/api/eliminations", { method: "POST", body: JSON.stringify(e) });
export const updateElimination = (id: string, e: EliminationInput) =>
  request<Elimination>(`/api/eliminations/${id}`, { method: "PUT", body: JSON.stringify(e) });
export const deleteElimination = (id: string) =>
  request<{ ok: boolean }>(`/api/eliminations/${id}`, { method: "DELETE" });

// Supplements
export const getSupplements = (date?: string) =>
  request<Supplement[]>(`/api/supplements${date ? `?date=${date}` : ""}`);
export const createSupplement = (s: { name: string; datetime: string }) =>
  request<Supplement>("/api/supplements", { method: "POST", body: JSON.stringify(s) });
export const updateSupplement = (id: string, s: { name: string; datetime: string }) =>
  request<Supplement>(`/api/supplements/${id}`, { method: "PUT", body: JSON.stringify(s) });
export const deleteSupplement = (id: string) =>
  request<{ ok: boolean }>(`/api/supplements/${id}`, { method: "DELETE" });

// Daily summary
export const getDaily = (date: string) => request<DailySummary>(`/api/daily?date=${date}`);

// Log several events at one timestamp
export const logEvents = (req: LogRequest) =>
  request<{ ok: boolean; created: Record<string, string[]> }>("/api/log", {
    method: "POST",
    body: JSON.stringify(req),
  });

// Timeline
export const getTimeline = (date: string) => request<TimelineData>(`/api/timeline?date=${date}`);

// Stats
export const getStats = (start: string, end: string) =>
  request<StatsData>(`/api/stats?start=${start}&end=${end}`);

// Milk curve (cumulative milk over the day)
export const getMilkCurve = (date: string, compare: string) =>
  request<MilkCurveData>(`/api/milk-curve?date=${date}&compare=${compare}`);

// Growth
export const getGrowth = () => request<GrowthData>("/api/growth");
