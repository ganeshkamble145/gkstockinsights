import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad" | "info" | "neu";

const TONE_MAP: Record<string, Tone> = {
  // valuation
  CHEAP: "ok", FAIR: "info", EXPENSIVE: "bad",
  UNDERVALUED: "ok", "FAIRLY VALUED": "info", OVERVALUED: "bad", MIXED: "warn",
  // health
  SAFE: "ok", MODERATE: "warn", LEVERAGED: "bad",
  HEALTHY: "ok", WATCH: "warn", RISK: "bad",
  COMFORTABLE: "ok", STRONG: "ok", STABLE: "info", CONCERN: "bad",
  "MODERATE RISK": "warn",
  // returns
  GOOD: "ok", AVERAGE: "info", WEAK: "bad",
  "HIGH-QUALITY COMPOUNDER": "ok", "AVERAGE RETURNS": "info",
  "CAPITAL-LIGHT": "info", "DIVIDEND PLAY": "info",
  // growth
  ACCELERATING: "ok", STEADY: "info", SLOWING: "warn", DECLINING: "bad",
  // ownership
  BUYING: "ok", SELLING: "bad",
  INCREASING: "ok", DECREASING: "bad",
  "INSIDERS BUILDING": "ok", "HOLDING STEADY": "info", TRIMMING: "warn",
  OK: "ok", FLAG: "bad",
  // peers
  LEADING: "ok", "MID-PACK": "info", LAGGING: "bad",
  // view
  "STRONG FUNDAMENTALS": "ok", "MODERATE FUNDAMENTALS": "warn", "WEAK FUNDAMENTALS": "bad",
  // tone
  CONFIDENT: "ok", CAUTIOUS: "warn",
};

export function Badge({ label, tone: toneOverride }: { label: string; tone?: Tone }) {
  const tone = toneOverride ?? TONE_MAP[label.toUpperCase()] ?? "neu";
  const cls: Record<Tone, string> = {
    ok: "bg-g-fill text-g-text",
    warn: "bg-a-fill text-a-text",
    bad: "bg-r-fill text-r-text",
    info: "bg-b-fill text-b-text",
    neu: "bg-n-fill text-n-text",
  };
  return (
    <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium", cls[tone])}>
      {label}
    </span>
  );
}

export function Trend({ dir }: { dir: "UP" | "FLAT" | "DOWN" | string }) {
  if (dir === "UP") return <span className="text-g-accent">↑ Rising</span>;
  if (dir === "DOWN") return <span className="text-r-accent">↓ Falling</span>;
  if (dir === "FLAT") return <span className="text-muted-foreground">→ Stable</span>;
  return <span className="text-muted-foreground">{dir}</span>;
}

export function TrendIcon({ dir }: { dir: "UP" | "FLAT" | "DOWN" | string }) {
  if (dir === "UP") return <span title="Up">📈</span>;
  if (dir === "DOWN") return <span title="Down">📉</span>;
  return <span title="Flat">➡️</span>;
}
