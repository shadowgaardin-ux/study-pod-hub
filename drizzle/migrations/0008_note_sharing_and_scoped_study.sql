ALTER TABLE public.flashcards ADD COLUMN note_id uuid REFERENCES public.notes(id) ON DELETE SET NULL, ADD COLUMN semester text, ADD COLUMN course text, ADD COLUMN source_note_ids uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX flashcards_note_id_idx ON public.flashcards(note_id);
CREATE INDEX IF NOT EXISTS flashcards_owner_created_idx ON public.flashcards(created_by, created_at DESC);
CREATE TABLE public.note_shares (
 note_id uuid PRIMARY KEY REFERENCES public.notes(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,
 can_edit boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.note_shares TO authenticated;
GRANT ALL ON public.note_shares TO service_role;
ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY shares_select_own ON public.note_shares FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
CREATE POLICY shares_delete_own ON public.note_shares FOR DELETE TO authenticated USING (user_id=(select auth.uid()));
CREATE INDEX note_shares_user_id_idx ON public.note_shares(user_id);
CREATE TABLE public.practice_quizzes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 note_id uuid REFERENCES public.notes(id) ON DELETE SET NULL,
 semester text,
 course text,
 source_note_ids uuid[] NOT NULL DEFAULT '{}',
 questions jsonb NOT NULL DEFAULT '[]',
 ratings jsonb NOT NULL DEFAULT '{}',
 picks jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_quizzes TO authenticated;
GRANT ALL ON public.practice_quizzes TO service_role;
ALTER TABLE public.practice_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY quizzes_select_own ON public.practice_quizzes FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
CREATE POLICY quizzes_insert_own ON public.practice_quizzes FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()));
CREATE POLICY quizzes_update_own ON public.practice_quizzes FOR UPDATE TO authenticated USING (user_id=(select auth.uid())) WITH CHECK (user_id=(select auth.uid()));
CREATE POLICY quizzes_delete_own ON public.practice_quizzes FOR DELETE TO authenticated USING (user_id=(select auth.uid()));
CREATE INDEX practice_quizzes_owner_created_idx ON public.practice_quizzes(user_id,created_at DESC);
CREATE INDEX practice_quizzes_note_id_idx ON public.practice_quizzes(note_id);
CREATE OR REPLACE FUNCTION public.create_note_share(_note_id uuid, _token text, _can_edit boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.notes WHERE id=_note_id AND created_by=auth.uid()) THEN RAISE EXCEPTION 'Only the owner can share this note'; END IF;
 IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$' OR _can_edit IS NULL THEN RAISE EXCEPTION 'Invalid share settings'; END IF;
 INSERT INTO public.note_shares(note_id,user_id,token_hash,can_edit) VALUES (_note_id,auth.uid(),encode(sha256(convert_to(_token,'UTF8')),'hex'),_can_edit)
 ON CONFLICT(note_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,can_edit=EXCLUDED.can_edit,created_at=now();
END; $$;
REVOKE ALL ON FUNCTION public.create_note_share(uuid,text,boolean) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.create_note_share(uuid,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.read_shared_note(_token text)
RETURNS TABLE(title text, transcript text, summary text, semester text, course text, created_at timestamptz, can_edit boolean, version text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT n.title,n.transcript,n.summary,n.semester,n.course,n.created_at,s.can_edit,md5(jsonb_build_array(n.title,n.transcript,n.summary)::text)
 FROM public.note_shares s JOIN public.notes n ON n.id=s.note_id
 WHERE _token ~ '^[a-f0-9]{64}$' AND s.token_hash=encode(sha256(convert_to(_token,'UTF8')),'hex') LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.read_shared_note(text) FROM public;
GRANT EXECUTE ON FUNCTION public.read_shared_note(text) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.edit_shared_note(_token text,_title text,_transcript text,_summary text,_version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE shared public.note_shares; original public.notes;
BEGIN
 IF _token IS NULL OR _token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'This link is unavailable'; END IF;
 SELECT * INTO shared FROM public.note_shares WHERE token_hash=encode(sha256(convert_to(_token,'UTF8')),'hex') FOR UPDATE;
 IF NOT FOUND OR NOT shared.can_edit THEN RAISE EXCEPTION 'This link does not allow editing'; END IF;
 IF _title IS NULL OR length(trim(_title)) NOT BETWEEN 1 AND 200 OR coalesce(length(_transcript),0)>200000 OR coalesce(length(_summary),0)>60000 THEN RAISE EXCEPTION 'Invalid note content'; END IF;
 SELECT * INTO original FROM public.notes WHERE id=shared.note_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This link is unavailable'; END IF;
 IF _version IS NULL OR md5(jsonb_build_array(original.title,original.transcript,original.summary)::text)<>_version THEN RAISE EXCEPTION 'This note changed. Reload before saving.'; END IF;
 UPDATE public.notes SET title=trim(_title),transcript=_transcript,summary=_summary WHERE id=shared.note_id;
END; $$;
REVOKE ALL ON FUNCTION public.edit_shared_note(text,text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.edit_shared_note(text,text,text,text,text) TO anon,authenticated,service_role;