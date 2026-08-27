-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  tier text NOT NULL DEFAULT 'Free' CHECK (tier IN ('Free','Pro','Max')),
  tier_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PODS
CREATE TABLE public.pods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  course_code text NOT NULL DEFAULT '',
  invite_code text UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pod_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pod_id, user_id)
);

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  audio_url text,
  transcript text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  deck_name text NOT NULL,
  front text NOT NULL,
  back text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pod_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.pod_members (user_id);
CREATE INDEX ON public.notes (pod_id);
CREATE INDEX ON public.flashcards (pod_id);
CREATE INDEX ON public.pod_discussions (pod_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pod_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pod_discussions TO authenticated;
GRANT ALL ON public.pods, public.pod_members, public.notes, public.flashcards, public.pod_discussions TO service_role;

CREATE OR REPLACE FUNCTION public.is_pod_member(_pod_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pod_members WHERE pod_id = _pod_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_pod_admin(_pod_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pod_members WHERE pod_id = _pod_id AND user_id = _user_id AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
BEGIN
  IF NEW.invite_code IS NOT NULL AND NEW.invite_code <> '' THEN
    RETURN NEW;
  END IF;
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.pods WHERE invite_code = candidate);
  END LOOP;
  NEW.invite_code := candidate;
  RETURN NEW;
END; $$;
CREATE TRIGGER pods_set_invite_code BEFORE INSERT ON public.pods
FOR EACH ROW EXECUTE FUNCTION public.generate_invite_code();

CREATE OR REPLACE FUNCTION public.add_pod_creator_as_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.pod_members (pod_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT (pod_id, user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER pods_add_creator AFTER INSERT ON public.pods
FOR EACH ROW EXECUTE FUNCTION public.add_pod_creator_as_admin();

CREATE OR REPLACE FUNCTION public.join_pod_by_code(_invite_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pod_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _pod_id FROM public.pods WHERE upper(invite_code) = upper(trim(_invite_code));
  IF _pod_id IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  INSERT INTO public.pod_members (pod_id, user_id, role)
  VALUES (_pod_id, auth.uid(), 'member')
  ON CONFLICT (pod_id, user_id) DO NOTHING;
  RETURN _pod_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.join_pod_by_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pod_member_profiles(_pod_id uuid)
RETURNS TABLE (user_id uuid, full_name text, avatar_url text, role text, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, p.full_name, p.avatar_url, m.role, m.joined_at
  FROM public.pod_members m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.pod_id = _pod_id AND public.is_pod_member(_pod_id, auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.pod_member_profiles(uuid) TO authenticated;

ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pods_select_members" ON public.pods FOR SELECT TO authenticated USING (public.is_pod_member(id, auth.uid()));
CREATE POLICY "pods_insert_auth" ON public.pods FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "pods_update_admin" ON public.pods FOR UPDATE TO authenticated USING (public.is_pod_admin(id, auth.uid())) WITH CHECK (public.is_pod_admin(id, auth.uid()));
CREATE POLICY "pods_delete_admin" ON public.pods FOR DELETE TO authenticated USING (public.is_pod_admin(id, auth.uid()));

ALTER TABLE public.pod_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_select" ON public.pod_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_pod_member(pod_id, auth.uid()));
CREATE POLICY "members_insert_self" ON public.pod_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "members_update_admin" ON public.pod_members FOR UPDATE TO authenticated USING (public.is_pod_admin(pod_id, auth.uid())) WITH CHECK (public.is_pod_admin(pod_id, auth.uid()));
CREATE POLICY "members_delete_admin_or_self" ON public.pod_members FOR DELETE TO authenticated USING (public.is_pod_admin(pod_id, auth.uid()) OR user_id = auth.uid());

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_select_members" ON public.notes FOR SELECT TO authenticated USING (public.is_pod_member(pod_id, auth.uid()));
CREATE POLICY "notes_insert_members" ON public.notes FOR INSERT TO authenticated WITH CHECK (public.is_pod_member(pod_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "notes_update_owner_admin" ON public.notes FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_pod_admin(pod_id, auth.uid())) WITH CHECK (created_by = auth.uid() OR public.is_pod_admin(pod_id, auth.uid()));
CREATE POLICY "notes_delete_owner_admin" ON public.notes FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_pod_admin(pod_id, auth.uid()));

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards_select_members" ON public.flashcards FOR SELECT TO authenticated USING (public.is_pod_member(pod_id, auth.uid()));
CREATE POLICY "cards_insert_members" ON public.flashcards FOR INSERT TO authenticated WITH CHECK (public.is_pod_member(pod_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "cards_update_owner_admin" ON public.flashcards FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_pod_admin(pod_id, auth.uid())) WITH CHECK (created_by = auth.uid() OR public.is_pod_admin(pod_id, auth.uid()));
CREATE POLICY "cards_delete_owner_admin" ON public.flashcards FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_pod_admin(pod_id, auth.uid()));

ALTER TABLE public.pod_discussions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_select_members" ON public.pod_discussions FOR SELECT TO authenticated USING (public.is_pod_member(pod_id, auth.uid()));
CREATE POLICY "chat_insert_members" ON public.pod_discussions FOR INSERT TO authenticated WITH CHECK (public.is_pod_member(pod_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "chat_delete_own" ON public.pod_discussions FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.pod_discussions;
ALTER TABLE public.pod_discussions REPLICA IDENTITY FULL;

CREATE POLICY "pod_audio_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pod-audio' AND public.is_pod_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "pod_audio_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pod-audio' AND public.is_pod_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "pod_audio_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pod-audio' AND public.is_pod_member(((storage.foldername(name))[1])::uuid, auth.uid()));