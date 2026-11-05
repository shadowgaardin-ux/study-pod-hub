CREATE OR REPLACE FUNCTION public.pod_join_request_profiles(_pod_id uuid)
RETURNS TABLE(id uuid, user_id uuid, full_name text, avatar_url text, message text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.user_id, p.full_name, p.avatar_url, r.message, r.created_at
  FROM public.pod_join_requests r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.pod_id = _pod_id AND r.status = 'pending'
    AND public.is_pod_admin(_pod_id, auth.uid())
  ORDER BY r.created_at;
$$;
REVOKE ALL ON FUNCTION public.pod_join_request_profiles(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pod_join_request_profiles(uuid) TO authenticated;