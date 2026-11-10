import type {
  Baby,
  DailySummary,
  Elimination,
  EliminationInput,
  Feeding,
  FeedingInput,
  Sleep,
  SleepInput,
  VitaminDRec,
} from "./types";

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getBaby: () => req<Baby>("/api/baby"),
  setBaby: (birthday: string) =>
    req<Baby>("/api/baby", { method: "PUT", body: JSON.stringify({ birthday }) }),

  getFeedings: (date?: string) =>
    req<Feeding[]>(`/api/feedings${date ? `?date=${date}` : ""}`),
  createFeeding: (f: FeedingInput) =>
    req<Feeding>("/api/feedings", { method: "POST", body: JSON.stringify(f) }),
  updateFeeding: (id: string, f: FeedingInput) =>
    req<Feeding>(`/api/feedings/${id}`, { method: "PUT", body: JSON.stringify(f) }),
  deleteFeeding: (id: string) => req(`/api/feedings/${id}`, { method: "DELETE" }),

  getSleeps: (date?: string) => req<Sleep[]>(`/api/sleeps${date ? `?date=${date}` : ""}`),
  createSleep: (s: SleepInput) =>
    req<Sleep>("/api/sleeps", { method: "POST", body: JSON.stringify(s) }),
  updateSleep: (id: string, s: SleepInput) =>
    req<Sleep>(`/api/sleeps/${id}`, { method: "PUT", body: JSON.stringify(s) }),
  deleteSleep: (id: string) => req(`/api/sleeps/${id}`, { method: "DELETE" }),

  getEliminations: (date?: string) =>
    req<Elimination[]>(`/api/eliminations${date ? `?date=${date}` : ""}`),
  createElimination: (e: EliminationInput) =>
    req<Elimination>("/api/eliminations", { method: "POST", body: JSON.stringify(e) }),
  updateElimination: (id: string, e: EliminationInput) =>
    req<Elimination>(`/api/eliminations/${id}`, { method: "PUT", body: JSON.stringify(e) }),
  deleteElimination: (id: string) => req(`/api/eliminations/${id}`, { method: "DELETE" }),

  getVitamin: (date: string) => req<VitaminDRec>(`/api/vitamin?date=${date}`),
  setVitamin: (date: string, taken: boolean, time: string | null) =>
    req<VitaminDRec>(`/api/vitamin?date=${date}`, {
      method: "PUT",
      body: JSON.stringify({ taken, time }),
    }),

  getDaily: (date: string) => req<DailySummary>(`/api/daily?date=${date}`),
};
