-- Sizes and colours, how each sale was paid, end-of-day cash-ups, and
-- expenses for a real profit figure.

-- ── Sizes and colours ─────────────────────────────────────────────────
-- Each size/colour is its own product (own SKU, stock and price). Products
-- that share a style_id are the same item in different sizes/colours.
alter table public.products
  add column size text,
  add column color text,
  add column style_id uuid;
create index products_style_idx on public.products (style_id);

-- ── How each sale was paid ────────────────────────────────────────────
create table public.sale_payments (
  batch_id uuid primary key,
  business_id uuid not null references public.businesses,
  store_id uuid not null references public.stores,
  method text not null check (method in ('cash', 'transfer', 'pos', 'other')),
  amount numeric(14, 2) not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index sale_payments_store_idx on public.sale_payments (store_id, created_at);
create index sale_payments_person_idx on public.sale_payments (created_by, created_at);
alter table public.sale_payments enable row level security;
-- Written only by record_sale; salespeople see their own.
create policy "store reads" on public.sale_payments for select to authenticated
  using (
    (select public.can_store(store_id))
    and ((select public.my_role()) <> 'sales' or created_by = (select auth.uid()))
  );

-- A sale plus how it was paid, in one step.
create function public.record_sale(
  p_store uuid, p_items jsonb, p_payment text default 'cash',
  p_reference text default null, p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  batch uuid;
  total numeric;
begin
  if coalesce(p_payment, '') not in ('cash', 'transfer', 'pos', 'other') then
    raise exception 'Pick how the customer paid.';
  end if;
  -- post_stock checks the person, store, quantities and (for salespeople) prices.
  batch := public.post_stock(p_store, 'sale', p_items, p_reference, p_note);
  select sum(-m.quantity * coalesce(m.unit_price, 0)) into total from public.movements m where m.batch_id = batch;
  insert into public.sale_payments (batch_id, business_id, store_id, method, amount, created_by)
  values (batch, public.my_business(), p_store, p_payment, total, auth.uid());
  return batch;
end;
$$;

-- ── End-of-day cash-up ────────────────────────────────────────────────
-- Each seller closes their own day: what the till should hold in cash versus
-- what they counted, with transfers and POS listed alongside.
create table public.cash_ups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses,
  store_id uuid not null references public.stores,
  user_id uuid not null,
  day date not null,
  orders int not null,
  sales_total numeric(14, 2) not null,
  expected_cash numeric(14, 2) not null,
  transfer_total numeric(14, 2) not null,
  pos_total numeric(14, 2) not null,
  other_total numeric(14, 2) not null,
  counted_cash numeric(14, 2) not null check (counted_cash >= 0),
  note text,
  closed_at timestamptz not null default now(),
  unique (store_id, user_id, day)
);
alter table public.cash_ups enable row level security;
create policy "store reads" on public.cash_ups for select to authenticated
  using (
    (select public.can_store(store_id))
    and ((select public.my_role()) <> 'sales' or user_id = (select auth.uid()))
  );

-- Close (or re-close, to correct) today's till for the signed-in person.
create function public.close_day(p_store uuid, p_counted_cash numeric, p_note text default null)
returns public.cash_ups
language plpgsql security definer set search_path = '' as $$
declare
  biz uuid := public.my_business();
  today date := (now() at time zone 'Africa/Lagos')::date;
  since timestamptz := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  r public.cash_ups;
begin
  if biz is null then raise exception 'Sign in first.'; end if;
  if not public.can_store(p_store) then raise exception 'You don''t have access to this store.'; end if;
  if p_counted_cash is null or p_counted_cash < 0 then raise exception 'Type the cash you counted.'; end if;
  insert into public.cash_ups as c (business_id, store_id, user_id, day, orders, sales_total, expected_cash,
    transfer_total, pos_total, other_total, counted_cash, note)
  select biz, p_store, auth.uid(), today, count(*),
    coalesce(sum(sp.amount), 0),
    coalesce(sum(sp.amount) filter (where sp.method = 'cash'), 0),
    coalesce(sum(sp.amount) filter (where sp.method = 'transfer'), 0),
    coalesce(sum(sp.amount) filter (where sp.method = 'pos'), 0),
    coalesce(sum(sp.amount) filter (where sp.method = 'other'), 0),
    p_counted_cash, nullif(trim(p_note), '')
  from public.sale_payments sp
  where sp.store_id = p_store and sp.created_by = auth.uid() and sp.created_at >= since
  on conflict (store_id, user_id, day) do update set
    orders = excluded.orders, sales_total = excluded.sales_total, expected_cash = excluded.expected_cash,
    transfer_total = excluded.transfer_total, pos_total = excluded.pos_total, other_total = excluded.other_total,
    counted_cash = excluded.counted_cash, note = excluded.note, closed_at = now()
  returning * into r;
  return r;
end;
$$;

-- ── Expenses ──────────────────────────────────────────────────────────
-- store_id null = business-wide (e.g. the owner's salary, an accountant).
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses,
  store_id uuid references public.stores,
  category text not null,
  amount numeric(14, 2) not null check (amount > 0),
  spent_on date not null default ((now() at time zone 'Africa/Lagos')::date),
  note text,
  voided boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index expenses_business_idx on public.expenses (business_id, spent_on);
alter table public.expenses enable row level security;
-- Owners see everything; a manager sees their store's (and business-wide ones if they run all stores).
create policy "managers read" on public.expenses for select to authenticated
  using (business_id = (select public.my_business()) and public.can_manage_staff(store_id));
create policy "managers add" on public.expenses for insert to authenticated
  with check (business_id = (select public.my_business()) and created_by = (select auth.uid()) and public.can_manage_staff(store_id));
create policy "managers edit" on public.expenses for update to authenticated
  using (business_id = (select public.my_business()) and public.can_manage_staff(store_id))
  with check (business_id = (select public.my_business()) and public.can_manage_staff(store_id));

-- Money in, money out, per store, for a date range (Lagos days).
create function public.profit_and_loss(p_from date, p_to date)
returns table (store_id uuid, revenue numeric, cogs numeric, losses numeric, expenses numeric, orders bigint)
language sql stable security invoker set search_path = '' as $$
  with s as (
    select m.store_id,
      sum(-m.quantity * coalesce(m.unit_price, 0)) filter (where m.type = 'sale') as revenue,
      sum(-m.quantity * coalesce(m.unit_cost, 0)) filter (where m.type = 'sale') as cogs,
      sum(-m.quantity * coalesce(m.unit_cost, 0)) filter (where m.type = 'adjust' and m.quantity < 0) as losses,
      count(distinct m.batch_id) filter (where m.type = 'sale') as orders
    from public.movements m
    where m.type in ('sale', 'adjust')
      and (m.created_at at time zone 'Africa/Lagos')::date between p_from and p_to
    group by 1
  ), e as (
    select x.store_id, sum(x.amount) as expenses
    from public.expenses x
    where not x.voided and x.spent_on between p_from and p_to
    group by 1
  )
  select x.store_id, sum(x.revenue), sum(x.cogs), sum(x.losses), sum(x.expenses), sum(x.orders)::bigint
  from (
    select s.store_id, coalesce(s.revenue, 0) as revenue, coalesce(s.cogs, 0) as cogs, coalesce(s.losses, 0) as losses,
      0::numeric as expenses, s.orders from s
    union all
    select e.store_id, 0, 0, 0, e.expenses, 0 from e
  ) x
  group by x.store_id;
$$;

revoke execute on function public.record_sale(uuid, jsonb, text, text, text), public.close_day(uuid, numeric, text),
  public.profit_and_loss(date, date) from public, anon;
grant execute on function public.record_sale(uuid, jsonb, text, text, text), public.close_day(uuid, numeric, text),
  public.profit_and_loss(date, date) to authenticated;
