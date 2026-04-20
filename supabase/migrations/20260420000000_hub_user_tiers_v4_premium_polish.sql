-- V4 Fase 5 Premium Polish — trial + plan + cancel_at_period_end columns
-- Enables trial 14d flow + billing status surfacing in HubUpgrade
-- Applied: 2026-04-20

ALTER TABLE public.hub_user_tiers
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.hub_user_tiers.trial_started_at IS
  'When the 14-day Pro trial started. Null if never trialed.';

COMMENT ON COLUMN public.hub_user_tiers.trial_ends_at IS
  'When the 14-day Pro trial expires. Tier auto-flips to free if not converted.';

COMMENT ON COLUMN public.hub_user_tiers.plan IS
  'monthly | yearly — which price_id the user subscribed to. Used by UI only.';

COMMENT ON COLUMN public.hub_user_tiers.cancel_at_period_end IS
  'True if user requested cancellation via Customer Portal but subscription still active until current_period_end.';

CREATE INDEX IF NOT EXISTS idx_hub_user_tiers_trial_ends_at
  ON public.hub_user_tiers (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;
