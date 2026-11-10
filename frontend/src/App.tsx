import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Baby } from "./types";
import { SetupScreen } from "./components/SetupScreen";
import { Dashboard } from "./components/Dashboard";

export default function App() {
  const [baby, setBaby] = useState<Baby | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setBaby(await api.getBaby());
    } catch (e) {
      console.error(e);
      setBaby({ birthday: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="loading">Loading…</div>;
  }

  if (!baby || !baby.birthday) {
    return <SetupScreen onDone={load} />;
  }

  return <Dashboard birthday={baby.birthday} />;
}
