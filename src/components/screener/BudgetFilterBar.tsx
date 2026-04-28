// BudgetFilterBar — shown at the top of all stock tabs.
// Clicking a budget tier hides/fades cards exceeding that amount.
// Default = value from user_preferences.max_investment.

import { cn } from "@/lib/utils";

const BUDGETS = [
  { label: "₹10K",    value: 10000 },
  { label: "₹25K",    value: 25000 },
  { label: "₹50K",    value: 50000 },
  { label: "₹1L",     value: 100000 },
  { label: "₹2L",     value: 200000 },
  { label: "₹3L",     value: 300000 },
  { label: "No limit",value: Infinity },
];

interface BudgetFilterBarProps {
  selected: number;
  onChange: (v: number) => void;
}

export function BudgetFilterBar({ selected, onChange }: BudgetFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-5">
      <span className="text-[11px] text-muted-foreground mr-1 shrink-0">Budget:</span>
      {BUDGETS.map((b) => (
        <button
          key={b.label}
          onClick={() => onChange(b.value)}
          className={cn(
            "px-3 py-1 rounded-full text-xs border transition-colors",
            selected === b.value
              ? "bg-foreground text-background border-foreground font-medium"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          )}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

/** Returns whether a card with a given min_investment is within budget */
export function isWithinBudget(minInvestment: number | null | undefined, budget: number): boolean {
  if (budget === Infinity) return true;
  if (!minInvestment) return true; // unknown → assume within
  return minInvestment <= budget;
}

/** Budget chip rendered on each card */
export function BudgetChip({ minInvestment, budget }: { minInvestment: number | null | undefined; budget: number }) {
  if (budget === Infinity || !minInvestment) return null;
  const within = minInvestment <= budget;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
        within
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      )}
    >
      {within ? "✓ Within budget" : "⚠ Exceeds budget"}
    </span>
  );
}

/** Minimum investment label for equity stocks */
export function calcEquityMinInvestment(cmpNum: number | null): { shares: number; amount: number } | null {
  if (!cmpNum || cmpNum <= 0) return null;
  const shares = Math.max(1, Math.floor(500 / cmpNum));
  return { shares, amount: Math.ceil(shares * cmpNum) };
}
