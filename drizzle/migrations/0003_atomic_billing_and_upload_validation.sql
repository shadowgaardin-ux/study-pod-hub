CREATE OR REPLACE FUNCTION public.apply_verified_payment(_reference text,_user_id uuid,_item text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _tier text; _months integer; _amount integer; _profile public.profiles; _existing public.payments; _expires timestamptz;
BEGIN
 CASE _item WHEN 'pro_monthly' THEN _tier:='Pro'; _months:=1; _amount:=2500;
 WHEN 'max_monthly' THEN _tier:='Max'; _months:=1; _amount:=5000;
 WHEN 'pro_semester' THEN _tier:='Pro'; _months:=3; _amount:=6000;
 WHEN 'max_semester' THEN _tier:='Max'; _months:=3; _amount:=12000;
 ELSE RAISE EXCEPTION 'Invalid payment item'; END CASE;
 PERFORM pg_advisory_xact_lock(hashtextextended(_reference,0));
 SELECT * INTO _existing FROM public.payments WHERE reference=_reference;
 IF FOUND THEN
  IF _existing.user_id<>_user_id OR _existing.item<>_item THEN RAISE EXCEPTION 'Payment details mismatch'; END IF;
  RETURN jsonb_build_object('ok',true,'tier',_existing.tier,'already',true);
 END IF;
 SELECT * INTO _profile FROM public.profiles WHERE id=_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment account not found'; END IF;
 _expires := CASE WHEN _profile.tier=_tier AND _profile.tier_expires_at>now() THEN _profile.tier_expires_at ELSE now() END + make_interval(months=>_months);
 INSERT INTO public.payments(reference,user_id,item,tier,months,amount) VALUES (_reference,_user_id,_item,_tier,_months,_amount);
 UPDATE public.profiles SET tier=_tier,tier_expires_at=_expires WHERE id=_user_id;
 RETURN jsonb_build_object('ok',true,'tier',_tier,'already',false);
END $$;
REVOKE ALL ON FUNCTION public.apply_verified_payment(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_payment(text,uuid,text) TO service_role;

CREATE POLICY safe_attachment_extensions ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
 bucket_id NOT IN ('pod-audio','pod-chat') OR
 (bucket_id='pod-audio' AND lower(storage.extension(name)) IN ('mp3','m4a','wav','ogg','webm','aac','mp4','pdf','doc','docx','ppt','pptx')) OR
 (bucket_id='pod-chat' AND lower(storage.extension(name)) IN ('jpg','jpeg','png','gif','webp','heic','heif','mp3','m4a','wav','ogg','webm','aac','mp4','pdf','doc','docx','ppt','pptx'))
);
-- Validate known MIME types as well; octet-stream retains compatibility with older upload clients.
CREATE POLICY safe_attachment_mimes ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
 bucket_id NOT IN ('pod-audio','pod-chat') OR coalesce(metadata->>'mimetype','application/octet-stream') IN ('application/octet-stream','audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/aac','video/mp4','video/webm','application/pdf','application/msword','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif') OR coalesce(metadata->>'mimetype','') LIKE 'audio/webm;%' OR coalesce(metadata->>'mimetype','') LIKE 'audio/ogg;%'
);
