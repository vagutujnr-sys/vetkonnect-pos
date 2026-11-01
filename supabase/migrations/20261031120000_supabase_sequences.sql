CREATE OR REPLACE FUNCTION public.next_sequence(p_organization_id text, p_key text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.sequences (id, organization_id, value)
  VALUES (p_organization_id || ':' || p_key, p_organization_id, 1)
  ON CONFLICT (id)
  DO UPDATE SET value = public.sequences.value + 1
  RETURNING value;
$$;

REVOKE ALL ON FUNCTION public.next_sequence(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_sequence(text, text) TO service_role;
