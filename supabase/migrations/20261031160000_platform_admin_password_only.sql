ALTER TABLE public.users
  ALTER COLUMN pin_hash DROP NOT NULL;

UPDATE public.users
SET pin_hash = NULL
WHERE role = 'PLATFORM_ADMIN';

ALTER TABLE public.users
  ADD CONSTRAINT platform_admin_password_only_check
  CHECK (
    (role = 'PLATFORM_ADMIN' AND pin_hash IS NULL)
    OR (role <> 'PLATFORM_ADMIN' AND pin_hash IS NOT NULL)
  );
