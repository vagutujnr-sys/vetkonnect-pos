CREATE OR REPLACE FUNCTION public.keep_vkwallet_disabled()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF lower(trim(NEW.name)) = 'vkwallet' THEN
    NEW.active := FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_methods_keep_vkwallet_disabled ON public.payment_methods;
CREATE TRIGGER payment_methods_keep_vkwallet_disabled
BEFORE INSERT OR UPDATE ON public.payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.keep_vkwallet_disabled();

UPDATE public.payment_methods
SET active = FALSE
WHERE lower(trim(name)) = 'vkwallet';

INSERT INTO public.payment_methods (id, organization_id, name, sort_order, active)
SELECT gen_random_uuid()::TEXT, organization.id, method.name, method.sort_order, TRUE
FROM public.organizations AS organization
CROSS JOIN (VALUES
  ('Cash', 0),
  ('EcoCash', 1)
) AS method(name, sort_order)
ON CONFLICT (organization_id, name)
DO UPDATE SET active = TRUE, sort_order = EXCLUDED.sort_order;

DO $$
DECLARE
  v_definition TEXT;
  v_updated TEXT;
BEGIN
  v_definition := pg_get_functiondef(
    'public.create_sale(text,text,text,text,text,text,text,text,jsonb,text,double precision,text,text,text,text)'::regprocedure
  );
  v_updated := replace(
    v_definition,
    'v_received := CASE WHEN p_method = ''Cash'' THEN round(COALESCE(p_received, 0), 2) ELSE v_total END;',
    'v_received := CASE WHEN p_method IN (''Cash'', ''EcoCash'') THEN round(COALESCE(p_received, 0), 2) ELSE v_total END;'
  );
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Could not update create_sale received amount handling.';
  END IF;
  v_definition := v_updated;
  v_updated := replace(
    v_definition,
    'IF p_method = ''Cash'' AND v_received + 0.001 < v_total THEN',
    'IF p_method IN (''Cash'', ''EcoCash'') AND v_received + 0.001 < v_total THEN'
  );
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Could not update create_sale amount validation.';
  END IF;
  EXECUTE v_updated;
END;
$$;
