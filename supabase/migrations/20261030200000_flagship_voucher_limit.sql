ALTER TABLE public.subscription_vouchers
  ADD COLUMN IF NOT EXISTS max_redemptions INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS redemption_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_voucher_positive_max_redemptions'
  ) THEN
    ALTER TABLE public.subscription_vouchers
      ADD CONSTRAINT subscription_voucher_positive_max_redemptions
      CHECK (max_redemptions > 0);
  END IF;
END;
$$;

UPDATE public.subscription_vouchers
SET redemption_count = 1
WHERE status = 'REDEEMED' AND redemption_count = 0;

INSERT INTO public.subscription_vouchers (
  id,
  code_hash,
  code_suffix,
  status,
  max_redemptions,
  redemption_count,
  created_by_user_id
) VALUES (
  'flagship-nk07h3l0',
  '5508f99f583e7bdbd9fefd60842fa4a09aa05c9970238eaa5532998fa4c99441',
  'H3L0',
  'ACTIVE',
  5,
  0,
  'SYSTEM'
)
ON CONFLICT (code_hash) DO UPDATE
SET max_redemptions = 5,
    status = CASE
      WHEN subscription_vouchers.redemption_count >= 5 THEN 'REDEEMED'
      ELSE 'ACTIVE'
    END;

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
  v_current_period_end TIMESTAMP(3);
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
    UPDATE public.subscription_vouchers
    SET redemption_count = redemption_count + 1,
        status = CASE
          WHEN redemption_count + 1 >= max_redemptions THEN 'REDEEMED'
          ELSE 'ACTIVE'
        END,
        redeemed_at = CURRENT_TIMESTAMP,
        redeemed_by_organization_id = p_organization_id
    WHERE code_hash = p_code_hash
      AND status = 'ACTIVE'
      AND redemption_count < max_redemptions;
    IF NOT FOUND THEN
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

  v_current_period_end := CURRENT_TIMESTAMP + INTERVAL '1 month';
  INSERT INTO public.subscriptions (id, organization_id, paynow_reference, status, current_period_end, updated_at)
  VALUES (
    p_subscription_id, p_organization_id,
    CASE WHEN p_payment_method = 'PAYNOW' THEN p_intent_id ELSE NULL END,
    'ACTIVE', v_current_period_end, CURRENT_TIMESTAMP
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

  UPDATE public.subscription_vouchers
  SET redemption_count = redemption_count + 1,
      status = CASE
        WHEN redemption_count + 1 >= max_redemptions THEN 'REDEEMED'
        ELSE 'ACTIVE'
      END,
      redeemed_at = CURRENT_TIMESTAMP,
      redeemed_by_organization_id = p_organization_id
  WHERE code_hash = p_code_hash
    AND status = 'ACTIVE'
    AND redemption_count < max_redemptions;
  IF NOT FOUND THEN
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

REVOKE ALL ON FUNCTION public.complete_practice_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_subscription_voucher(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_practice_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_subscription_voucher(TEXT, TEXT) TO service_role;
