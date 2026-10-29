-- "Try it with sample data": fills an empty business with 3 stores, suppliers,
-- 36 products and 60 days of realistic receiving, sales, transfers and counts.
-- Owner only, and only while the business has no products.
create function public.load_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
declare
  biz uuid := public.my_business();
  me uuid := auth.uid();
  stores uuid[];
  sups uuid[];
  prods uuid[];
  s uuid;
  p record;
  d int;
  o int;
  i int;
  pid uuid;
  have numeric;
  qty numeric;
  ts timestamptz;
  batch uuid;
  start_at timestamptz := date_trunc('day', now()) - interval '60 days';
begin
  if biz is null or public.my_role() <> 'owner' then raise exception 'Only the owner can load sample data.'; end if;
  if exists (select 1 from public.products where business_id = biz) then
    raise exception 'Sample data can only be added to an empty business.';
  end if;

  with ins as (
    insert into public.stores (business_id, name, address, phone, color, created_at) values
      (biz, 'Ikeja', '14 Allen Avenue, Ikeja, Lagos', '0803 000 1101', '#1F5F4A', start_at),
      (biz, 'Lekki', 'Admiralty Way, Lekki Phase 1, Lagos', '0803 000 1102', '#3A6EA5', start_at),
      (biz, 'Wuse 2', 'Aminu Kano Crescent, Wuse 2, Abuja', '0803 000 1103', '#B7791F', start_at)
    returning id, name
  ) select array_agg(id order by name) into stores from ins;

  with ins as (
    insert into public.suppliers (business_id, name, contact_name, phone, email) values
      (biz, 'Mainland Distributors', 'Kunle Ade', '0802 111 2233', 'orders@mainland.example'),
      (biz, 'Apapa Wholesale', 'Grace Okon', '0805 444 5566', 'sales@apapa.example'),
      (biz, 'Northern Foods Ltd', 'Musa Bello', '0806 777 8899', 'hello@northernfoods.example'),
      (biz, 'CleanHome Supplies', 'Ifeoma Eze', '0809 123 4567', 'supply@cleanhome.example')
    returning id, name
  ) select array_agg(id order by name) into sups from ins;
  -- sups sorted: Apapa, CleanHome, Mainland, Northern

  insert into public.categories (business_id, name) values
    (biz, 'Beverages'), (biz, 'Groceries'), (biz, 'Snacks'), (biz, 'Toiletries'), (biz, 'Household'), (biz, 'Baby care');

  insert into public.products (business_id, name, sku, barcode, category_id, supplier_id, unit, cost_price, sell_price, reorder_level)
  select biz, t.name, t.sku, t.barcode,
    (select id from public.categories where business_id = biz and name = t.cat),
    sups[t.sup], t.unit, t.cost, t.price, t.reorder
  from (values
    ('Evaporated milk 160g', 'BEV-001', '6151100010015', 'Beverages', 1, 'tin', 380, 500, 24),
    ('Chocolate malt drink 400g', 'BEV-002', '6151100010022', 'Beverages', 1, 'pack', 2100, 2700, 12),
    ('Instant coffee 100g', 'BEV-003', '6151100010039', 'Beverages', 1, 'jar', 3200, 4100, 8),
    ('Black tea, 50 bags', 'BEV-004', '6151100010046', 'Beverages', 3, 'pack', 900, 1250, 10),
    ('Bottled water 75cl (12)', 'BEV-005', '6151100010053', 'Beverages', 3, 'pack', 1500, 2000, 15),
    ('Orange juice 1L', 'BEV-006', '6151100010060', 'Beverages', 1, 'carton', 1300, 1800, 12),
    ('Cola 50cl', 'BEV-007', '6151100010077', 'Beverages', 1, 'bottle', 250, 350, 48),
    ('Powdered milk 400g', 'BEV-008', '6151100010084', 'Beverages', 1, 'pack', 2600, 3300, 10),
    ('Parboiled rice 5kg', 'GRO-001', '6151100020014', 'Groceries', 4, 'bag', 7200, 8900, 10),
    ('Spaghetti 500g', 'GRO-002', '6151100020021', 'Groceries', 4, 'pack', 650, 900, 30),
    ('Vegetable oil 1L', 'GRO-003', '6151100020038', 'Groceries', 4, 'bottle', 1900, 2500, 15),
    ('Tomato paste 210g', 'GRO-004', '6151100020045', 'Groceries', 4, 'tin', 420, 600, 30),
    ('Seasoning cubes (100)', 'GRO-005', '6151100020052', 'Groceries', 4, 'pack', 1100, 1500, 12),
    ('Garri 2kg', 'GRO-006', '6151100020069', 'Groceries', 4, 'bag', 1600, 2200, 10),
    ('Semolina 1kg', 'GRO-007', '6151100020076', 'Groceries', 4, 'pack', 1250, 1700, 12),
    ('Sugar cubes 500g', 'GRO-008', '6151100020083', 'Groceries', 4, 'pack', 800, 1100, 15),
    ('Noodles, chicken (40)', 'GRO-009', '6151100020090', 'Groceries', 4, 'carton', 7800, 9500, 6),
    ('Cornflakes 500g', 'GRO-010', '6151100020106', 'Groceries', 1, 'box', 2400, 3100, 8),
    ('Plantain chips 150g', 'SNK-001', '6151100030013', 'Snacks', 1, 'pack', 350, 550, 30),
    ('Chin chin 250g', 'SNK-002', '6151100030020', 'Snacks', 1, 'pack', 600, 900, 20),
    ('Digestive biscuits', 'SNK-003', '6151100030037', 'Snacks', 1, 'pack', 700, 1000, 20),
    ('Roasted peanuts 200g', 'SNK-004', '6151100030044', 'Snacks', 3, 'jar', 900, 1300, 15),
    ('Chocolate bar 45g', 'SNK-005', '6151100030051', 'Snacks', 1, 'bar', 400, 650, 40),
    ('Bathing soap (3 pack)', 'TOI-001', '6151100040012', 'Toiletries', 2, 'pack', 900, 1300, 20),
    ('Toothpaste 140g', 'TOI-002', '6151100040029', 'Toiletries', 2, 'tube', 850, 1200, 20),
    ('Body lotion 400ml', 'TOI-003', '6151100040036', 'Toiletries', 2, 'bottle', 2300, 3200, 10),
    ('Toilet roll (10)', 'TOI-004', '6151100040043', 'Toiletries', 2, 'pack', 2500, 3300, 12),
    ('Sanitary pads (8)', 'TOI-005', '6151100040050', 'Toiletries', 2, 'pack', 750, 1100, 20),
    ('Laundry detergent 900g', 'HOU-001', '6151100050011', 'Household', 2, 'pack', 1700, 2300, 15),
    ('Dishwashing liquid 750ml', 'HOU-002', '6151100050028', 'Household', 2, 'bottle', 1100, 1600, 15),
    ('Bleach 1L', 'HOU-003', '6151100050035', 'Household', 2, 'bottle', 900, 1300, 12),
    ('Insecticide spray 300ml', 'HOU-004', '6151100050042', 'Household', 2, 'can', 1800, 2500, 10),
    ('AA batteries (4)', 'HOU-005', '6151100050059', 'Household', 3, 'pack', 1200, 1800, 10),
    ('Baby diapers, size 3 (40)', 'BAB-001', '6151100060010', 'Baby care', 2, 'pack', 6800, 8500, 8),
    ('Baby wipes (72)', 'BAB-002', '6151100060027', 'Baby care', 2, 'pack', 1300, 1900, 12),
    ('Infant cereal 400g', 'BAB-003', '6151100060034', 'Baby care', 1, 'tin', 3400, 4300, 8)
  ) as t(name, sku, barcode, cat, sup, unit, cost, price, reorder);

  select array_agg(id order by sku) into prods from public.products where business_id = biz;

  -- Opening stock at every store
  foreach s in array stores loop
    batch := gen_random_uuid();
    for p in select * from public.products where business_id = biz loop
      insert into public.movements (business_id, store_id, product_id, type, quantity, unit_cost, unit_price, batch_id, reference, reason, supplier_id, created_by, created_at)
      values (biz, s, p.id, 'receive', p.reorder_level * (3 + floor(random() * 3)), p.cost_price, p.sell_price, batch,
        'Opening stock', null, p.supplier_id, me, start_at + interval '8 hours');
    end loop;
  end loop;

  for d in 0..59 loop
    foreach s in array stores loop
      -- Sales: 5–9 orders a day, 1–3 lines each
      for o in 1..(5 + floor(random() * 5))::int loop
        batch := gen_random_uuid();
        ts := start_at + make_interval(days => d, hours => 8 + floor(random() * 12)::int, mins => floor(random() * 60)::int);
        for i in 1..(1 + floor(random() * 3))::int loop
          pid := prods[1 + floor(random() * array_length(prods, 1))::int];
          select coalesce((select quantity from public.stock_levels where store_id = s and product_id = pid), 0) into have;
          qty := least(have, 1 + floor(random() * 4));
          continue when qty <= 0;
          insert into public.movements (business_id, store_id, product_id, type, quantity, unit_cost, unit_price, batch_id, reference, created_by, created_at)
          select biz, s, pid, 'sale', -qty, cost_price, sell_price, batch, 'Sale', me, ts from public.products where id = pid;
        end loop;
      end loop;

      -- Weekly restock of anything at or below its reorder level (stops a week before today so some items run low)
      if d % 7 = 3 and d < 53 then
        batch := gen_random_uuid();
        for p in
          select pr.* from public.products pr
          left join public.stock_levels sl on sl.product_id = pr.id and sl.store_id = s
          where pr.business_id = biz and coalesce(sl.quantity, 0) <= pr.reorder_level
        loop
          insert into public.movements (business_id, store_id, product_id, type, quantity, unit_cost, unit_price, batch_id, reference, supplier_id, created_by, created_at)
          values (biz, s, p.id, 'receive', p.reorder_level * (2 + floor(random() * 2)), p.cost_price, p.sell_price, batch,
            'INV-' || (4000 + d * 3 + array_position(stores, s)), p.supplier_id, me, start_at + make_interval(days => d, hours => 7));
        end loop;
      end if;
    end loop;

    -- Every 10 days: Ikeja sends a few lines to Abuja
    if d % 10 = 5 then
      batch := gen_random_uuid();
      for i in 1..3 loop
        pid := prods[1 + floor(random() * array_length(prods, 1))::int];
        select coalesce((select quantity from public.stock_levels where store_id = stores[1] and product_id = pid), 0) into have;
        qty := floor(have / 4);
        continue when qty <= 0;
        ts := start_at + make_interval(days => d, hours => 10);
        insert into public.movements (business_id, store_id, product_id, type, quantity, unit_cost, batch_id, note, other_store_id, created_by, created_at)
        select biz, stores[1], pid, 'transfer_out', -qty, cost_price, batch, 'Weekly top-up for Abuja', stores[3], me, ts from public.products where id = pid;
        insert into public.movements (business_id, store_id, product_id, type, quantity, unit_cost, batch_id, note, other_store_id, created_by, created_at)
        select biz, stores[3], pid, 'transfer_in', qty, cost_price, batch, 'Weekly top-up for Abuja', stores[1], me, ts + interval '6 hours' from public.products where id = pid;
      end loop;
    end if;

    -- Now and then something is damaged
    if d % 13 = 6 then
      s := stores[1 + floor(random() * 3)::int];
      pid := prods[1 + floor(random() * array_length(prods, 1))::int];
      select coalesce((select quantity from public.stock_levels where store_id = s and product_id = pid), 0) into have;
      if have >= 2 then
        insert into public.movements (business_id, store_id, product_id, type, quantity, unit_cost, reason, note, created_by, created_at)
        select biz, s, pid, 'adjust', -2, cost_price, 'Damaged', 'Found broken on the shelf', me,
          start_at + make_interval(days => d, hours => 18) from public.products where id = pid;
      end if;
    end if;
  end loop;
end;
$$;

revoke execute on function public.load_demo_data() from public, anon;
grant execute on function public.load_demo_data() to authenticated;
