DROP INDEX IF EXISTS public.user_email_key;

CREATE UNIQUE INDEX user_email_non_platform_key
  ON public.users (email)
  WHERE email IS NOT NULL AND role <> 'PLATFORM_ADMIN';

CREATE UNIQUE INDEX user_email_platform_admin_key
  ON public.users (email)
  WHERE email IS NOT NULL AND role = 'PLATFORM_ADMIN';
