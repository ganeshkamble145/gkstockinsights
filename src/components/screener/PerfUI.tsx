/**
 * Perf UI components (Fix 3, Fix 5, Fix 6)
 *
 * SkeletonCard        — animated placeholder (Fix 3)
 * ErrorCard           — friendly error with retry button (Fix 5)
 * PerformanceFooter   — load stats: "20 stocks in 2.1s | 14 from cache" (Fix 6)
 * MarketClosedBanner  — grey banner when market is closed (Fix 6)
 */

import { cn } from "@/lib/utils";
import { classifyError, type AppError } from "@/lib/perf-utils";
import type { QuoteStats } from "@/hooks/use-live-quotes";

// ─── Skeleton card (Fix 3) ────────────────────────────────────────────────

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl border border-border bg-card p-5 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-8 bg-muted rounded-full" />
          <div className="space-y-1">
            <div className="h-4 bg-muted rounded w-20" />
            <div className="h-3 bg-muted rounded w-32" />
          </div>
        </div>
        <div className="h-6 w-12 bg-muted rounded-full" />
      </div>
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="h-6 bg-muted rounded w-24" />
          <div className="h-3 bg-muted rounded w-16" />
        </div>
        <div className="h-6 w-20 bg-muted rounded-full" />
      </div>
      <div className="h-1.5 bg-muted rounded-full" />
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg bg-muted py-4" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 10 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="h-10 bg-secondary border-b border-border" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 h-12 border-b border-border last:border-0 animate-pulse">
          <div className="h-4 w-8 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="ml-auto h-4 w-16 bg-muted rounded" />
          <div className="h-4 w-12 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Error card with retry (Fix 5) ────────────────────────────────────────

interface ErrorCardProps {
  rawError: string | null | undefined;
  onRetry?: () => void;
  symbol?: string;
  compact?: boolean;
}

export function ErrorCard({ rawError, onRetry, symbol, compact = false }: ErrorCardProps) {
  const err: AppError = classifyError(rawError);

  if (compact) {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs flex items-center gap-2">
        <span>{err.emoji}</span>
        <span className="text-amber-700 dark:text-amber-300">{err.message}</span>
        {err.nseLink && (
          <a href={err.nseLink} target="_blank" rel="noopener noreferrer"
             className="underline text-blue-600 dark:text-blue-400 shrink-0">
            NSE ↗
          </a>
        )}
        {err.canRetry && onRetry && (
          <button onClick={onRetry}
            className="ml-auto shrink-0 px-2 py-0.5 rounded border border-amber-500/30 hover:border-amber-500/60 transition-colors">
            Retry ↻
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-r-border bg-r-fill px-5 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{err.emoji}</span>
        <div>
          <p className="text-sm font-medium text-r-text">
            {symbol ? `${symbol}: ` : ""}{err.message}
          </p>
          {err.nseLink && (
            <a href={err.nseLink} target="_blank" rel="noopener noreferrer"
               className="text-xs text-blue-600 dark:text-blue-400 underline mt-1 inline-block">
              Verify on NSE ↗
            </a>
          )}
        </div>
      </div>
      {err.canRetry && onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-3 py-1.5 rounded-full border border-r-border hover:bg-r-fill/80 transition-colors"
        >
          Retry ↻
        </button>
      )}
    </div>
  );
}

/** Inline tiny error pill for table rows (Fix 5) */
export function ErrorPill({ rawError, onRetry }: { rawError: string; onRetry?: () => void }) {
  const err = classifyError(rawError);
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
      {err.emoji} {err.message}
      {err.canRetry && onRetry && (
        <button onClick={onRetry} className="underline cursor-pointer">Retry</button>
      )}
    </span>
  );
}

// ─── Performance footer (Fix 6 / visual) ─────────────────────────────────

interface PerformanceFooterProps {
  stats: QuoteStats | null;
  fromCache?: boolean;
  label?: string;
}

export function PerformanceFooter({ stats, fromCache, label }: PerformanceFooterProps) {
  if (!stats && !fromCache) return null;

  const parts: string[] = [];
  if (stats) {
    parts.push(`${stats.total} stocks loaded in ${(stats.loadedMs / 1000).toFixed(1)}s`);
    if (stats.fromCache > 0) parts.push(`${stats.fromCache} from cache`);
    if (stats.fresh > 0) parts.push(`${stats.fresh} fresh`);
  }
  if (fromCache) parts.push("AI picks from cache");
  if (label) parts.push(label);

  if (parts.length === 0) return null;

  return (
    <div className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
      <span className="text-emerald-500">⚡</span>
      <span>{parts.join("  |  ")}</span>
    </div>
  );
}

// ─── Market-closed banner (Fix 6) ────────────────────────────────────────

interface MarketClosedBannerProps {
  lastUpdated: Date | null;
  marketStatus: string;
}

export function MarketClosedBanner({ lastUpdated, marketStatus }: MarketClosedBannerProps) {
  if (marketStatus === "open" || marketStatus === "preopen") return null;

  const now = new Date();
  const isToday = lastUpdated && 
    lastUpdated.getDate() === now.getDate() && 
    lastUpdated.getMonth() === now.getMonth() && 
    lastUpdated.getFullYear() === now.getFullYear();

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleString("en-IN", { 
        timeZone: "Asia/Kolkata", 
        hour: "2-digit", 
        minute: "2-digit",
        day: isToday ? undefined : "2-digit",
        month: isToday ? undefined : "short"
      })
    : null;

  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-3 py-1.5 rounded-full border border-border bg-secondary/50 w-fit">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground inline-block" />
      Market Closed{timeStr ? ` — LTP as of ${timeStr} IST` : ""}
      <span className="text-[9px] opacity-60">· No live polling</span>
    </div>
  );
}

// ─── Load progress (Fix 3) ────────────────────────────────────────────────

export function LoadProgress({ loaded, total }: { loaded: number; total: number }) {
  if (loaded >= total) return null;
  return (
    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
      <div className="h-1 flex-1 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-foreground/30 rounded-full transition-all duration-300"
          style={{ width: `${(loaded / total) * 100}%` }}
        />
      </div>
      Loading: {loaded} / {total} stocks…
    </div>
  );
}
