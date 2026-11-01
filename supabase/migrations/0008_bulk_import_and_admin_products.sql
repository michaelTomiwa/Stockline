-- Bulk product import (paste from a spreadsheet) for owners and managers,
-- and the same for Stockline admins helping a business, plus admin views and
-- price edits for any business's products.

-- The shared worker: create or update products by SKU, make categories as
-- needed, and put opening stock into one store as a single delivery.
-- p_rows: [{ name, sku?, category?, unit?, cost?, price, reorder?, size?, color?, barcode?, qty? }]
create function public.import_products_into(p_business uuid, p_rows jsonb, p_store uuid, p_actor uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  i int := 0;
  created int := 0;
  updated int := 0;
  stocked int := 0;
  errors jsonb := '[]';
  pname text;
  psku text;
  cat_id uuid;
  pid uuid;
  existing uuid;
  q numeric;
  batch uuid := gen_random_uuid();
  seq int;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'Nothing to import.'; end if;
  if jsonb_array_length(p_rows) > 1000 then raise exception 'Import at most 1,000 rows at a time.'; end if;
  if p_store is not null and not exists (select 1 from public.stores where id = p_store and business_id = p_business) then
    raise exception 'Unknown store.';
  end if;
  select count(*) into seq from public.products where business_id = p_business;

  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      pname := nullif(trim(r->>'name'), '');
      if pname is null then raise exception 'name is empty'; end if;
      if coalesce(nullif(r->>'price', ''), '0')::numeric < 0 or coalesce(nullif(r->>'cost', ''), '0')::numeric < 0 then
        raise exception 'price and cost can''t be negative';
      end if;
      -- Name + size + colour, the same way the app names sizes/colours.
      pname := concat_ws(' · ', pname, nullif(trim(r->>'size'), ''), nullif(trim(r->>'color'), ''));

      cat_id := null;
      if nullif(trim(r->>'category'), '') is not null then
        insert into public.categories (business_id, name) values (p_business, trim(r->>'category'))
        on conflict (business_id, name) do nothing;
        select id into cat_id from public.categories where business_id = p_business and name = trim(r->>'category');
      end if;

      psku := upper(nullif(trim(r->>'sku'), ''));
      existing := null;
      if psku is not null then
        select id into existing from public.products where business_id = p_business and sku = psku;
      else
        -- No SKU: reuse a product with the same name, or make a SKU.
        select id into existing from public.products where business_id = p_business and lower(name) = lower(pname) and not archived limit 1;
        if existing is null then
          loop
            seq := seq + 1;
            psku := upper(coalesce(left(regexp_replace(coalesce(r->>'category', pname), '[^A-Za-z]', '', 'g'), 3), 'PRD')) || '-' || lpad(seq::text, 4, '0');
            exit when not exists (select 1 from public.products where business_id = p_business and sku = psku);
          end loop;
        end if;
      end if;

      if existing is null then
        insert into public.products (business_id, name, sku, barcode, category_id, unit, cost_price, sell_price, reorder_level, size, color)
        values (p_business, pname, psku, nullif(trim(r->>'barcode'), ''), cat_id,
          coalesce(nullif(trim(r->>'unit'), ''), 'pcs'),
          coalesce(nullif(r->>'cost', '')::numeric, 0), coalesce(nullif(r->>'price', '')::numeric, 0),
          coalesce(nullif(r->>'reorder', '')::numeric, 5),
          nullif(trim(r->>'size'), ''), nullif(trim(r->>'color'), ''))
        returning id into pid;
        created := created + 1;
      else
        -- Existing product: update what the sheet gives (handy for bulk price changes).
        update public.products set
          name = pname,
          category_id = coalesce(cat_id, category_id),
          unit = coalesce(nullif(trim(r->>'unit'), ''), unit),
          cost_price = coalesce(nullif(r->>'cost', '')::numeric, cost_price),
          sell_price = coalesce(nullif(r->>'price', '')::numeric, sell_price),
          reorder_level = coalesce(nullif(r->>'reorder', '')::numeric, reorder_level),
          barcode = coalesce(nullif(trim(r->>'barcode'), ''), barcode),
          archived = false
        where id = existing
        returning id into pid;
        updated := updated + 1;
      end if;

      q := coalesce(nullif(r->>'qty', '')::numeric, 0);
      if q > 0 and p_store is not null then
        insert into public.movements (business_id, store_id, product_id, type, quantity, unit_cost, unit_price, batch_id, reference, created_by)
        select p_business, p_store, p.id, 'receive', q, p.cost_price, p.sell_price, batch, 'Imported stock', p_actor
        from public.products p where p.id = pid;
        stocked := stocked + 1;
      end if;
    exception when others then
      errors := errors || jsonb_build_object('row', i, 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('created', created, 'updated', updated, 'stocked', stocked, 'errors', errors);
end;
$$;

-- Owners and managers import into their own business.
create function public.import_products(p_rows jsonb, p_store uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() not in ('owner', 'manager') then raise exception 'Only owners and managers can import products.'; end if;
  if p_store is not null and not public.can_store(p_store) then raise exception 'You don''t have access to that store.'; end if;
  return public.import_products_into(public.my_business(), p_rows, p_store, auth.uid());
end;
$$;

-- Stockline admins import for any business.
create function public.admin_import_products(p_business uuid, p_rows jsonb, p_store uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_platform_admin();
  if not exists (select 1 from public.businesses where id = p_business) then raise exception 'Unknown business.'; end if;
  return public.import_products_into(p_business, p_rows, p_store, auth.uid());
end;
$$;

-- An admin's view of a business's catalogue, with stock per store.
create function public.admin_products(p_business uuid)
returns table (id uuid, name text, sku text, category text, unit text, cost_price numeric, sell_price numeric,
  reorder_level numeric, size text, color text, archived boolean, stock jsonb, total numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_platform_admin();
  return query
  select p.id, p.name, p.sku, c.name, p.unit, p.cost_price, p.sell_price, p.reorder_level, p.size, p.color, p.archived,
    coalesce((select jsonb_object_agg(sl.store_id, sl.quantity) from public.stock_levels sl where sl.product_id = p.id), '{}'),
    coalesce((select sum(sl.quantity) from public.stock_levels sl where sl.product_id = p.id), 0)
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.business_id = p_business
  order by p.archived, c.name nulls last, p.name;
end;
$$;

-- An admin fixing a product's name or prices.
create function public.admin_update_product(p_id uuid, p_name text default null, p_cost numeric default null, p_price numeric default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_platform_admin();
  if p_cost < 0 or p_price < 0 then raise exception 'Prices can''t be negative.'; end if;
  update public.products set
    name = coalesce(nullif(trim(p_name), ''), name),
    cost_price = coalesce(p_cost, cost_price),
    sell_price = coalesce(p_price, sell_price)
  where id = p_id;
  if not found then raise exception 'Unknown product.'; end if;
end;
$$;

revoke execute on function public.import_products_into(uuid, jsonb, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.import_products(jsonb, uuid), public.admin_import_products(uuid, jsonb, uuid),
  public.admin_products(uuid), public.admin_update_product(uuid, text, numeric, numeric) from public, anon;
grant execute on function public.import_products(jsonb, uuid), public.admin_import_products(uuid, jsonb, uuid),
  public.admin_products(uuid), public.admin_update_product(uuid, text, numeric, numeric) to authenticated;
