CREATE OR REPLACE FUNCTION public.guard_security_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Record identity cannot be changed';
    END IF;
    IF TG_TABLE_NAME = 'pod_members' THEN
      IF NEW.pod_id IS DISTINCT FROM OLD.pod_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
        RAISE EXCEPTION 'Membership identity cannot be changed';
      END IF;
    ELSIF TG_TABLE_NAME = 'pod_join_requests' THEN
      IF NEW.pod_id IS DISTINCT FROM OLD.pod_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Request identity cannot be changed';
      END IF;
    ELSIF TG_TABLE_NAME IN ('pods', 'notes', 'flashcards') THEN
      IF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Ownership cannot be changed';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;