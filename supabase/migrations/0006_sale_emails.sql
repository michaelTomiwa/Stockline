-- Email the owner when a sale is made.
-- The app calls claim_sale_notification() right after a sale. It returns what
-- the email needs, once per sale, and only to the person who rang it up.

alter table public.businesses
  add column sale_emails boolean not null default true,
  add column sale_email_min numeric(14, 2) not null default 0 check (sale_email_min >= 0),
  add column notify_email text;

-- One row per sale that has been emailed, so a sale is never sent twice.
create table public.sale_notifications (
  batch_id uuid primary key,
  business_id uuid not null references public.businesses on delete cascade,
  sent_at timestamptz not null default now()
);
-- No policies: only claim_sale_notification touches it.
alter table public.sale_notifications enable row level security;

create function public.claim_sale_notification(p_batch uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  biz public.businesses;
  total numeric;
  store_id uuid;
begin
  -- Only the person who recorded the sale, and only within a few minutes of it.
  select m.store_id into store_id from public.movements m
  where m.batch_id = p_batch and m.type = 'sale' and m.created_by = auth.uid()
    and m.created_at > now() - interval '10 minutes'
  limit 1;
  if not found then return null; end if;

  select b.* into biz from public.businesses b where b.id = public.my_business();
  if not found or not biz.sale_emails then return null; end if;
  -- The owner doesn't need an email about their own sales.
  if biz.owner_id = auth.uid() then return null; end if;

  select sum(-m.quantity * coalesce(m.unit_price, 0)) into total from public.movements m where m.batch_id = p_batch;
  if total < biz.sale_email_min then return null; end if;

  insert into public.sale_notifications (batch_id, business_id) values (p_batch, biz.id) on conflict do nothing;
  if not found then return null; end if;

  return jsonb_build_object(
    'to', coalesce(nullif(trim(biz.notify_email), ''), (select u.email from auth.users u where u.id = biz.owner_id)),
    'business', biz.name,
    'currency', biz.currency,
    'seller', (select coalesce(m.full_name, 'A team member') from public.members m where m.user_id = auth.uid()),
    'store', (select s.name from public.stores s where s.id = store_id),
    'at', now(),
    'reference', (select m.reference from public.movements m where m.batch_id = p_batch and m.reference is not null limit 1),
    'total', total,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'name', p.name, 'unit', p.unit, 'quantity', -m.quantity, 'price', m.unit_price,
        'left', coalesce(sl.quantity, 0), 'low', coalesce(sl.quantity, 0) <= p.reorder_level
      ) order by p.name)
      from public.movements m
      join public.products p on p.id = m.product_id
      left join public.stock_levels sl on sl.store_id = m.store_id and sl.product_id = m.product_id
      where m.batch_id = p_batch
    ),
    'today_total', (
      select coalesce(sum(-m.quantity * coalesce(m.unit_price, 0)), 0) from public.movements m
      where m.business_id = biz.id and m.type = 'sale'
        and m.created_at >= date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'
    ),
    'today_orders', (
      select count(distinct m.batch_id) from public.movements m
      where m.business_id = biz.id and m.type = 'sale'
        and m.created_at >= date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'
    )
  );
end;
$$;

-- The owner's sign-in email, shown in Settings as the default address.
create function public.owner_email() returns text
language sql stable security definer set search_path = '' as $$
  select u.email from auth.users u
  join public.businesses b on b.owner_id = u.id
  where b.id = public.my_business() and public.my_role() = 'owner';
$$;

revoke execute on function public.claim_sale_notification(uuid), public.owner_email() from public, anon;
grant execute on function public.claim_sale_notification(uuid), public.owner_email() to authenticated;
