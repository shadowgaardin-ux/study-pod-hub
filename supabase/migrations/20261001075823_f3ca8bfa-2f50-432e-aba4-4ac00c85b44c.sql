CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  item text NOT NULL,
  tier text NOT NULL,
  months int NOT NULL,
  amount int NOT NULL,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_select_own ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Users may edit their own profile, but never their plan.
CREATE OR REPLACE FUNCTION public.protect_profile_tier()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon')
     AND (NEW.tier IS DISTINCT FROM OLD.tier OR NEW.tier_expires_at IS DISTINCT FROM OLD.tier_expires_at) THEN
    NEW.tier := OLD.tier;
    NEW.tier_expires_at := OLD.tier_expires_at;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_protect_tier BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_tier();