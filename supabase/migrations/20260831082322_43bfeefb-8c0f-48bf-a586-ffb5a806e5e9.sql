-- Personal library: notes and flashcards can exist without a pod
ALTER TABLE public.notes ALTER COLUMN pod_id DROP NOT NULL;
ALTER TABLE public.flashcards ALTER COLUMN pod_id DROP NOT NULL;

-- Pod guidelines + optional course code
ALTER TABLE public.pods ADD COLUMN IF NOT EXISTS rules text;
ALTER TABLE public.pods ALTER COLUMN course_code SET DEFAULT '';

CREATE POLICY notes_owner_all ON public.notes
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY cards_owner_all ON public.flashcards
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Personal audio lives under a folder named after the user's id
CREATE POLICY personal_audio_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pod-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY personal_audio_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pod-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY personal_audio_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pod-audio' AND (storage.foldername(name))[1] = auth.uid()::text);
