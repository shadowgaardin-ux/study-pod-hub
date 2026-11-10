-- Preserve all existing rows; tighten future access and mutations.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.pods, public.pod_members, public.notes, public.flashcards, public.flashcard_reviews, public.pod_join_requests, public.pod_discussions, public.chat_reactions TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated;

DROP POLICY IF EXISTS members_insert_self ON public.pod_members;
-- Membership is created only by the existing invite/approval/creator functions.
DROP POLICY IF EXISTS "Users create own requests" ON public.pod_join_requests;
CREATE POLICY requests_insert_pending_public ON public.pod_join_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending' AND EXISTS (SELECT 1 FROM public.discover_pods('') p WHERE p.id = pod_id));

CREATE OR REPLACE FUNCTION public.guard_security_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Record identity cannot be changed'; END IF;
    IF TG_TABLE_NAME = 'pod_members' AND (NEW.pod_id IS DISTINCT FROM OLD.pod_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.joined_at IS DISTINCT FROM OLD.joined_at) THEN RAISE EXCEPTION 'Membership identity cannot be changed'; END IF;
    IF TG_TABLE_NAME = 'pod_join_requests' AND (NEW.pod_id IS DISTINCT FROM OLD.pod_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN RAISE EXCEPTION 'Request identity cannot be changed'; END IF;
    IF TG_TABLE_NAME IN ('pods','notes','flashcards') AND (NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN RAISE EXCEPTION 'Ownership cannot be changed'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER security_members_identity BEFORE UPDATE ON public.pod_members FOR EACH ROW EXECUTE FUNCTION public.guard_security_identity();
CREATE TRIGGER security_requests_identity BEFORE UPDATE ON public.pod_join_requests FOR EACH ROW EXECUTE FUNCTION public.guard_security_identity();
CREATE TRIGGER security_pods_identity BEFORE UPDATE ON public.pods FOR EACH ROW EXECUTE FUNCTION public.guard_security_identity();
CREATE TRIGGER security_notes_identity BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.guard_security_identity();
CREATE TRIGGER security_cards_identity BEFORE UPDATE ON public.flashcards FOR EACH ROW EXECUTE FUNCTION public.guard_security_identity();

CREATE OR REPLACE FUNCTION public.protect_profile_tier() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.tier := 'Free'; NEW.tier_expires_at := NULL;
    ELSE
      IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Profile identity cannot be changed'; END IF;
      NEW.tier := OLD.tier; NEW.tier_expires_at := OLD.tier_expires_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_protect_insert BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_tier();

DROP POLICY IF EXISTS notes_owner_all ON public.notes;
DROP POLICY IF EXISTS notes_insert_members ON public.notes;
DROP POLICY IF EXISTS notes_update_owner_admin ON public.notes;
DROP POLICY IF EXISTS notes_delete_owner_admin ON public.notes;
CREATE POLICY notes_private_select ON public.notes FOR SELECT TO authenticated USING (pod_id IS NULL AND created_by = auth.uid());
CREATE POLICY notes_author_insert ON public.notes FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND (pod_id IS NULL OR public.is_pod_member(pod_id,auth.uid())));
CREATE POLICY notes_author_admin_update ON public.notes FOR UPDATE TO authenticated USING ((pod_id IS NULL AND created_by=auth.uid()) OR (public.is_pod_member(pod_id,auth.uid()) AND (created_by=auth.uid() OR public.is_pod_admin(pod_id,auth.uid())))) WITH CHECK ((pod_id IS NULL AND created_by=auth.uid()) OR (public.is_pod_member(pod_id,auth.uid()) AND (created_by=auth.uid() OR public.is_pod_admin(pod_id,auth.uid()))));
CREATE POLICY notes_author_admin_delete ON public.notes FOR DELETE TO authenticated USING ((pod_id IS NULL AND created_by=auth.uid()) OR (public.is_pod_member(pod_id,auth.uid()) AND (created_by=auth.uid() OR public.is_pod_admin(pod_id,auth.uid()))));
DROP POLICY IF EXISTS cards_owner_all ON public.flashcards;
DROP POLICY IF EXISTS cards_insert_members ON public.flashcards;
DROP POLICY IF EXISTS cards_update_owner_admin ON public.flashcards;
DROP POLICY IF EXISTS cards_delete_owner_admin ON public.flashcards;
CREATE POLICY cards_private_select ON public.flashcards FOR SELECT TO authenticated USING (pod_id IS NULL AND created_by=auth.uid());
CREATE POLICY cards_author_insert ON public.flashcards FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND (pod_id IS NULL OR public.is_pod_member(pod_id,auth.uid())));
CREATE POLICY cards_author_admin_update ON public.flashcards FOR UPDATE TO authenticated USING ((pod_id IS NULL AND created_by=auth.uid()) OR (public.is_pod_member(pod_id,auth.uid()) AND (created_by=auth.uid() OR public.is_pod_admin(pod_id,auth.uid())))) WITH CHECK ((pod_id IS NULL AND created_by=auth.uid()) OR (public.is_pod_member(pod_id,auth.uid()) AND (created_by=auth.uid() OR public.is_pod_admin(pod_id,auth.uid()))));
CREATE POLICY cards_author_admin_delete ON public.flashcards FOR DELETE TO authenticated USING ((pod_id IS NULL AND created_by=auth.uid()) OR (public.is_pod_member(pod_id,auth.uid()) AND (created_by=auth.uid() OR public.is_pod_admin(pod_id,auth.uid()))));

CREATE OR REPLACE FUNCTION public.guard_content_scope() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.pod_id IS DISTINCT FROM OLD.pod_id THEN
    IF OLD.pod_id IS NOT NULL OR NEW.created_by IS DISTINCT FROM auth.uid() OR (NEW.pod_id IS NOT NULL AND NOT public.is_pod_member(NEW.pod_id,auth.uid())) THEN RAISE EXCEPTION 'Content cannot be moved to this pod'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notes_scope BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.guard_content_scope();
CREATE TRIGGER cards_scope BEFORE UPDATE ON public.flashcards FOR EACH ROW EXECUTE FUNCTION public.guard_content_scope();

CREATE OR REPLACE FUNCTION public.can_read_note_file(_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.notes n WHERE n.audio_url=_path AND ((n.pod_id IS NULL AND n.created_by=auth.uid()) OR public.is_pod_member(n.pod_id,auth.uid())));
$$;
REVOKE ALL ON FUNCTION public.can_read_note_file(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_note_file(text) TO authenticated,service_role;
DROP POLICY IF EXISTS pod_audio_delete ON storage.objects;
DROP POLICY IF EXISTS pod_audio_insert ON storage.objects;
CREATE POLICY pod_audio_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='pod-audio' AND (storage.foldername(name))[2]=auth.uid()::text AND public.is_pod_member(((storage.foldername(name))[1])::uuid,auth.uid()));
CREATE POLICY pod_audio_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='pod-audio' AND public.is_pod_member(((storage.foldername(name))[1])::uuid,auth.uid()) AND (owner_id=auth.uid()::text OR public.is_pod_admin(((storage.foldername(name))[1])::uuid,auth.uid())));
CREATE POLICY shared_note_audio_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='pod-audio' AND public.can_read_note_file(name));

CREATE OR REPLACE FUNCTION public.guard_note_file() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NEW.audio_url IS NOT NULL AND (TG_OP='INSERT' OR NEW.audio_url IS DISTINCT FROM OLD.audio_url) THEN
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='pod-audio' AND o.name=NEW.audio_url AND o.owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'Recording must belong to the author'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notes_file_owner BEFORE INSERT OR UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.guard_note_file();

CREATE OR REPLACE FUNCTION public.guard_chat_insert() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL OR NEW.edited_at IS NOT NULL OR NEW.pinned_at IS NOT NULL OR NEW.pinned_by IS NOT NULL THEN RAISE EXCEPTION 'New messages cannot carry moderation state'; END IF;
 IF NEW.reply_to_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pod_discussions d WHERE d.id=NEW.reply_to_id AND d.pod_id=NEW.pod_id AND d.deleted_at IS NULL) THEN RAISE EXCEPTION 'Reply must belong to this pod'; END IF;
 IF NEW.attachment_path IS NOT NULL AND (split_part(NEW.attachment_path,'/',1)<>NEW.pod_id::text OR split_part(NEW.attachment_path,'/',2)<>auth.uid()::text OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='pod-chat' AND o.name=NEW.attachment_path AND o.owner_id=auth.uid()::text)) THEN RAISE EXCEPTION 'Attachment must belong to this message author and pod'; END IF;
 IF NEW.kind NOT IN ('text','image','file','voice','audio') THEN RAISE EXCEPTION 'Unsupported message kind'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER chat_insert_security BEFORE INSERT ON public.pod_discussions FOR EACH ROW EXECUTE FUNCTION public.guard_chat_insert();
CREATE OR REPLACE FUNCTION public.guard_chat_metadata() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.attachment_name IS DISTINCT FROM OLD.attachment_name OR NEW.attachment_type IS DISTINCT FROM OLD.attachment_type OR NEW.attachment_size IS DISTINCT FROM OLD.attachment_size OR NEW.duration_ms IS DISTINCT FROM OLD.duration_ms THEN RAISE EXCEPTION 'Message metadata cannot be changed'; END IF;
 IF NEW.pinned_by IS DISTINCT FROM OLD.pinned_by AND NOT public.is_pod_admin(OLD.pod_id,auth.uid()) THEN RAISE EXCEPTION 'Only admins can pin messages'; END IF;
 IF NEW.pinned_at IS NOT NULL THEN NEW.pinned_by:=auth.uid(); ELSE NEW.pinned_by:=NULL; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER chat_metadata_security BEFORE UPDATE ON public.pod_discussions FOR EACH ROW EXECUTE FUNCTION public.guard_chat_metadata();
DROP POLICY IF EXISTS reviews_own ON public.flashcard_reviews;
CREATE POLICY reviews_own ON public.flashcard_reviews FOR ALL TO authenticated USING (user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id=card_id)) WITH CHECK (user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id=card_id));

-- Enforce saved-recording counts at the database boundary, including direct API writes.
CREATE OR REPLACE FUNCTION public.enforce_recording_quota() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE plan text; cap integer; used integer;
BEGIN
 IF NEW.audio_url IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.audio_url IS NOT NULL THEN RETURN NEW; END IF;
 SELECT CASE WHEN tier_expires_at IS NULL OR tier_expires_at<=now() THEN 'Free' ELSE tier END INTO plan FROM public.profiles WHERE id=NEW.created_by FOR UPDATE;
 cap:=CASE plan WHEN 'Pro' THEN 200 WHEN 'Max' THEN NULL ELSE 20 END;
 IF cap IS NULL THEN RETURN NEW; END IF;
 SELECT count(*) INTO used FROM public.notes WHERE created_by=NEW.created_by AND audio_url IS NOT NULL;
 IF used>=cap THEN RAISE EXCEPTION 'Saved recording limit reached. Delete a recording or upgrade.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notes_recording_quota BEFORE INSERT OR UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.enforce_recording_quota();

REVOKE EXECUTE ON FUNCTION public.guard_security_identity(),public.guard_content_scope(),public.guard_note_file(),public.guard_chat_insert(),public.guard_chat_metadata(),public.enforce_recording_quota(),public.protect_profile_tier(),public.guard_chat_update() FROM PUBLIC,anon,authenticated;
