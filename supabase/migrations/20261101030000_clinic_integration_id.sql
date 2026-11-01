ALTER TABLE public.clinic_settings
  ADD COLUMN IF NOT EXISTS integration_id TEXT;

UPDATE public.clinic_settings
SET integration_id = gen_random_uuid()::TEXT
WHERE integration_id IS NULL;

ALTER TABLE public.clinic_settings
  ALTER COLUMN integration_id SET DEFAULT gen_random_uuid()::TEXT,
  ALTER COLUMN integration_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clinic_settings_integration_id_key
  ON public.clinic_settings (integration_id);
