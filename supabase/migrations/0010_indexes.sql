-- 0010: performance indexes

create index threads_req_pinned_created    on public.threads (requirement_id, pinned desc, created_at desc);
create index vendors_requirement_idx       on public.vendors (requirement_id);
create index vendor_reviews_vendor_created on public.vendor_reviews (vendor_id, created_at desc);
create index plans_requirement_idx         on public.plans (requirement_id);
create index resources_requirement_idx     on public.resources (requirement_id);
create index group_buys_requirement_idx    on public.group_buys (requirement_id);
create index group_buy_members_user_idx    on public.group_buy_members (user_id);
create index thread_likes_user_idx         on public.thread_likes (user_id);
create index poll_votes_user_idx           on public.poll_votes (user_id);
create index polls_requirement_idx         on public.polls (requirement_id);
create index poll_options_poll_idx         on public.poll_options (poll_id);
create index active_requirements_user_idx  on public.active_requirements (user_id);
create index checklist_user_idx            on public.checklist_items (user_id);
create index budget_items_user_idx         on public.budget_items (user_id);
create index shortlist_user_idx            on public.shortlist (user_id);
create index quotations_user_idx           on public.quotations (user_id);
create index authors_profile_idx           on public.authors (profile_id);
create index profiles_community_idx        on public.profiles (community_id);

create unique index one_active_gb_per_req
  on public.group_buys (requirement_id) where status = 'active';
