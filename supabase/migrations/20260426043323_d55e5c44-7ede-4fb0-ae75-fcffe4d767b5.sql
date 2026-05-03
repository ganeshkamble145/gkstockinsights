-- Price alerts: per-browser local feature; no auth tied. We allow public CRUD
-- for now (alerts are not sensitive). RLS is enabled with permissive policies
-- so we can lock it down later if auth is added.
CREATE TABLE public.price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  target_price NUMERIC NOT NULL CHECK (target_price > 0),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('above', 'below')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  triggered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_price_alerts_symbol ON public.price_alerts (symbol);
CREATE INDEX idx_price_alerts_created_at ON public.price_alerts (created_at DESC);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Permissive policies (no auth in this app yet). Anyone can manage alerts.
CREATE POLICY "Anyone can view price alerts"
  ON public.price_alerts FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create price alerts"
  ON public.price_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update price alerts"
  ON public.price_alerts FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete price alerts"
  ON public.price_alerts FOR DELETE
  USING (true);
