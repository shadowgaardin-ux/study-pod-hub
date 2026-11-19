CREATE TABLE public.payment_activation_keys (key_hash text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.payment_activation_keys TO service_role;
REVOKE ALL ON public.payment_activation_keys FROM anon, authenticated;
ALTER TABLE public.payment_activation_keys ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_verified_payment_with_proof(_proof text, _reference text, _user_id uuid, _item text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _proof IS NULL OR length(_proof) < 24 OR NOT EXISTS (
    SELECT 1 FROM public.payment_activation_keys WHERE key_hash = encode(sha256(convert_to(_proof,'UTF8')),'hex')
  ) THEN RAISE EXCEPTION 'Payment activation is not authorized'; END IF;
  RETURN public.apply_verified_payment(_reference, _user_id, _item);
END $$;
REVOKE ALL ON FUNCTION public.apply_verified_payment_with_proof(text,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_verified_payment_with_proof(text,text,uuid,text) TO anon, authenticated, service_role;