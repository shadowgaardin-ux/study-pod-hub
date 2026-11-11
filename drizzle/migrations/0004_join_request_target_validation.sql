CREATE OR REPLACE FUNCTION public.can_request_pod(_pod_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.pods WHERE id=_pod_id AND is_public) AND NOT public.is_pod_member(_pod_id,auth.uid());
$$;
REVOKE ALL ON FUNCTION public.can_request_pod(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_request_pod(uuid) TO authenticated,service_role;
DROP POLICY IF EXISTS requests_insert_pending_public ON public.pod_join_requests;
CREATE POLICY requests_insert_pending_public ON public.pod_join_requests FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND status='pending' AND public.can_request_pod(pod_id));