-- 0009: realtime publication

alter publication supabase_realtime add table
  public.threads,
  public.polls,
  public.poll_options,
  public.group_buys,
  public.group_buy_members,
  public.vendor_reviews;
