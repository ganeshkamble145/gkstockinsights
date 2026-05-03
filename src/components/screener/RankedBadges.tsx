import { cn } from "@/lib/utils";
import { rankBadge, recommendationFor } from "@/lib/scoring";

export function RankBadgeChip({ rank }: { rank: number }) {
  const label = rankBadge(rank);
  const isMedal = rank <= 3;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[2.25rem] h-7 px-2 rounded-full text-xs font-semibold",
        isMedal ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-secondary text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : score >= 60
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : score >= 40
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : score >= 20
            ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
            : "bg-red-500/15 text-red-700 dark:text-red-300";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums", tone)}>
      {score}/100
    </span>
  );
}

export function RecommendationBadge({ score, compact = false }: { score: number; compact?: boolean }) {
  const rec = recommendationFor(score);
  const tone =
    rec.tone === "strong-buy"
      ? "bg-emerald-600 text-white"
      : rec.tone === "buy"
        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
        : rec.tone === "hold"
          ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
          : rec.tone === "avoid"
            ? "bg-orange-500/20 text-orange-800 dark:text-orange-300"
            : "bg-red-500/20 text-red-700 dark:text-red-300";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap", tone)}>
      <span>{rec.emoji}</span>
      {!compact && <span>{rec.label}</span>}
    </span>
  );
}
