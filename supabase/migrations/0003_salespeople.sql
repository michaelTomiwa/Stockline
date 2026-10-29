-- Salespeople: accounts the owner (or a store's manager) creates for the
-- people who sell. They sign in with a username, sell at their store at the
-- set prices, and see only their own sales. Each can have a monthly target
-- and a commission rate.

-- ── Salesperson details on members ────────────────────────────────────

alter table public.members drop constraint members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('owner', 'manager', 'staff', 'sales'));
alter table public.members
  add column username text unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  add column phone text,
  add column active boolean not null default true,
  add column monthly_target numeric(14, 2) check (monthly_target >= 0),
  add column commission_rate numeric(5, 2) not null default 0 check (commission_rate between 0 and 100),
  add column added_by uuid references auth.users on delete set null;

-- A turned-off account loses access at once: every policy goes through these.
create or replace function public.my_business() returns uuid
language sql stable security definer set search_path = '' as $$
  select business_id from public.members where user_id = auth.uid() and active;
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.members where user_id = auth.uid() and active;
$$;

create or replace function public.can_store(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    join public.stores s on s.business_id = m.business_id
    where m.user_id = auth.uid() and m.active and s.id = p_store
      and (m.role = 'owner' or m.store_id is null or m.store_id = p_store)
  );
$$;

-- Owners manage every salesperson; a manager only those at their store.
create function public.can_manage_staff(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid() and m.active
      and (m.role = 'owner' or (m.role = 'manager' and (m.store_id is null or m.store_id = p_store)))
  );
$$;

-- ── Accounts without an email address ─────────────────────────────────
-- Salespeople sign in with a username; behind the scenes their login is
-- <username>@staff.stockline.invalid (a reserved domain no mail goes to).

create function public.create_login(p_username text, p_password text, p_full_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := gen_random_uuid();
  mail text := p_username || '@staff.stockline.invalid';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'stockline_staff', true),
    jsonb_build_object('full_name', p_full_name), now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (user_id, provider_id, provider, identity_data, created_at, updated_at)
  values (uid, uid::text, 'email',
    jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true, 'phone_verified', false), now(), now());
  return uid;
end;
$$;

-- The salesperson row the caller may manage, or an error.
create function public.managed_salesperson(p_user uuid) returns public.members
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.members;
begin
  select * into r from public.members
  where user_id = p_user and role = 'sales' and business_id = public.my_business();
  if not found then raise exception 'Unknown salesperson.'; end if;
  if not public.can_manage_staff(r.store_id) then raise exception 'You can''t manage this salesperson.'; end if;
  return r;
end;
$$;

create function public.check_salesperson_store(p_store uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_store is not null and not exists (select 1 from public.stores where id = p_store and business_id = public.my_business()) then
    raise exception 'Unknown store.';
  end if;
  if not public.can_manage_staff(p_store) then
    raise exception 'Only the owner or that store''s manager can put salespeople there.';
  end if;
end;
$$;

create function public.create_salesperson(
  p_full_name text, p_username text, p_password text, p_store uuid,
  p_phone text default null, p_monthly_target numeric default null, p_commission_rate numeric default 0
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  biz uuid := public.my_business();
  uname text := lower(trim(coalesce(p_username, '')));
  uid uuid;
begin
  if biz is null then raise exception 'Sign in first.'; end if;
  perform public.check_salesperson_store(p_store);
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Add their name.'; end if;
  if uname !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'Usernames are 3 to 30 letters or numbers; dots, dashes and underscores are fine.';
  end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Use at least 6 characters for the password.'; end if;
  if exists (select 1 from public.members where username = uname)
     or exists (select 1 from auth.users where email = uname || '@staff.stockline.invalid') then
    raise exception 'The username "%" is taken. Try adding their store or a number.', uname;
  end if;
  uid := public.create_login(uname, p_password, trim(p_full_name));
  insert into public.members (user_id, business_id, role, store_id, full_name, username, phone,
    monthly_target, commission_rate, added_by)
  values (uid, biz, 'sales', p_store, trim(p_full_name), uname, nullif(trim(p_phone), ''),
    nullif(p_monthly_target, 0), coalesce(p_commission_rate, 0), auth.uid());
  return uid;
end;
$$;

create function public.update_salesperson(
  p_user uuid, p_full_name text, p_store uuid,
  p_phone text default null, p_monthly_target numeric default null, p_commission_rate numeric default 0
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.managed_salesperson(p_user);
  perform public.check_salesperson_store(p_store);
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Add their name.'; end if;
  update public.members set full_name = trim(p_full_name), store_id = p_store, phone = nullif(trim(p_phone), ''),
    monthly_target = nullif(p_monthly_target, 0), commission_rate = coalesce(p_commission_rate, 0)
  where user_id = p_user;
end;
$$;

create function public.set_salesperson_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.managed_salesperson(p_user);
  if length(coalesce(p_password, '')) < 6 then raise exception 'Use at least 6 characters for the password.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where id = p_user;
end;
$$;

-- Turning someone off blocks sign-in, ends their sessions and (through
-- my_business) cuts access to data straight away. Their sales stay on record.
create function public.set_salesperson_active(p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.managed_salesperson(p_user);
  update public.members set active = p_active where user_id = p_user;
  update auth.users set banned_until = case when p_active then null else now() + interval '100 years' end
  where id = p_user;
  if not p_active then delete from auth.sessions where user_id = p_user; end if;
end;
$$;

create function public.delete_salesperson(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.managed_salesperson(p_user);
  if exists (select 1 from public.movements where created_by = p_user) then
    raise exception 'They have sales on record, so turn their account off instead. That keeps their sales history.';
  end if;
  delete from auth.users where id = p_user;
end;
$$;

-- ── Sales per person ──────────────────────────────────────────────────

create function public.sales_by_person(p_since timestamptz, p_store uuid default null)
returns table (user_id uuid, revenue numeric, cost numeric, units numeric, orders bigint)
language sql stable security invoker set search_path = '' as $$
  select m.created_by,
    sum(-m.quantity * coalesce(m.unit_price, 0)),
    sum(-m.quantity * coalesce(m.unit_cost, 0)),
    sum(-m.quantity),
    count(distinct m.batch_id)
  from public.movements m
  where m.type = 'sale' and m.created_at >= p_since
    and (p_store is null or m.store_id = p_store)
  group by 1;
$$;

create function public.person_sales_by_day(p_days int, p_person uuid)
returns table (day date, revenue numeric, cost numeric, units numeric, orders bigint)
language sql stable security invoker set search_path = '' as $$
  select (m.created_at at time zone 'Africa/Lagos')::date,
    sum(-m.quantity * coalesce(m.unit_price, 0)),
    sum(-m.quantity * coalesce(m.unit_cost, 0)),
    sum(-m.quantity),
    count(distinct m.batch_id)
  from public.movements m
  where m.type = 'sale' and m.created_by = p_person
    and m.created_at >= now() - make_interval(days => p_days)
  group by 1 order by 1;
$$;

-- ── What salespeople can see and do ───────────────────────────────────

alter policy "store reads" on public.movements
  using (
    (select public.can_store(store_id))
    and ((select public.my_role()) <> 'sales' or created_by = (select auth.uid()))
  );
alter policy "store writes" on public.movements
  with check (
    business_id = (select public.my_business())
    and created_by = (select auth.uid())
    and (select public.can_store(store_id))
    and (type <> 'adjust' or (select public.my_role()) in ('owner', 'manager'))
    and ((select public.my_role()) <> 'sales' or type = 'sale')
  );

alter policy "members read" on public.members
  using (
    business_id = (select public.my_business())
    and ((select public.my_role()) <> 'sales' or user_id = (select auth.uid()))
  );

-- Pending invites are for owners and managers only.
alter policy "members read" on public.invites
  using (business_id = (select public.my_business()) and (select public.my_role()) in ('owner', 'manager'));

-- ── Patched: sign-up, selling and transfers know about salespeople ────

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  inv record;
  biz uuid;
begin
  -- Salesperson logins are made by create_login; their member row comes from create_salesperson.
  if new.raw_app_meta_data ->> 'stockline_staff' = 'true' then
    return new;
  end if;

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

create or replace function public.post_stock(
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
  if public.my_role() = 'sales' and p_type <> 'sale' then
    raise exception 'Salespeople can only record sales.';
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
      -- Salespeople always sell at the listed price and can't change recorded costs.
      case when public.my_role() = 'sales' then p.cost_price else coalesce((item->>'unit_cost')::numeric, p.cost_price) end,
      case when public.my_role() = 'sales' then p.sell_price else coalesce((item->>'unit_price')::numeric, p.sell_price) end,
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

create or replace function public.transfer_stock(p_from uuid, p_to uuid, p_items jsonb, p_note text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  batch uuid := gen_random_uuid();
  biz uuid := public.my_business();
  item jsonb;
  qty numeric;
begin
  if biz is null then raise exception 'Sign in first.'; end if;
  if public.my_role() = 'sales' then raise exception 'Salespeople can''t move stock between stores.'; end if;
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

-- ── Function permissions ──────────────────────────────────────────────

revoke execute on function public.create_login(text, text, text), public.managed_salesperson(uuid),
  public.check_salesperson_store(uuid)
  from public, anon, authenticated;

revoke execute on function public.can_manage_staff(uuid),
  public.create_salesperson(text, text, text, uuid, text, numeric, numeric),
  public.update_salesperson(uuid, text, uuid, text, numeric, numeric),
  public.set_salesperson_password(uuid, text), public.set_salesperson_active(uuid, boolean),
  public.delete_salesperson(uuid), public.sales_by_person(timestamptz, uuid), public.person_sales_by_day(int, uuid)
  from public, anon;
grant execute on function public.can_manage_staff(uuid),
  public.create_salesperson(text, text, text, uuid, text, numeric, numeric),
  public.update_salesperson(uuid, text, uuid, text, numeric, numeric),
  public.set_salesperson_password(uuid, text), public.set_salesperson_active(uuid, boolean),
  public.delete_salesperson(uuid), public.sales_by_person(timestamptz, uuid), public.person_sales_by_day(int, uuid)
  to authenticated;
