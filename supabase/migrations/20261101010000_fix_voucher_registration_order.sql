CREATE OR REPLACE FUNCTION public.complete_practice_registration(
  p_intent_id TEXT,
  p_payment_method TEXT,
  p_paynow_poll_url TEXT,
  p_code_hash TEXT,
  p_organization_id TEXT,
  p_branch_id TEXT,
  p_user_id TEXT,
  p_subscription_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent public.registration_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_intent
  FROM public.registration_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND OR v_intent.payment_method <> p_payment_method THEN
    RETURN FALSE;
  END IF;
  IF v_intent.status = 'COMPLETED' THEN
    RETURN TRUE;
  END IF;
  IF p_payment_method = 'PAYNOW' AND
     (v_intent.paynow_poll_url IS NULL OR v_intent.paynow_poll_url <> p_paynow_poll_url) THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE slug = v_intent.slug OR id = p_organization_id
  ) THEN
    RETURN FALSE;
  END IF;
  IF p_payment_method NOT IN ('PAYNOW', 'VOUCHER') THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.organizations (id, name, slug, logo_url, status, created_at, updated_at)
  VALUES (
    p_organization_id,
    v_intent.practice_name,
    v_intent.slug,
    v_intent.logo_url,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  IF p_payment_method = 'VOUCHER'
     AND NOT public.claim_subscription_voucher(p_code_hash, p_organization_id) THEN
    DELETE FROM public.organizations WHERE id = p_organization_id;
    RETURN FALSE;
  END IF;

  INSERT INTO public.branches (id, organization_id, name, created_at, updated_at)
  VALUES (p_branch_id, p_organization_id, v_intent.practice_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

  INSERT INTO public.users (id, organization_id, branch_id, name, role, pin_hash, email, active, created_at, updated_at)
  VALUES (p_user_id, p_organization_id, p_branch_id, v_intent.admin_name, 'SUPER_ADMIN', v_intent.pin_hash, v_intent.email, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

  INSERT INTO public.clinic_settings (
    id, organization_id, branch_id, clinic_name, tagline, address, phone, email, currency_symbol, lock_timeout_minutes, updated_at
  ) VALUES (
    p_organization_id, p_organization_id, p_branch_id, v_intent.practice_name, 'Veterinary Practice',
    v_intent.address, v_intent.phone, v_intent.email, '$', 5, CURRENT_TIMESTAMP
  );

  INSERT INTO public.payment_methods (id, organization_id, name, sort_order, active)
  VALUES
    (gen_random_uuid()::TEXT, p_organization_id, 'Cash', 0, TRUE),
    (gen_random_uuid()::TEXT, p_organization_id, 'Card', 1, TRUE),
    (gen_random_uuid()::TEXT, p_organization_id, 'Bank Transfer', 2, TRUE),
    (gen_random_uuid()::TEXT, p_organization_id, 'Other', 3, TRUE);

  INSERT INTO public.sequences (id, organization_id, value)
  VALUES
    (p_organization_id || ':PATIENT', p_organization_id, 0),
    (p_organization_id || ':RECEIPT', p_organization_id, 0),
    (p_organization_id || ':PRESCRIPTION', p_organization_id, 0);

  INSERT INTO public.subscriptions (id, organization_id, paynow_reference, status, current_period_end, updated_at)
  VALUES (
    p_subscription_id,
    p_organization_id,
    CASE WHEN p_payment_method = 'PAYNOW' THEN p_intent_id ELSE NULL END,
    'ACTIVE',
    CURRENT_TIMESTAMP + INTERVAL '1 month',
    CURRENT_TIMESTAMP
  );

  UPDATE public.registration_intents
  SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
  WHERE id = p_intent_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_practice_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_practice_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;
