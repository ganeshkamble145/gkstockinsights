import { useState, useEffect } from "react";

const STORAGE_KEY = "gk_gemini_api_key";

export function useGeminiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setApiKey(saved);
  }, []);

  const saveKey = (key: string | null) => {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key);
      setApiKey(key);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setApiKey(null);
    }
  };

  return { apiKey, saveKey };
}
