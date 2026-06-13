-- 0006: counter triggers and capacity guards (all SECURITY DEFINER so they bypass RLS)

-- thread_likes → threads.likes
create or replace function public.tg_thread_like_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.threads set likes = likes + 1 where id = new.thread_id;
  return new;
end$$;

create or replace function public.tg_thread_like_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.threads set likes = greatest(likes - 1, 0) where id = old.thread_id;
  return old;
end$$;

create trigger thread_like_after_insert
  after insert on public.thread_likes
  for each row execute function public.tg_thread_like_after_insert();

create trigger thread_like_after_delete
  after delete on public.thread_likes
  for each row execute function public.tg_thread_like_after_delete();

-- poll_votes → poll_options.votes
create or replace function public.tg_poll_vote_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.poll_options set votes = votes + 1 where id = new.option_id;
  return new;
end$$;

create trigger poll_vote_after_insert
  after insert on public.poll_votes
  for each row execute function public.tg_poll_vote_after_insert();

-- group_buy_members → cap check + group_buys.joined
create or replace function public.tg_groupbuy_member_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  gb record;
begin
  select target, joined, status into gb
    from public.group_buys where id = new.group_buy_id for update;
  if not found then
    raise exception 'group buy % not found', new.group_buy_id;
  end if;
  if gb.status <> 'active' then
    raise exception 'group buy % is %', new.group_buy_id, gb.status;
  end if;
  if gb.joined >= gb.target then
    raise exception 'group buy % is full (%/%)', new.group_buy_id, gb.joined, gb.target
      using errcode = 'check_violation';
  end if;
  return new;
end$$;

create or replace function public.tg_groupbuy_member_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.group_buys set joined = joined + 1 where id = new.group_buy_id;
  return new;
end$$;

create or replace function public.tg_groupbuy_member_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.group_buys set joined = greatest(joined - 1, 0) where id = old.group_buy_id;
  return old;
end$$;

create trigger groupbuy_member_before_insert
  before insert on public.group_buy_members
  for each row execute function public.tg_groupbuy_member_before_insert();

create trigger groupbuy_member_after_insert
  after insert on public.group_buy_members
  for each row execute function public.tg_groupbuy_member_after_insert();

create trigger groupbuy_member_after_delete
  after delete on public.group_buy_members
  for each row execute function public.tg_groupbuy_member_after_delete();
