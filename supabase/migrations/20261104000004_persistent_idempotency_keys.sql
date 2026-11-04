-- ============================================================================
-- NuKropAI: Persistent Database-Backed Idempotency Keys Architecture
-- Enforces cross-instance, post-restart idempotency for bookings, payments,
-- and state transitions to prevent duplicate network submissions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  operation VARCHAR(100) NOT NULL,
  response_code INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON public.idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user ON public.idempotency_keys(user_id);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only read their own idempotency records
DROP POLICY IF EXISTS "idempotency_keys_user_select" ON public.idempotency_keys;
CREATE POLICY "idempotency_keys_user_select" ON public.idempotency_keys
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated users can insert their own idempotency records
DROP POLICY IF EXISTS "idempotency_keys_user_insert" ON public.idempotency_keys;
CREATE POLICY "idempotency_keys_user_insert" ON public.idempotency_keys
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role has full administrative access
DROP POLICY IF EXISTS "idempotency_keys_service_all" ON public.idempotency_keys;
CREATE POLICY "idempotency_keys_service_all" ON public.idempotency_keys
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

REVOKE ALL ON public.idempotency_keys FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.idempotency_keys TO authenticated;
GRANT ALL ON public.idempotency_keys TO service_role;
