ALTER TABLE public.pod_discussions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.pod_discussions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

CREATE INDEX IF NOT EXISTS pod_discussions_pod_created_idx ON public.pod_discussions (pod_id, created_at DESC);

GRANT UPDATE ON public.pod_discussions TO authenticated;

CREATE POLICY chat_update_author_or_admin ON public.pod_discussions FOR UPDATE TO authenticated
USING (public.is_pod_member(pod_id, auth.uid()) AND (user_id = auth.uid() OR public.is_pod_admin(pod_id, auth.uid())))
WITH CHECK (public.is_pod_member(pod_id, auth.uid()) AND (user_id = auth.uid() OR public.is_pod_admin(pod_id, auth.uid())));

CREATE OR REPLACE FUNCTION public.guard_chat_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.pod_id <> OLD.pod_id OR NEW.user_id <> OLD.user_id OR NEW.created_at <> OLD.created_at
     OR NEW.kind <> OLD.kind
     OR NEW.attachment_path IS DISTINCT FROM OLD.attachment_path AND NEW.deleted_at IS NULL
     OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id THEN
    RAISE EXCEPTION 'This part of a message cannot be changed';
  END IF;
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Deleted messages cannot be restored';
  END IF;
  IF OLD.user_id <> auth.uid() THEN
    -- admins (non-authors) may only pin/unpin or delete
    IF NEW.message <> OLD.message AND NEW.deleted_at IS NULL OR NEW.edited_at IS DISTINCT FROM OLD.edited_at THEN
      RAISE EXCEPTION 'Only the author can edit this message';
    END IF;
  END IF;
  IF NEW.pinned_at IS DISTINCT FROM OLD.pinned_at AND NOT public.is_pod_admin(OLD.pod_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only hub admins can pin messages';
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    NEW.message := '';
    NEW.pinned_at := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_chat_update BEFORE UPDATE ON public.pod_discussions
FOR EACH ROW EXECUTE FUNCTION public.guard_chat_update();

CREATE TABLE public.chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.pod_discussions(id) ON DELETE CASCADE,
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.chat_reactions TO authenticated;
GRANT ALL ON public.chat_reactions TO service_role;
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY reactions_select_members ON public.chat_reactions FOR SELECT TO authenticated
USING (public.is_pod_member(pod_id, auth.uid()));
CREATE POLICY reactions_insert_own ON public.chat_reactions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_pod_member(pod_id, auth.uid())
  AND EXISTS (SELECT 1 FROM public.pod_discussions d WHERE d.id = message_id AND d.pod_id = chat_reactions.pod_id));
CREATE POLICY reactions_delete_own ON public.chat_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;
ALTER TABLE public.chat_reactions REPLICA IDENTITY FULL;

CREATE POLICY pod_chat_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pod-chat' AND public.is_pod_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY pod_chat_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pod-chat' AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_pod_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY pod_chat_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pod-chat' AND ((storage.foldername(name))[2] = auth.uid()::text
  OR public.is_pod_admin(((storage.foldername(name))[1])::uuid, auth.uid())));