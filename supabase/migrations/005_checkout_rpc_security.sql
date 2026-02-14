-- 005: Checkout RPC + tighter RLS for orders/payments/order_items
-- Execute via Supabase SQL Editor (migrations flow).

create or replace function public.quote_cart(
  items jsonb,
  coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 50;
  v_discount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_coupon record;
  v_item record;
  v_qty int;
  v_product record;
begin
  if v_uid is null then
    raise exception 'Login obrigatorio.';
  end if;

  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Carrinho vazio.';
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(items) as x(product_id bigint, quantity int)
  loop
    v_qty := coalesce(v_item.quantity, 0);
    if v_item.product_id is null or v_qty <= 0 then
      raise exception 'Item invalido no carrinho.';
    end if;

    select id, nome, preco, stock, is_active
    into v_product
    from public.products
    where id = v_item.product_id;

    if not found or v_product.is_active is false then
      raise exception 'Produto nao encontrado ou inativo.';
    end if;

    if coalesce(v_product.stock, 0) < v_qty then
      raise exception 'Sem estoque para %.', v_product.nome;
    end if;

    v_subtotal := v_subtotal + (v_product.preco * v_qty);
  end loop;

  if coupon_code is not null and length(trim(coupon_code)) > 0 then
    select *
    into v_coupon
    from public.coupons c
    where lower(c.code) = lower(trim(coupon_code))
      and c.is_active = true
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at >= now())
    limit 1;

    if not found then
      raise exception 'Cupom invalido.';
    end if;

    if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
      raise exception 'Cupom esgotado.';
    end if;

    if v_subtotal < v_coupon.min_order_total then
      raise exception 'Cupom exige subtotal minimo.';
    end if;

    if v_coupon.discount_type = 'percent' then
      v_discount := round((v_subtotal * (v_coupon.discount_value / 100.0))::numeric, 2);
    else
      v_discount := least(v_coupon.discount_value, v_subtotal);
    end if;
  end if;

  v_total := v_subtotal + v_shipping - v_discount;

  return jsonb_build_object(
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'discount', v_discount,
    'total', v_total,
    'currency', 'BRL'
  );
end;
$$;

grant execute on function public.quote_cart(jsonb, text) to authenticated;

create or replace function public.create_order_from_cart(
  items jsonb,
  address_id uuid default null,
  coupon_code text default null,
  payment_method text default 'pix'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 50;
  v_discount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_coupon record;
  v_coupon_id uuid := null;
  v_item record;
  v_qty int;
  v_product record;
begin
  if v_uid is null then
    raise exception 'Login obrigatorio.';
  end if;

  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Carrinho vazio.';
  end if;

  if payment_method not in ('pix','card') then
    raise exception 'Metodo de pagamento invalido.';
  end if;

  if address_id is not null then
    if not exists (
      select 1
      from public.customer_addresses a
      where a.id = address_id
        and (a.customer_id = v_uid or public.is_admin())
    ) then
      raise exception 'Endereco invalido.';
    end if;
  end if;

  -- Lock products first and compute subtotal.
  for v_item in
    select *
    from jsonb_to_recordset(items) as x(product_id bigint, quantity int)
  loop
    v_qty := coalesce(v_item.quantity, 0);
    if v_item.product_id is null or v_qty <= 0 then
      raise exception 'Item invalido no carrinho.';
    end if;

    select id, nome, preco, cost_price, stock, is_active
    into v_product
    from public.products
    where id = v_item.product_id
    for update;

    if not found or v_product.is_active is false then
      raise exception 'Produto nao encontrado ou inativo.';
    end if;

    if coalesce(v_product.stock, 0) < v_qty then
      raise exception 'Sem estoque para %.', v_product.nome;
    end if;

    v_subtotal := v_subtotal + (v_product.preco * v_qty);
  end loop;

  -- Coupon validation (optional).
  if coupon_code is not null and length(trim(coupon_code)) > 0 then
    select *
    into v_coupon
    from public.coupons c
    where lower(c.code) = lower(trim(coupon_code))
      and c.is_active = true
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at >= now())
    for update
    limit 1;

    if not found then
      raise exception 'Cupom invalido.';
    end if;

    v_coupon_id := v_coupon.id;

    if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
      raise exception 'Cupom esgotado.';
    end if;

    if v_subtotal < v_coupon.min_order_total then
      raise exception 'Cupom exige subtotal minimo.';
    end if;

    if v_coupon.discount_type = 'percent' then
      v_discount := round((v_subtotal * (v_coupon.discount_value / 100.0))::numeric, 2);
    else
      v_discount := least(v_coupon.discount_value, v_subtotal);
    end if;
  end if;

  v_total := v_subtotal + v_shipping - v_discount;

  insert into public.orders (
    customer_id,
    address_id,
    status,
    payment_status,
    payment_method,
    subtotal,
    shipping,
    discount_total,
    total,
    currency
  )
  values (
    v_uid,
    address_id,
    'pending',
    'pending',
    payment_method,
    v_subtotal,
    v_shipping,
    v_discount,
    v_total,
    'BRL'
  )
  returning id into v_order_id;

  -- Insert items and decrement stock.
  for v_item in
    select *
    from jsonb_to_recordset(items) as x(product_id bigint, quantity int)
  loop
    v_qty := coalesce(v_item.quantity, 0);

    select id, nome, preco, cost_price
    into v_product
    from public.products
    where id = v_item.product_id
    for update;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      unit_price,
      quantity,
      line_total,
      cost_price_snapshot
    )
    values (
      v_order_id,
      v_product.id,
      v_product.nome,
      v_product.preco,
      v_qty,
      (v_product.preco * v_qty),
      coalesce(v_product.cost_price, 0)
    );

    update public.products
    set stock = stock - v_qty
    where id = v_product.id;
  end loop;

  if v_coupon_id is not null then
    update public.coupons
    set used_count = used_count + 1
    where id = v_coupon_id;
  end if;

  insert into public.payments (order_id, provider, method, status, amount)
  values (v_order_id, 'manual', payment_method, 'pending', v_total);

  return jsonb_build_object(
    'order_id', v_order_id,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'discount', v_discount,
    'total', v_total,
    'currency', 'BRL',
    'status', 'pending',
    'payment_status', 'pending'
  );
end;
$$;

grant execute on function public.create_order_from_cart(jsonb, uuid, text, text) to authenticated;

create or replace function public.cancel_order(order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Login obrigatorio.';
  end if;

  update public.orders
  set status = 'canceled', updated_at = now()
  where id = cancel_order.order_id
    and customer_id = v_uid
    and status = 'pending'
    and payment_status = 'pending';

  if not found then
    raise exception 'Pedido nao pode ser cancelado.';
  end if;

  return true;
end;
$$;

grant execute on function public.cancel_order(uuid) to authenticated;

-- Tighten RLS: customers can only SELECT their orders/items/payments.
-- Mutations happen via RPC (security definer) or by admin.

-- Orders
drop policy if exists "orders_owner_insert" on public.orders;
drop policy if exists "orders_owner_update" on public.orders;
drop policy if exists "admin_manage_orders" on public.orders;

create policy "admin_manage_orders"
on public.orders
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Order items
drop policy if exists "order_items_owner_insert" on public.order_items;
drop policy if exists "order_items_owner_update" on public.order_items;
drop policy if exists "admin_manage_order_items" on public.order_items;

create policy "admin_manage_order_items"
on public.order_items
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Payments
drop policy if exists "payments_owner_insert" on public.payments;
drop policy if exists "payments_owner_update" on public.payments;
drop policy if exists "admin_manage_payments" on public.payments;

create policy "admin_manage_payments"
on public.payments
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
