-- Platform admin: people listed in platform_admins (by email) can see every
-- business through the admin_* functions. Add the first admin by hand:
--   insert into public.platform_admins (email) values ('you@example.com');

create table public.platform_admins (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);
-- No policies: only the security-definer functions below read it.
alter table public.platform_admins enable row level security;

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    join public.platform_admins a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

create function public.require_platform_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Stockline admins can see this.' using errcode = '42501';
  end if;
end;
$$;

-- Midnight today in Lagos, the day boundary every report uses.
create function public.lagos_today() returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
$$;

create function public.admin_businesses()
returns table (
  id uuid, name text, currency text, created_at timestamptz, owner_name text, owner_email text,
  stores bigint, products bigint, people bigint, salespeople bigint, stock_value numeric,
  sales_today numeric, sales_30d numeric, orders_30d bigint, last_activity timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_platform_admin();
  return query
  select b.id, b.name, b.currency, b.created_at,
    (select m.full_name from public.members m where m.user_id = b.owner_id),
    (select u.email::text from auth.users u where u.id = b.owner_id),
    (select count(*) from public.stores s where s.business_id = b.id and not s.archived),
    (select count(*) from public.products p where p.business_id = b.id and not p.archived),
    (select count(*) from public.members m where m.business_id = b.id),
    (select count(*) from public.members m where m.business_id = b.id and m.role = 'sales'),
    (select coalesce(sum(sl.quantity * p.cost_price), 0) from public.stock_levels sl
       join public.products p on p.id = sl.product_id where p.business_id = b.id),
    (select coalesce(sum(-mv.quantity * coalesce(mv.unit_price, 0)), 0) from public.movements mv
       where mv.business_id = b.id and mv.type = 'sale' and mv.created_at >= public.lagos_today()),
    (select coalesce(sum(-mv.quantity * coalesce(mv.unit_price, 0)), 0) from public.movements mv
       where mv.business_id = b.id and mv.type = 'sale' and mv.created_at >= now() - interval '30 days'),
    (select count(distinct mv.batch_id) from public.movements mv
       where mv.business_id = b.id and mv.type = 'sale' and mv.created_at >= now() - interval '30 days'),
    (select max(mv.created_at) from public.movements mv where mv.business_id = b.id)
  from public.businesses b
  order by b.created_at desc;
end;
$$;

-- One row per day: new businesses, and sales across the whole platform.
create function public.admin_daily(p_days int default 30)
returns table (day date, signups bigint, revenue numeric, orders bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_platform_admin();
  return query
  with days as (
    select generate_series((now() at time zone 'Africa/Lagos')::date - (p_days - 1),
                           (now() at time zone 'Africa/Lagos')::date, interval '1 day')::date as day
  ), sales as (
    select (mv.created_at at time zone 'Africa/Lagos')::date as day,
      sum(-mv.quantity * coalesce(mv.unit_price, 0)) as revenue, count(distinct mv.batch_id) as orders
    from public.movements mv
    where mv.type = 'sale' and mv.created_at >= now() - make_interval(days => p_days + 1)
    group by 1
  ), joins as (
    select (b.created_at at time zone 'Africa/Lagos')::date as day, count(*) as n
    from public.businesses b group by 1
  )
  select d.day, coalesce(j.n, 0), coalesce(s.revenue, 0), coalesce(s.orders, 0)
  from days d left join sales s on s.day = d.day left join joins j on j.day = d.day
  order by d.day;
end;
$$;

-- Everything about one business, for the admin's detail page.
create function public.admin_business(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform public.require_platform_admin();
  select jsonb_build_object(
    'business', jsonb_build_object('id', b.id, 'name', b.name, 'currency', b.currency, 'created_at', b.created_at,
      'owner_id', b.owner_id, 'owner_email', (select u.email from auth.users u where u.id = b.owner_id)),
    'stores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'address', s.address, 'color', s.color, 'archived', s.archived,
        'stock_value', (select coalesce(sum(sl.quantity * p.cost_price), 0) from public.stock_levels sl
                          join public.products p on p.id = sl.product_id where sl.store_id = s.id),
        'low', (select count(*) from public.products p
                  left join public.stock_levels sl on sl.product_id = p.id and sl.store_id = s.id
                  where p.business_id = b.id and not p.archived and coalesce(sl.quantity, 0) <= p.reorder_level),
        'sales_30d', (select coalesce(sum(-mv.quantity * coalesce(mv.unit_price, 0)), 0) from public.movements mv
                        where mv.store_id = s.id and mv.type = 'sale' and mv.created_at >= now() - interval '30 days')
      ) order by s.created_at) from public.stores s where s.business_id = b.id), '[]'),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'full_name', m.full_name, 'role', m.role, 'username', m.username,
        'email', case when m.username is null then coalesce(m.email, u.email) end,
        'store_id', m.store_id, 'active', m.active, 'phone', m.phone, 'created_at', m.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'monthly_target', m.monthly_target, 'commission_rate', m.commission_rate,
        'sales_30d', (select coalesce(sum(-mv.quantity * coalesce(mv.unit_price, 0)), 0) from public.movements mv
                        where mv.created_by = m.user_id and mv.business_id = b.id and mv.type = 'sale'
                          and mv.created_at >= now() - interval '30 days'),
        'orders_30d', (select count(distinct mv.batch_id) from public.movements mv
                         where mv.created_by = m.user_id and mv.business_id = b.id and mv.type = 'sale'
                           and mv.created_at >= now() - interval '30 days')
      ) order by case m.role when 'owner' then 0 when 'manager' then 1 when 'staff' then 2 else 3 end, m.created_at)
      from public.members m left join auth.users u on u.id = m.user_id where m.business_id = b.id), '[]'),
    'counts', jsonb_build_object(
      'products', (select count(*) from public.products p where p.business_id = b.id and not p.archived),
      'suppliers', (select count(*) from public.suppliers sp where sp.business_id = b.id),
      'movements', (select count(*) from public.movements mv where mv.business_id = b.id)),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', x.day, 'revenue', x.revenue, 'cost', x.cost, 'orders', x.orders) order by x.day)
      from (select (mv.created_at at time zone 'Africa/Lagos')::date as day,
              sum(-mv.quantity * coalesce(mv.unit_price, 0)) as revenue,
              sum(-mv.quantity * coalesce(mv.unit_cost, 0)) as cost, count(distinct mv.batch_id) as orders
            from public.movements mv
            where mv.business_id = b.id and mv.type = 'sale' and mv.created_at >= now() - interval '30 days'
            group by 1) x), '[]'),
    'recent', coalesce((
      select jsonb_agg(r order by r.created_at desc) from (
        select mv.id, mv.type, mv.quantity, mv.unit_price, mv.created_at,
          p.name as product, s.name as store, s.color as store_color, coalesce(m.full_name, 'Team member') as person
        from public.movements mv
        join public.products p on p.id = mv.product_id
        join public.stores s on s.id = mv.store_id
        left join public.members m on m.user_id = mv.created_by
        where mv.business_id = b.id
        order by mv.created_at desc limit 25) r), '[]')
  ) into result
  from public.businesses b where b.id = p_id;
  if result is null then raise exception 'Unknown business.'; end if;
  return result;
end;
$$;

create function public.admin_list() returns table (email text, added_at timestamptz, is_you boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_platform_admin();
  return query select a.email, a.added_at, a.email = (select lower(u.email) from auth.users u where u.id = auth.uid())
  from public.platform_admins a order by a.added_at;
end;
$$;

create function public.admin_add(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_platform_admin();
  if coalesce(trim(p_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That doesn''t look like an email address.'; end if;
  insert into public.platform_admins (email) values (lower(trim(p_email))) on conflict do nothing;
end;
$$;

create function public.admin_remove(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_platform_admin();
  if lower(trim(p_email)) = (select lower(u.email) from auth.users u where u.id = auth.uid()) then
    raise exception 'You can''t remove yourself.';
  end if;
  delete from public.platform_admins where email = lower(trim(p_email));
end;
$$;

-- ── Function permissions ──────────────────────────────────────────────

revoke execute on function public.require_platform_admin() from public, anon, authenticated;
revoke execute on function public.is_platform_admin(), public.lagos_today(), public.admin_businesses(),
  public.admin_daily(int), public.admin_business(uuid), public.admin_list(), public.admin_add(text), public.admin_remove(text)
  from public, anon;
grant execute on function public.is_platform_admin(), public.lagos_today(), public.admin_businesses(),
  public.admin_daily(int), public.admin_business(uuid), public.admin_list(), public.admin_add(text), public.admin_remove(text)
  to authenticated;
