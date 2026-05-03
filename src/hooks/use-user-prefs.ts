// Hook: useUserPrefs
// Lightweight hook to read user preferences (budget, risk, sectors).
// Used by all tabs to apply budget filtering.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserPrefs {
  id?: string;
  max_investment: number;
  risk_appetite: "low" | "medium" | "high";
  preferred_horizon: "weekly" | "monthly" | "3months";
  preferred_sectors: string[];
}

const DEFAULT_PREFS: UserPrefs = {
  max_investment: 50000,
  risk_appetite: "medium",
  preferred_horizon: "monthly",
  preferred_sectors: [],
};

export function useUserPrefs() {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("user_preferences")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setPrefs(data as UserPrefs);
      })
      .finally(() => setLoaded(true));
  }, []);

  return { prefs, loaded };
}
