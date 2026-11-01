CREATE TABLE IF NOT EXISTS public.subscription_voucher_redemptions (
  voucher_id TEXT NOT NULL REFERENCES public.subscription_vouchers(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT subscription_voucher_redemption_pkey PRIMARY KEY (voucher_id, organization_id)
);

ALTER TABLE public.subscription_voucher_redemptions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.subscription_voucher_redemptions TO service_role;

INSERT INTO public.subscription_voucher_redemptions (voucher_id, organization_id, redeemed_at)
SELECT id, redeemed_by_organization_id, COALESCE(redeemed_at, created_at)
FROM public.subscription_vouchers
WHERE redeemed_by_organization_id IS NOT NULL
ON CONFLICT (voucher_id, organization_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_subscription_voucher(
  p_code_hash TEXT,
  p_organization_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher_id TEXT;
BEGIN
  UPDATE public.subscription_vouchers voucher
  SET redemption_count = voucher.redemption_count + 1,
      status = CASE
        WHEN voucher.redemption_count + 1 >= voucher.max_redemptions THEN 'REDEEMED'
        ELSE 'ACTIVE'
      END,
      redeemed_at = CURRENT_TIMESTAMP,
      redeemed_by_organization_id = p_organization_id
  WHERE voucher.code_hash = p_code_hash
    AND voucher.status = 'ACTIVE'
    AND voucher.redemption_count < voucher.max_redemptions
    AND NOT EXISTS (
      SELECT 1
      FROM public.subscription_voucher_redemptions redemption
      WHERE redemption.voucher_id = voucher.id
        AND redemption.organization_id = p_organization_id
    )
  RETURNING voucher.id INTO v_voucher_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.subscription_voucher_redemptions (voucher_id, organization_id)
  VALUES (v_voucher_id, p_organization_id);
  RETURN TRUE;
END;
$$;

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
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_intent.slug) THEN
    RETURN FALSE;
  END IF;

  IF p_payment_method = 'VOUCHER' THEN
    IF NOT public.claim_subscription_voucher(p_code_hash, p_organization_id) THEN
      RETURN FALSE;
    END IF;
  ELSIF p_payment_method <> 'PAYNOW' THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.organizations (id, name, slug, logo_url, status, created_at, updated_at)
  VALUES (p_organization_id, v_intent.practice_name, v_intent.slug, v_intent.logo_url, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
    p_subscription_id, p_organization_id,
    CASE WHEN p_payment_method = 'PAYNOW' THEN p_intent_id ELSE NULL END,
    'ACTIVE', CURRENT_TIMESTAMP + INTERVAL '1 month', CURRENT_TIMESTAMP
  );

  UPDATE public.registration_intents
  SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
  WHERE id = p_intent_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_subscription_voucher(
  p_code_hash TEXT,
  p_organization_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_period_end TIMESTAMP(3);
BEGIN
  SELECT current_period_end INTO v_current_period_end
  FROM public.subscriptions
  WHERE organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF NOT public.claim_subscription_voucher(p_code_hash, p_organization_id) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscriptions
  SET status = 'ACTIVE',
      current_period_end = GREATEST(COALESCE(v_current_period_end, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) + INTERVAL '1 month',
      paynow_reference = NULL,
      updated_at = CURRENT_TIMESTAMP
  WHERE organization_id = p_organization_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_subscription_voucher(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_practice_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_subscription_voucher(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_subscription_voucher(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_practice_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_subscription_voucher(TEXT, TEXT) TO service_role;
