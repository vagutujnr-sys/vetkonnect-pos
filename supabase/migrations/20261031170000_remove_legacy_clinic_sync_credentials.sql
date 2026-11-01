ALTER TABLE public.clinic_settings
  DROP COLUMN IF EXISTS supabase_url,
  DROP COLUMN IF EXISTS supabase_key,
  DROP COLUMN IF EXISTS sync_enabled,
  DROP COLUMN IF EXISTS last_sync_at;
