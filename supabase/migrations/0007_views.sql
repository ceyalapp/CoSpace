-- 0007: convenience views (security_invoker so RLS applies to underlying tables)

create view public.polls_v
  with (security_invoker = true) as
  select p.id,
         p.requirement_id,
         p.question,
         p.created_at,
         coalesce(sum(o.votes), 0)::int as total
    from public.polls p
    left join public.poll_options o on o.poll_id = p.id
   group by p.id;

create view public.budgets_v
  with (security_invoker = true) as
  select b.user_id,
         b.planned,
         coalesce((select sum(amount) from public.budget_items bi
                    where bi.user_id = b.user_id and bi.paid), 0)::bigint as spent
    from public.budgets b;

create view public.workspace_summary_v
  with (security_invoker = true) as
  select r.id as requirement_id,
         ws.avg_cost,
         ws.avg_payback,
         coalesce(ws.installed_flats, 0) as installed_flats,
         (select count(*) from public.active_requirements ar where ar.requirement_id = r.id)::int as active_residents,
         (select count(*) from public.vendors v where v.requirement_id = r.id)::int as vendors_discussed,
         (select count(*) from public.polls p where p.requirement_id = r.id)::int as active_polls,
         exists (select 1 from public.group_buys gb where gb.requirement_id = r.id and gb.status = 'active') as active_group_buy
    from public.requirements r
    left join public.workspace_summaries ws on ws.requirement_id = r.id;
