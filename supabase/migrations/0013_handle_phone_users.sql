-- 0013: update handle_new_user to also work for phone-only signups (email may be null)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, community_id, name, flat, block, avatar, avatar_color)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'community_id', ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(split_part(coalesce(new.email,''), '@', 1), ''),
      new.phone,
      'New member'
    ),
    nullif(new.raw_user_meta_data->>'flat', ''),
    nullif(new.raw_user_meta_data->>'block', ''),
    nullif(new.raw_user_meta_data->>'avatar', ''),
    nullif(new.raw_user_meta_data->>'avatar_color', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
