-- ─────────────────────────────────────────────────────────────
-- AI Self-Improving Layer — Supabase Migration
-- ─────────────────────────────────────────────────────────────

-- 1. Recommendations: stores every AI pick with full context
CREATE TABLE IF NOT EXISTS public.recommendations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol           TEXT NOT NULL,
  tab_type         TEXT CHECK (tab_type IN ('penny','nifty100','fo')),
  recommendation   TEXT CHECK (recommendation IN ('STRONG BUY','BUY','HOLD','AVOID','SELL')),
  strategy         TEXT,
  entry_price      DECIMAL(12,2),
  target_price     DECIMAL(12,2),
  stop_loss        DECIMAL(12,2),
  composite_score  INTEGER CHECK (composite_score BETWEEN 0 AND 100),
  ai_reasoning     TEXT,
  ai_model_used    TEXT DEFAULT 'gemini-2.5-flash',
  ai_level         INTEGER DEFAULT 1,
  recommended_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
  min_investment   DECIMAL(12,2),
  expiry_date      DATE
);

CREATE INDEX IF NOT EXISTS idx_recommendations_symbol
  ON public.recommendations(symbol, recommended_at DESC);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read recommendations" ON public.recommendations FOR SELECT USING (true);
CREATE POLICY "Public insert recommendations" ON public.recommendations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update recommendations" ON public.recommendations FOR UPDATE USING (true);

-- 2. Outcomes: tracks actual price movement vs prediction
CREATE TABLE IF NOT EXISTS public.recommendation_outcomes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID REFERENCES public.recommendations(id) ON DELETE CASCADE,
  symbol            TEXT NOT NULL,
  price_at_7d       DECIMAL(12,2),
  price_at_14d      DECIMAL(12,2),
  price_at_30d      DECIMAL(12,2),
  target_hit        BOOLEAN DEFAULT false,
  stop_hit          BOOLEAN DEFAULT false,
  profit_pct        DECIMAL(8,4),
  outcome_label     TEXT CHECK (outcome_label IN ('WIN','LOSS','PARTIAL','PENDING')) DEFAULT 'PENDING',
  checked_at        TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_pending
  ON public.recommendation_outcomes(outcome_label, checked_at)
  WHERE outcome_label = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_outcomes_rec_id
  ON public.recommendation_outcomes(recommendation_id);

ALTER TABLE public.recommendation_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read outcomes" ON public.recommendation_outcomes FOR SELECT USING (true);
CREATE POLICY "Public insert outcomes" ON public.recommendation_outcomes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update outcomes" ON public.recommendation_outcomes FOR UPDATE USING (true);

-- 3. AI Learning Log: distilled insights from completed trades
CREATE TABLE IF NOT EXISTS public.ai_learning_log (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  insight          TEXT NOT NULL,
  insight_category TEXT,
  accuracy_before  DECIMAL(5,2),
  accuracy_after   DECIMAL(5,2),
  sample_size      INTEGER DEFAULT 0,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_log_created
  ON public.ai_learning_log(created_at DESC);

ALTER TABLE public.ai_learning_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read learning" ON public.ai_learning_log FOR SELECT USING (true);
CREATE POLICY "Public insert learning" ON public.ai_learning_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update learning" ON public.ai_learning_log FOR UPDATE USING (true);

-- 4. User Preferences: personalises AI recommendations
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  max_investment    DECIMAL(12,2) DEFAULT 50000,
  risk_appetite     TEXT CHECK (risk_appetite IN ('low','medium','high')) DEFAULT 'medium',
  preferred_horizon TEXT CHECK (preferred_horizon IN ('weekly','monthly','3months')) DEFAULT 'monthly',
  preferred_sectors TEXT[] DEFAULT '{}',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read preferences" ON public.user_preferences FOR SELECT USING (true);
CREATE POLICY "Public insert preferences" ON public.user_preferences FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update preferences" ON public.user_preferences FOR UPDATE USING (true);
CREATE POLICY "Public delete preferences" ON public.user_preferences FOR DELETE USING (true);

-- Insert default preferences row if none exists
INSERT INTO public.user_preferences (max_investment, risk_appetite, preferred_horizon, preferred_sectors)
SELECT 50000, 'medium', 'monthly', '{}'
WHERE NOT EXISTS (SELECT 1 FROM public.user_preferences LIMIT 1);
