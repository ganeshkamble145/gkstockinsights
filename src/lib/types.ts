export type Signal = "CHEAP" | "FAIR" | "EXPENSIVE" | "SAFE" | "MODERATE" | "LEVERAGED" | "HEALTHY" | "WATCH" | "RISK" | "COMFORTABLE" | "STRONG" | "STABLE" | "CONCERN" | "GOOD" | "AVERAGE" | "WEAK" | "BUYING" | "SELLING" | "INCREASING" | "DECREASING" | "OK" | "FLAG";

export interface MetricRow {
  current: string;
  sectorAvg: string;
  fiveYAvg: string;
  signal: string;
  plain: string;
}

export interface GrowthRow {
  metric: string;
  cagr3y: string;
  cagr5y: string;
  trend: "UP" | "FLAT" | "DOWN";
  source: string;
}

export interface EpsQuarter {
  quarter: string;
  value: string;
  yoy: string;
}

export interface HealthRow {
  metric: string;
  value: string;
  trend: "UP" | "FLAT" | "DOWN";
  signal: string;
  plain: string;
}

export interface ScenarioRow {
  name: "Bear" | "Base" | "Bull";
  assumption: string;
  revenue: string;
  netProfit: string;
  eps: string;
}

export interface ReturnRow {
  metric: string;
  current: string;
  avg3y: string;
  avg5y: string;
  signal: string;
}

export interface PeerRow {
  company: string;
  isYou: boolean;
  pe: string;
  pb: string;
  roe: string;
  revGrowth: string;
  de: string;
  edge: string;
}

export interface NewsItem {
  headline: string;
  why: string;
  date: string;
  source: string;
}

export interface OwnershipRow {
  holder: string;
  latest: string;
  trend: string;
  signal: string;
  meaning: string;
}

export interface CallNote {
  said: string;
  means: string;
}

export interface StockReport {
  // Snapshot
  company: string;
  ticker: string;
  sector: string;
  industry: string;
  whatItDoes: string;
  whatMakesItDifferent: string;
  cmp: string;
  cmpTime: string;
  high52w: string;
  low52w: string;
  marketCap: string;
  faceValue: string;
  flags: { title: string; note: string }[];

  // Valuation
  valuation: MetricRow[];
  valuationOverall: string;
  valuationSummary: string;

  // Growth
  growth: GrowthRow[];
  eps8q: EpsQuarter[];
  growthClassification: string;
  growthSummary: string;

  // Health
  health: HealthRow[];
  scenarios: ScenarioRow[];
  horizonYears: number;
  healthOverall: string;
  healthSummary: string;

  // Returns
  returns: ReturnRow[];
  returnQuality: string;
  returnSummary: string;

  // Peers
  peers: PeerRow[];
  news: NewsItem[];
  peerStanding: string;
  peerSummary: string;

  // Ownership
  ownership: OwnershipRow[];
  earningsCallQuarter: string;
  callNotes: CallNote[];
  managementTone: string;
  ownershipSignal: string;
  ownershipSummary: string;

  // View
  fundamentalQuality: "STRONG FUNDAMENTALS" | "MODERATE FUNDAMENTALS" | "WEAK FUNDAMENTALS";
  viewSummary: string;
  strengths: string[];
  watchPoints: string[];
  trackForward: string;
  opportunities: string[];
  risks: string[];

  // AI Recommendation
  recommendation: "BUY" | "HOLD" | "SELL" | "ACCUMULATE" | "REDUCE";
  recommendationConfidence: "HIGH" | "MEDIUM" | "LOW";
  recommendationRationale: string;
  suitableFor: string;

  // F&O strategy
  foStrategyName: string;
  foBias: "BULLISH" | "NEUTRAL" | "BEARISH";
  foRationale: string;
  foLegs: { action: string; instrument: string; note: string }[];
  foMaxProfit: string;
  foMaxLoss: string;
  foBreakeven: string;
  foRiskLevel: "LOW" | "MEDIUM" | "HIGH";
  foNotes: string[];

  // Confidence
  confidence: "HIGH" | "MODERATE" | "LOW" | "VERY LOW";
  liveCount: number;
  totalSections: number;
  sources: string[];

  dataNotice?: string;
}
