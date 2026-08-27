REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_pod_creator_as_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_pod_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_pod_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_pod_by_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pod_member_profiles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_pod_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pod_member_profiles(uuid) TO authenticated;