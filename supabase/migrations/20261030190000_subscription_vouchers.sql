ALTER TABLE public.registration_intents
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'PAYNOW';

CREATE TABLE public.subscription_payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  paynow_poll_url TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  amount DOUBLE PRECISION NOT NULL DEFAULT 5,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP(3)
);

CREATE INDEX subscription_payment_organization_id_status_idx
  ON public.subscription_payments(organization_id, status);

CREATE TABLE public.subscription_vouchers (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  code_suffix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  redeemed_at TIMESTAMP(3),
  redeemed_by_organization_id TEXT REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_vouchers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.subscription_payments TO service_role;
GRANT ALL ON TABLE public.subscription_vouchers TO service_role;

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
    SET status = 'REDEEMED',
        redeemed_at = CURRENT_TIMESTAMP,
        redeemed_by_organization_id = p_organization_id
    WHERE code_hash = p_code_hash AND status = 'ACTIVE';
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
  SET status = 'REDEEMED',
      redeemed_at = CURRENT_TIMESTAMP,
      redeemed_by_organization_id = p_organization_id
  WHERE code_hash = p_code_hash AND status = 'ACTIVE';
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

CREATE OR REPLACE FUNCTION public.complete_subscription_payment(
  p_payment_id TEXT,
  p_paynow_poll_url TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.subscription_payments%ROWTYPE;
  v_current_period_end TIMESTAMP(3);
BEGIN
  SELECT * INTO v_payment
  FROM public.subscription_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND OR v_payment.amount <> 5 OR v_payment.paynow_poll_url <> p_paynow_poll_url THEN
    RETURN FALSE;
  END IF;
  IF v_payment.status = 'COMPLETED' THEN
    RETURN TRUE;
  END IF;
  IF v_payment.status <> 'PENDING' THEN
    RETURN FALSE;
  END IF;

  SELECT current_period_end INTO v_current_period_end
  FROM public.subscriptions
  WHERE organization_id = v_payment.organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscription_payments
  SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
  WHERE id = p_payment_id;
  UPDATE public.subscriptions
  SET status = 'ACTIVE',
      current_period_end = GREATEST(COALESCE(v_current_period_end, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) + INTERVAL '1 month',
      paynow_reference = p_payment_id,
      updated_at = CURRENT_TIMESTAMP
  WHERE organization_id = v_payment.organization_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_practice_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_subscription_voucher(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_subscription_payment(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_practice_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_subscription_voucher(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_subscription_payment(TEXT, TEXT) TO service_role;
