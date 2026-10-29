-- Stockline: multi-store inventory for one business.
-- Every change in stock is a row in `movements` (an append-only ledger);
-- `stock_levels` is kept in step by a trigger, so quantities can always be
-- explained by their history.

-- ── Tables ─────────────────────────────────────────────────────────────

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'NGN',
  owner_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  name text not null,
  address text,
  phone text,
  color text not null default '#1F5F4A',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.stores (business_id);

-- One business per person. store_id = null means "all stores".
create table public.members (
  user_id uuid primary key references auth.users on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  store_id uuid references public.stores on delete set null,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
create index on public.members (business_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'staff')),
  store_id uuid references public.stores on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (business_id, email)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  name text not null,
  unique (business_id, name)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.suppliers (business_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  name text not null,
  sku text not null,
  barcode text,
  category_id uuid references public.categories on delete set null,
  supplier_id uuid references public.suppliers on delete set null,
  unit text not null default 'pcs',
  cost_price numeric(14, 2) not null default 0 check (cost_price >= 0),
  sell_price numeric(14, 2) not null default 0 check (sell_price >= 0),
  reorder_level numeric(12, 2) not null default 5 check (reorder_level >= 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (business_id, sku)
);
create index on public.products (business_id);
create index on public.products (business_id, barcode);

create table public.stock_levels (
  store_id uuid not null references public.stores on delete cascade,
  product_id uuid not null references public.products on delete cascade,
  quantity numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (store_id, product_id)
);
create index on public.stock_levels (product_id);

-- quantity is signed: + adds to the store, − takes away.
create table public.movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  store_id uuid not null references public.stores on delete cascade,
  product_id uuid not null references public.products on delete cascade,
  type text not null check (type in ('receive', 'sale', 'return', 'transfer_out', 'transfer_in', 'adjust')),
  quantity numeric(12, 2) not null check (quantity <> 0),
  unit_cost numeric(14, 2),
  unit_price numeric(14, 2),
  batch_id uuid not null default gen_random_uuid(),
  reference text,
  reason text,
  note text,
  supplier_id uuid references public.suppliers on delete set null,
  other_store_id uuid references public.stores on delete set null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on public.movements (business_id, created_at desc);
create index on public.movements (store_id, created_at desc);
create index on public.movements (product_id, created_at desc);
create index on public.movements (batch_id);

-- ── Who can see what ──────────────────────────────────────────────────

create function public.my_business() returns uuid
language sql stable security definer set search_path = '' as $$
  select business_id from public.members where user_id = auth.uid();
$$;

create function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.members where user_id = auth.uid();
$$;

-- Owners and unassigned managers see every store; others only theirs.
create function public.can_store(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    join public.stores s on s.business_id = m.business_id
    where m.user_id = auth.uid() and s.id = p_store
      and (m.role = 'owner' or m.store_id is null or m.store_id = p_store)
  );
$$;

-- ── Ledger keeps stock_levels in step ─────────────────────────────────

create function public.apply_movement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  new_qty numeric;
begin
  insert into public.stock_levels (store_id, product_id, quantity, updated_at)
  values (new.store_id, new.product_id, new.quantity, new.created_at)
  on conflict (store_id, product_id)
  do update set quantity = public.stock_levels.quantity + excluded.quantity, updated_at = greatest(public.stock_levels.updated_at, excluded.updated_at)
  returning quantity into new_qty;
  if new_qty < 0 then
    raise exception 'Not enough %: only % left at this store.',
      (select name from public.products where id = new.product_id), trim_scale(new_qty - new.quantity)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger movements_apply after insert on public.movements
for each row execute function public.apply_movement();

-- ── Stock operations (one call = one batch, all or nothing) ───────────
-- p_items: [{ "product_id": uuid, "quantity": n, "unit_cost": n?, "unit_price": n? }]

create function public.post_stock(
  p_store uuid, p_type text, p_items jsonb,
  p_reference text default null, p_note text default null,
  p_supplier uuid default null, p_reason text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  batch uuid := gen_random_uuid();
  biz uuid := public.my_business();
  item jsonb;
  qty numeric;
begin
  if p_type not in ('receive', 'sale', 'return') then
    raise exception 'Unknown stock operation %', p_type;
  end if;
  if not public.can_store(p_store) then
    raise exception 'You don''t have access to this store.';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then
    raise exception 'Add at least one item.';
  end if;
  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::numeric;
    if qty is null or qty <= 0 then raise exception 'Quantities must be more than zero.'; end if;
    insert into public.movements (business_id, store_id, product_id, type, quantity, unit_cost, unit_price,
      batch_id, reference, note, supplier_id, reason, created_by)
    select biz, p_store, p.id, p_type,
      case when p_type = 'sale' then -qty else qty end,
      coalesce((item->>'unit_cost')::numeric, p.cost_price),
      coalesce((item->>'unit_price')::numeric, p.sell_price),
      batch, nullif(trim(p_reference), ''), nullif(trim(p_note), ''), p_supplier, nullif(trim(p_reason), ''), auth.uid()
    from public.products p
    where p.id = (item->>'product_id')::uuid and p.business_id = biz;
    if not found then raise exception 'Unknown product.'; end if;
    -- Receiving at a new cost updates the product's cost price.
    if p_type = 'receive' and item ? 'unit_cost' then
      update public.products set cost_price = (item->>'unit_cost')::numeric
      where id = (item->>'product_id')::uuid and business_id = biz;
    end if;
  end loop;
  return batch;
end;
$$;

-- Runs with elevated rights because the receiving store may be one the sender
-- can't otherwise write to; access to the sending store is checked below.
create function public.transfer_stock(p_from uuid, p_to uuid, p_items jsonb, p_note text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  batch uuid := gen_random_uuid();
  biz uuid := public.my_business();
  item jsonb;
  qty numeric;
begin
  if biz is null then raise exception 'Sign in first.'; end if;
  if p_from = p_to then raise exception 'Pick two different stores.'; end if;
  if not public.can_store(p_from) then raise exception 'You don''t have access to the sending store.'; end if;
  if not exists (select 1 from public.stores where id = p_to and business_id = biz) then
    raise exception 'Unknown receiving store.';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'Add at least one item.'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::numeric;
    if qty is null or qty <= 0 then raise exception 'Quantities must be more than zero.'; end if;
    insert into public.movements (business_id, store_id, product_id, type, quantity, unit_cost, batch_id, note, other_store_id, created_by)
    select biz, p_from, p.id, 'transfer_out', -qty, p.cost_price, batch, nullif(trim(p_note), ''), p_to, auth.uid()
    from public.products p where p.id = (item->>'product_id')::uuid and p.business_id = biz;
    if not found then raise exception 'Unknown product.'; end if;
    insert into public.movements (business_id, store_id, product_id, type, quantity, unit_cost, batch_id, note, other_store_id, created_by)
    select biz, p_to, p.id, 'transfer_in', qty, p.cost_price, batch, nullif(trim(p_note), ''), p_from, auth.uid()
    from public.products p where p.id = (item->>'product_id')::uuid;
  end loop;
  return batch;
end;
$$;

-- Stock count: record what's actually on the shelf; the difference is logged as an adjustment.
-- p_items: [{ "product_id": uuid, "counted": n }]
create function public.count_stock(p_store uuid, p_items jsonb, p_reason text default 'Stock count', p_note text default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  batch uuid := gen_random_uuid();
  biz uuid := public.my_business();
  item jsonb;
  current_qty numeric;
  diff numeric;
begin
  if public.my_role() not in ('owner', 'manager') then
    raise exception 'Only owners and managers can adjust stock.';
  end if;
  if not public.can_store(p_store) then raise exception 'You don''t have access to this store.'; end if;
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    if (item->>'counted')::numeric < 0 then raise exception 'Counts can''t be negative.'; end if;
    select coalesce((select quantity from public.stock_levels
      where store_id = p_store and product_id = (item->>'product_id')::uuid), 0) into current_qty;
    diff := (item->>'counted')::numeric - current_qty;
    continue when diff = 0;
    insert into public.movements (business_id, store_id, product_id, type, quantity, unit_cost, batch_id, reason, note, created_by)
    select biz, p_store, p.id, 'adjust', diff, p.cost_price, batch, coalesce(nullif(trim(p_reason), ''), 'Stock count'),
      nullif(trim(p_note), ''), auth.uid()
    from public.products p where p.id = (item->>'product_id')::uuid and p.business_id = biz;
  end loop;
  return batch;
end;
$$;

-- ── Reports (run as the caller, so they only see their stores) ────────

create function public.sales_by_day(p_days int default 30, p_store uuid default null)
returns table (day date, revenue numeric, cost numeric, units numeric, orders bigint)
language sql stable security invoker set search_path = '' as $$
  select (m.created_at at time zone 'Africa/Lagos')::date,
    sum(-m.quantity * coalesce(m.unit_price, 0)),
    sum(-m.quantity * coalesce(m.unit_cost, 0)),
    sum(-m.quantity),
    count(distinct m.batch_id)
  from public.movements m
  where m.type = 'sale' and m.created_at >= now() - make_interval(days => p_days)
    and (p_store is null or m.store_id = p_store)
  group by 1 order by 1;
$$;

create function public.product_sales(p_days int default 30, p_store uuid default null)
returns table (product_id uuid, units numeric, revenue numeric, profit numeric)
language sql stable security invoker set search_path = '' as $$
  select m.product_id, sum(-m.quantity), sum(-m.quantity * coalesce(m.unit_price, 0)),
    sum(-m.quantity * (coalesce(m.unit_price, 0) - coalesce(m.unit_cost, 0)))
  from public.movements m
  where m.type = 'sale' and m.created_at >= now() - make_interval(days => p_days)
    and (p_store is null or m.store_id = p_store)
  group by 1;
$$;

create function public.store_sales(p_days int default 30)
returns table (store_id uuid, revenue numeric, profit numeric, orders bigint)
language sql stable security invoker set search_path = '' as $$
  select m.store_id, sum(-m.quantity * coalesce(m.unit_price, 0)),
    sum(-m.quantity * (coalesce(m.unit_price, 0) - coalesce(m.unit_cost, 0))), count(distinct m.batch_id)
  from public.movements m
  where m.type = 'sale' and m.created_at >= now() - make_interval(days => p_days)
  group by 1;
$$;

-- ── New accounts: join an invited business, or start a new one ───────

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  inv record;
  biz uuid;
begin
  select * into inv from public.invites
  where lower(email) = lower(new.email) and accepted_at is null
  order by created_at desc limit 1;

  if found then
    insert into public.members (user_id, business_id, role, store_id, full_name, email)
    values (new.id, inv.business_id, inv.role, inv.store_id, nullif(trim(m->>'full_name'), ''), new.email);
    update public.invites set accepted_at = now() where id = inv.id;
  else
    insert into public.businesses (name, owner_id)
    values (coalesce(nullif(trim(m->>'business_name'), ''), 'My business'), new.id)
    returning id into biz;
    insert into public.members (user_id, business_id, role, full_name, email)
    values (new.id, biz, 'owner', nullif(trim(m->>'full_name'), ''), new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row level security ────────────────────────────────────────────────

alter table public.businesses enable row level security;
alter table public.stores enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.stock_levels enable row level security;
alter table public.movements enable row level security;

create policy "members read" on public.businesses for select to authenticated
  using (id = (select public.my_business()));
create policy "owner edits" on public.businesses for update to authenticated
  using (id = (select public.my_business()) and (select public.my_role()) = 'owner');

create policy "members read" on public.stores for select to authenticated
  using (business_id = (select public.my_business()));
create policy "owner adds" on public.stores for insert to authenticated
  with check (business_id = (select public.my_business()) and (select public.my_role()) = 'owner');
create policy "owner edits" on public.stores for update to authenticated
  using (business_id = (select public.my_business()) and (select public.my_role()) = 'owner');

create policy "members read" on public.members for select to authenticated
  using (business_id = (select public.my_business()));
create policy "owner edits" on public.members for update to authenticated
  using (business_id = (select public.my_business()) and (select public.my_role()) = 'owner' and role <> 'owner')
  with check (business_id = (select public.my_business()) and role <> 'owner');
create policy "owner removes" on public.members for delete to authenticated
  using (business_id = (select public.my_business()) and (select public.my_role()) = 'owner' and role <> 'owner');

create policy "members read" on public.invites for select to authenticated
  using (business_id = (select public.my_business()));
create policy "owner invites" on public.invites for insert to authenticated
  with check (business_id = (select public.my_business()) and (select public.my_role()) = 'owner');
create policy "owner cancels" on public.invites for delete to authenticated
  using (business_id = (select public.my_business()) and (select public.my_role()) = 'owner');

create policy "members read" on public.categories for select to authenticated
  using (business_id = (select public.my_business()));
create policy "managers write" on public.categories for insert to authenticated
  with check (business_id = (select public.my_business()) and (select public.my_role()) in ('owner', 'manager'));

create policy "members read" on public.suppliers for select to authenticated
  using (business_id = (select public.my_business()));
create policy "managers add" on public.suppliers for insert to authenticated
  with check (business_id = (select public.my_business()) and (select public.my_role()) in ('owner', 'manager'));
create policy "managers edit" on public.suppliers for update to authenticated
  using (business_id = (select public.my_business()) and (select public.my_role()) in ('owner', 'manager'));

create policy "members read" on public.products for select to authenticated
  using (business_id = (select public.my_business()));
create policy "managers add" on public.products for insert to authenticated
  with check (business_id = (select public.my_business()) and (select public.my_role()) in ('owner', 'manager'));
create policy "managers edit" on public.products for update to authenticated
  using (business_id = (select public.my_business()) and (select public.my_role()) in ('owner', 'manager'));

create policy "store access" on public.stock_levels for select to authenticated
  using ((select public.can_store(store_id)));

-- The ledger is append-only: no update or delete policies.
create policy "store reads" on public.movements for select to authenticated
  using ((select public.can_store(store_id)));
create policy "store writes" on public.movements for insert to authenticated
  with check (
    business_id = (select public.my_business())
    and created_by = (select auth.uid())
    and (select public.can_store(store_id))
    and (type <> 'adjust' or (select public.my_role()) in ('owner', 'manager'))
  );

-- ── Function permissions ──────────────────────────────────────────────

revoke execute on function public.apply_movement() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.my_business() from public, anon;
revoke execute on function public.my_role() from public, anon;
revoke execute on function public.can_store(uuid) from public, anon;
revoke execute on function public.post_stock(uuid, text, jsonb, text, text, uuid, text) from public, anon;
revoke execute on function public.transfer_stock(uuid, uuid, jsonb, text) from public, anon;
revoke execute on function public.count_stock(uuid, jsonb, text, text) from public, anon;
revoke execute on function public.sales_by_day(int, uuid) from public, anon;
revoke execute on function public.product_sales(int, uuid) from public, anon;
revoke execute on function public.store_sales(int) from public, anon;
grant execute on function public.my_business(), public.my_role(), public.can_store(uuid),
  public.post_stock(uuid, text, jsonb, text, text, uuid, text), public.transfer_stock(uuid, uuid, jsonb, text),
  public.count_stock(uuid, jsonb, text, text), public.sales_by_day(int, uuid), public.product_sales(int, uuid),
  public.store_sales(int) to authenticated;
