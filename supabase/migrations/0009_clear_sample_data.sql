-- Remove the "Explore with sample data" stores, sales and products from a business
-- that has since started using Stockline for real.
-- Sample stores are recognised by name + phone, sample products by their 61511000… barcodes,
-- sample suppliers by their .example emails. Real data is never touched:
--   * a sample product the owner has also used in a real store is kept;
--   * other sample products are archived (hidden, reversible), not deleted;
--   * sample stores are deleted with their (fake) movements and stock.

create or replace function public._sample_scope(biz uuid)
returns table (stores uuid[], products uuid[], suppliers uuid[])
language sql stable security definer set search_path = '' as $$
  with ds as (
    select id from public.stores
    where business_id = biz
      and (name, coalesce(phone, '')) in (('Ikeja', '0803 000 1101'), ('Lekki', '0803 000 1102'), ('Wuse 2', '0803 000 1103'))
  )
  select
    coalesce((select array_agg(id) from ds), '{}'),
    coalesce((select array_agg(p.id) from public.products p
      where p.business_id = biz and not p.archived and p.barcode like '61511000%'
        and not exists (select 1 from public.movements m where m.product_id = p.id and m.store_id not in (select id from ds))), '{}'),
    coalesce((select array_agg(id) from public.suppliers where business_id = biz and email like '%.example'), '{}')
$$;
revoke all on function public._sample_scope(uuid) from public, anon, authenticated;

create or replace function public.sample_data_summary() returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  biz uuid := public.my_business();
  sc record;
begin
  if biz is null or public.my_role() <> 'owner' then return null; end if;
  select * into sc from public._sample_scope(biz);
  if cardinality(sc.stores) = 0 and cardinality(sc.products) = 0 then return null; end if;
  return json_build_object(
    'stores', (select coalesce(json_agg(name order by name), '[]') from public.stores where id = any(sc.stores)),
    'products', cardinality(sc.products),
    'movements', (select count(*) from public.movements where store_id = any(sc.stores)),
    'suppliers', cardinality(sc.suppliers)
  );
end $$;
grant execute on function public.sample_data_summary() to authenticated;

create or replace function public._clear_sample(biz uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare
  sc record;
  n_moves int;
  n_stores int;
  n_products int;
  n_sups int;
begin
  select * into sc from public._sample_scope(biz);
  select count(*) into n_moves from public.movements where store_id = any(sc.stores);

  -- The four sample salespeople (Tolu, Chinedu, Amaka, Yusuf) can no longer sign in.
  update public.members set active = false
  where business_id = biz and role = 'sales' and store_id = any(sc.stores)
    and phone in ('0812 300 4411', '0813 300 4412', '0814 300 4413', '0815 300 4414');

  delete from public.sale_payments where store_id = any(sc.stores);
  delete from public.cash_ups where store_id = any(sc.stores);
  delete from public.expenses where store_id = any(sc.stores);
  delete from public.stores where id = any(sc.stores);   -- cascades movements + stock levels
  get diagnostics n_stores = row_count;

  update public.products set archived = true where id = any(sc.products);
  get diagnostics n_products = row_count;

  delete from public.suppliers s where s.id = any(sc.suppliers)
    and not exists (select 1 from public.products p where p.supplier_id = s.id and not p.archived)
    and not exists (select 1 from public.movements m where m.supplier_id = s.id);
  get diagnostics n_sups = row_count;

  return json_build_object('stores', n_stores, 'movements', n_moves, 'products', n_products, 'suppliers', n_sups);
end $$;
revoke all on function public._clear_sample(uuid) from public, anon, authenticated;

create or replace function public.clear_sample_data() returns json
language plpgsql security definer set search_path = '' as $$
begin
  if public.my_business() is null or public.my_role() <> 'owner' then raise exception 'Only the owner can remove sample data.'; end if;
  return public._clear_sample(public.my_business());
end $$;
grant execute on function public.clear_sample_data() to authenticated;

-- A Stockline admin can do it for a business they're helping.
create or replace function public.admin_clear_sample_data(p_business uuid) returns json
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_platform_admin();
  return public._clear_sample(p_business);
end $$;
grant execute on function public.admin_clear_sample_data(uuid) to authenticated;
revoke execute on function public.clear_sample_data() from anon;
revoke execute on function public.admin_clear_sample_data(uuid) from anon;
revoke execute on function public.sample_data_summary() from anon;
