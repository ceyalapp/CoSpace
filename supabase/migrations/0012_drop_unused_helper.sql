-- 0012: drop current_author_id() — unused; RLS policies inline the auth.uid() check
drop function if exists public.current_author_id();
