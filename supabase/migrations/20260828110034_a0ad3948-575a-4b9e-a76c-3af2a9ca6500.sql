ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.pod_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pod_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pod_join_requests TO authenticated;
GRANT ALL ON public.pod_join_requests TO service_role;

ALTER TABLE public.pod_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters see own requests" ON public.pod_join_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Pod members see pod requests" ON public.pod_join_requests
  FOR SELECT TO authenticated USING (public.is_pod_member(pod_id, auth.uid()));
CREATE POLICY "Users create own requests" ON public.pod_join_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Requesters cancel own requests" ON public.pod_join_requests
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Pod admins update requests" ON public.pod_join_requests
  FOR UPDATE TO authenticated USING (public.is_pod_admin(pod_id, auth.uid()))
  WITH CHECK (public.is_pod_admin(pod_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;

CREATE TRIGGER update_pod_join_requests_updated_at
  BEFORE UPDATE ON public.pod_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.apply_approved_join_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    INSERT INTO public.pod_members (pod_id, user_id, role)
    VALUES (NEW.pod_id, NEW.user_id, 'member')
    ON CONFLICT (pod_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.apply_approved_join_request() FROM public, anon, authenticated;

CREATE TRIGGER apply_approved_join_request_trigger
  AFTER UPDATE ON public.pod_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.apply_approved_join_request();

CREATE OR REPLACE FUNCTION public.discover_pods(_search text DEFAULT '')
RETURNS TABLE(
  id uuid, name text, course_code text, description text,
  is_public boolean, created_at timestamptz,
  member_count bigint, request_status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.name, p.course_code, p.description, p.is_public, p.created_at,
         (SELECT count(*) FROM public.pod_members m WHERE m.pod_id = p.id) AS member_count,
         (SELECT r.status FROM public.pod_join_requests r
           WHERE r.pod_id = p.id AND r.user_id = auth.uid()) AS request_status
  FROM public.pods p
  WHERE auth.uid() IS NOT NULL
    AND p.is_public
    AND NOT public.is_pod_member(p.id, auth.uid())
    AND (
      coalesce(trim(_search), '') = ''
      OR p.name ILIKE '%' || trim(_search) || '%'
      OR coalesce(p.course_code, '') ILIKE '%' || trim(_search) || '%'
    )
  ORDER BY p.created_at DESC
  LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.discover_pods(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.discover_pods(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_pod_access(_pod_id uuid, _message text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pods WHERE id = _pod_id AND is_public) THEN
    RAISE EXCEPTION 'Pod not found';
  END IF;
  IF public.is_pod_member(_pod_id, auth.uid()) THEN RETURN 'member'; END IF;
  INSERT INTO public.pod_join_requests (pod_id, user_id, message)
  VALUES (_pod_id, auth.uid(), nullif(trim(coalesce(_message, '')), ''))
  ON CONFLICT (pod_id, user_id) DO NOTHING;
  RETURN 'pending';
END; $$;
REVOKE ALL ON FUNCTION public.request_pod_access(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_pod_access(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.raw_user_meta_data->>'tier' IN ('Free','Pro','Max')
         THEN NEW.raw_user_meta_data->>'tier' ELSE 'Free' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;