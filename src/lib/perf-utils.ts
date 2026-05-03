/**
 * GK Stocks — shared performance utilities
 *
 * Covers:
 *  - localStorage cache with TTL (Fix 2)
 *  - Market hours check (Fix 6)
 *  - Safe JSON parser (Fix 5)
 *  - fetchWithRetry with 8s timeout + exponential backoff (Fix 4)
 */

// ─── Market hours ──────────────────────────────────────────────────────────

export function checkMarketHours(): boolean {
  try {
    // Robust IST extraction using Intl.DateTimeFormat
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
    
    const parts = fmt.formatToParts(new Date());
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;
    
    const h = parseInt(getPart("hour") || "0", 10);
    const m = parseInt(getPart("minute") || "0", 10);
    const dayName = getPart("weekday"); // Mon, Tue...
    
    const time = h * 60 + m;
    const isWeekday = !["Sat", "Sun"].includes(dayName || "");
    const marketOpen = 9 * 60 + 15;   // 09:15
    const marketClose = 15 * 60 + 30;  // 15:30
    
    return isWeekday && time >= marketOpen && time < marketClose;
  } catch {
    return false;
  }
}

export function isPreOpen(): boolean {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
    });
    const parts = fmt.formatToParts(new Date());
    const get = (type: string) => parts.find(p => p.type === type)?.value;
    
    const h = parseInt(get("hour") || "0", 10);
    const m = parseInt(get("minute") || "0", 10);
    const dayName = get("weekday");
    const totalMin = h * 60 + m;
    
    const isWeekday = !["Sat", "Sun"].includes(dayName || "");
    return isWeekday && totalMin >= 9 * 60 && totalMin < 9 * 60 + 15;
  } catch {
    return false;
  }
}

// ─── TTL table (seconds) ──────────────────────────────────────────────────

export const CACHE_TTL = {
  live_price:         60,      // 1 min during market hours
  market_pulse:       60,
  fo_scan:            3600,    // 1 h (increased to save quota)
  morning_brief:      21_600,  // 6 h
  news_headlines:     1800,    // 30 min
  nifty100_prices:    300,     // 5 min
  penny_scanner:      3600,    // 1 h (increased to save quota)
  fundamental_report: 86_400,  // 24 h
  peer_comparison:    86_400,
  after_market_close: 43_200,  // 12 h (outside trading hrs)
  yahoo_quote:        60,      // 1 min live / 6 h closed
} as const;

export type CacheKey = keyof typeof CACHE_TTL;

// ─── localStorage cache ───────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  storedAt: number;
}

export const gkCache = {
  set<T>(key: string, data: T, ttlSeconds: number): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        expiresAt: Date.now() + ttlSeconds * 1000,
        storedAt: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      /* quota exceeded or SSR — skip */
    }
  },

  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  /** Age in seconds of a cached entry (0 if not cached / expired) */
  ageSeconds(key: string): number {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const entry = JSON.parse(raw) as CacheEntry<unknown>;
      if (Date.now() > entry.expiresAt) return 0;
      return Math.round((Date.now() - entry.storedAt) / 1000);
    } catch {
      return 0;
    }
  },

  invalidate(prefix: string): void {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {}
  },
};

/** Build a deterministic cache key for a Yahoo quote */
export function quoteCacheKey(symbol: string, marketOpen: boolean): string {
  const ttl = marketOpen ? CACHE_TTL.yahoo_quote : CACHE_TTL.after_market_close;
  // Bucket by TTL so keys automatically expire without manual cleanup
  const bucket = Math.floor(Date.now() / (ttl * 1000));
  return `gk_quote_${symbol.toUpperCase()}_${bucket}`;
}

/** Build a cache key for a screener/FnO AI result */
export function screenerCacheKey(kind: string): string {
  const marketOpen = checkMarketHours();
  const ttl = marketOpen
    ? (kind === "fo" ? CACHE_TTL.fo_scan : CACHE_TTL.penny_scanner)
    : CACHE_TTL.after_market_close;
  const bucket = Math.floor(Date.now() / (ttl * 1000));
  return `gk_screener_${kind}_${bucket}`;
}

// ─── Safe JSON parser (Fix 5) ─────────────────────────────────────────────

export function safeParseJSON<T>(text: string): { success: true; data: T } | { success: false; data: null } {
  try {
    const clean = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim();
    return { success: true, data: JSON.parse(clean) as T };
  } catch {
    return { success: false, data: null };
  }
}

// ─── User-friendly error messages (Fix 5) ────────────────────────────────

export type AppErrorKind =
  | "timeout"
  | "rate_limit"
  | "not_found"
  | "parse_failed"
  | "all_ai_failed"
  | "market_closed"
  | "network"
  | "unknown";

export interface AppError {
  kind: AppErrorKind;
  message: string;
  emoji: string;
  canRetry: boolean;
  nseLink?: string;
}

export function classifyError(raw: string | undefined | null): AppError {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("abort") || s.includes("timeout") || s.includes("took too long")) {
    return { kind: "timeout", message: "Took too long to respond", emoji: "⏱", canRetry: true };
  }
  if (s.includes("429") || s.includes("rate limit") || s.includes("quota")) {
    return { kind: "rate_limit", message: "Switching to backup AI… please wait", emoji: "⏳", canRetry: true };
  }
  if (s.includes("404") || s.includes("not found") || s.includes("symbol")) {
    const msg = s.includes("discovery failed") ? raw ?? "" : "Stock not found on NSE/BSE";
    return { kind: "not_found", message: msg, emoji: "🔍", canRetry: false };
  }
  if (s.includes("parse") || s.includes("json") || s.includes("unreadable")) {
    return { kind: "parse_failed", message: "Data received but unreadable", emoji: "📊", canRetry: true };
  }
  if (s.includes("all") && (s.includes("failed") || s.includes("gemini"))) {
    return { kind: "all_ai_failed", message: "All AI providers failed — verify on NSE", emoji: "🔗", canRetry: true, nseLink: "https://www.nseindia.com" };
  }
  if (s.includes("market closed") || s.includes("closed")) {
    return { kind: "market_closed", message: "Market closed — showing last traded price", emoji: "🔴", canRetry: false };
  }
  if (s.includes("network") || s.includes("failed to fetch") || s.includes("econnrefused")) {
    return { kind: "network", message: "Network error — check your connection", emoji: "🌐", canRetry: true };
  }
  return { kind: "unknown", message: raw ?? "Something went wrong", emoji: "⚠️", canRetry: true };
}

// ─── fetchWithRetry — 8s timeout + exponential backoff (Fix 4) ───────────

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxAttempts = 3,
): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return await res.json();
      // Retryable HTTP statuses
      if ([429, 503, 502, 504].includes(res.status)) {
        throw new Error(`HTTP ${res.status}`);
      }
      // Non-retryable
      throw new Error(`HTTP ${res.status} (non-retryable)`);
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      const msg = (err as Error)?.message ?? "";
      if (msg.includes("non-retryable")) break; // don't retry 4xx
      if (attempt < maxAttempts) {
        // Exponential backoff: 500ms, 1s, 2s
        await new Promise<void>((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Fetch failed");
}
