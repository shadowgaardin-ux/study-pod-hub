ALTER TABLE public.notes
  ADD COLUMN semester text,
  ADD COLUMN course text;

COMMENT ON COLUMN public.notes.semester IS 'Optional student-defined semester label for organizing lectures and notes.';
COMMENT ON COLUMN public.notes.course IS 'Optional student-defined course label for organizing lectures and notes.';