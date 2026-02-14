  -- 004: Commerce, Marketing, Ranking, Storage

  create extension if not exists pgcrypto;

  alter table public.products
    add column if not exists brand text,
    add column if not exists sku text,
    add column if not exists cost_price numeric(12,2) default 0 check (cost_price >= 0),
    add column if not exists currency text default 'BRL';

  create index if not exists products_brand_idx on public.products (brand);
  create unique index if not exists products_sku_unique_idx on public.products (sku) where sku is not null;

  create table if not exists public.customer_addresses (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references auth.users(id) on delete cascade,
    label text,
    receiver_name text not null,
    phone text,
    zip_code text,
    street text not null,
    number text,
    complement text,
    district text,
    city text not null,
    state text not null,
    country text not null default 'BR',
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists customer_addresses_customer_idx on public.customer_addresses (customer_id);

  create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references auth.users(id) on delete restrict,
    address_id uuid references public.customer_addresses(id) on delete set null,
    status text not null default 'pending' check (status in ('pending','paid','shipped','canceled')),
    payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
    payment_method text not null default 'pix' check (payment_method in ('pix','card')),
    subtotal numeric(12,2) not null default 0,
    shipping numeric(12,2) not null default 0,
    discount_total numeric(12,2) not null default 0,
    total numeric(12,2) not null default 0,
    currency text not null default 'BRL',
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);
  create index if not exists orders_status_idx on public.orders (status);

  create table if not exists public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    product_id bigint not null references public.products(id) on delete restrict,
    product_name text not null,
    unit_price numeric(12,2) not null,
    quantity int not null check (quantity > 0),
    line_total numeric(12,2) not null,
    cost_price_snapshot numeric(12,2) not null default 0,
    created_at timestamptz not null default now()
  );

  create index if not exists order_items_order_idx on public.order_items (order_id);
  create index if not exists order_items_product_idx on public.order_items (product_id);

  create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    provider text not null default 'manual',
    provider_payment_id text,
    method text not null check (method in ('pix','card')),
    status text not null default 'pending' check (status in ('pending','paid','failed','canceled','refunded')),
    amount numeric(12,2) not null,
    raw_response jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists payments_order_idx on public.payments (order_id);

  -- In case this migration was run previously with a different CHECK list.
  alter table public.payments drop constraint if exists payments_status_check;
  alter table public.payments
    add constraint payments_status_check
    check (status in ('pending','paid','failed','canceled','refunded'));

  create table if not exists public.coupons (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    description text,
    discount_type text not null check (discount_type in ('percent','fixed')),
    discount_value numeric(12,2) not null check (discount_value >= 0),
    min_order_total numeric(12,2) not null default 0,
    max_uses int,
    used_count int not null default 0,
    starts_at timestamptz,
    ends_at timestamptz,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  );

  create table if not exists public.banners (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    subtitle text,
    image_url text,
    link_url text,
    position text not null default 'home_hero',
    starts_at timestamptz,
    ends_at timestamptz,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists public.categories (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    icon text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create or replace view public.product_ranking as
  select
    p.id,
    p.nome,
    p.categoria,
    p.brand,
    p.preco,
    p.cost_price,
    coalesce(sum(case when o.status in ('paid','shipped') then oi.quantity else 0 end), 0) as units_sold,
    coalesce(sum(case when o.status in ('paid','shipped') then oi.line_total else 0 end), 0)::numeric(12,2) as gross_revenue,
    coalesce(sum(case when o.status in ('paid','shipped') then (oi.unit_price - oi.cost_price_snapshot) * oi.quantity else 0 end), 0)::numeric(12,2) as gross_margin,
    case
      when coalesce(sum(case when o.status in ('paid','shipped') then oi.line_total else 0 end), 0) > 0
      then round((coalesce(sum(case when o.status in ('paid','shipped') then (oi.unit_price - oi.cost_price_snapshot) * oi.quantity else 0 end), 0)
        / coalesce(sum(case when o.status in ('paid','shipped') then oi.line_total else 0 end), 0))::numeric, 4)
      else 0
    end as margin_rate,
    p.stock,
    case
      when p.stock > 0 then round((coalesce(sum(case when o.status in ('paid','shipped') then oi.quantity else 0 end), 0)::numeric / p.stock::numeric), 4)
      else null
    end as turnover_ratio
  from public.products p
  left join public.order_items oi on oi.product_id = p.id
  left join public.orders o on o.id = oi.order_id
  group by p.id;

  create table if not exists public.login_attempts (
    id bigserial primary key,
    email text not null,
    attempt_at timestamptz not null default now(),
    success boolean not null default false,
    source text default 'web'
  );

  create index if not exists login_attempts_email_idx on public.login_attempts (email, attempt_at desc);

  create or replace function public.register_login_attempt(p_email text, p_success boolean)
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    insert into public.login_attempts(email, success)
    values (lower(trim(p_email)), p_success);
  end;
  $$;

  grant execute on function public.register_login_attempt(text, boolean) to anon, authenticated;

  create or replace function public.too_many_login_attempts(p_email text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select count(*) >= 6
    from public.login_attempts
    where email = lower(trim(p_email))
      and success = false
      and attempt_at > now() - interval '15 minutes';
  $$;

  grant execute on function public.too_many_login_attempts(text) to anon, authenticated;

  drop trigger if exists trg_customer_addresses_updated_at on public.customer_addresses;
  create trigger trg_customer_addresses_updated_at
  before update on public.customer_addresses
  for each row execute function public.set_updated_at();

  drop trigger if exists trg_orders_updated_at on public.orders;
  create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

  drop trigger if exists trg_payments_updated_at on public.payments;
  create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

  drop trigger if exists trg_banners_updated_at on public.banners;
  create trigger trg_banners_updated_at
  before update on public.banners
  for each row execute function public.set_updated_at();

  drop trigger if exists trg_categories_updated_at on public.categories;
  create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

  alter table public.customer_addresses enable row level security;
  alter table public.orders enable row level security;
  alter table public.order_items enable row level security;
  alter table public.payments enable row level security;
  alter table public.coupons enable row level security;
  alter table public.banners enable row level security;
  alter table public.categories enable row level security;
  alter table public.login_attempts enable row level security;

  drop policy if exists "customer_addresses_owner_select" on public.customer_addresses;
  create policy "customer_addresses_owner_select"
  on public.customer_addresses
  for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());

  drop policy if exists "customer_addresses_owner_insert" on public.customer_addresses;
  create policy "customer_addresses_owner_insert"
  on public.customer_addresses
  for insert to authenticated
  with check (customer_id = auth.uid() or public.is_admin());

  drop policy if exists "customer_addresses_owner_update" on public.customer_addresses;
  create policy "customer_addresses_owner_update"
  on public.customer_addresses
  for update to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

  drop policy if exists "customer_addresses_owner_delete" on public.customer_addresses;
  create policy "customer_addresses_owner_delete"
  on public.customer_addresses
  for delete to authenticated
  using (customer_id = auth.uid() or public.is_admin());

  drop policy if exists "orders_owner_select" on public.orders;
  create policy "orders_owner_select"
  on public.orders
  for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());

  drop policy if exists "orders_owner_insert" on public.orders;
  create policy "orders_owner_insert"
  on public.orders
  for insert to authenticated
  with check (customer_id = auth.uid() or public.is_admin());

  drop policy if exists "orders_owner_update" on public.orders;
  create policy "orders_owner_update"
  on public.orders
  for update to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

  drop policy if exists "order_items_owner_select" on public.order_items;
  create policy "order_items_owner_select"
  on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_id = auth.uid() or public.is_admin())
    )
  );

  drop policy if exists "order_items_owner_insert" on public.order_items;
  create policy "order_items_owner_insert"
  on public.order_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_id = auth.uid() or public.is_admin())
    )
  );

  drop policy if exists "order_items_owner_update" on public.order_items;
  create policy "order_items_owner_update"
  on public.order_items
  for update to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_id = auth.uid() or public.is_admin())
    )
  );

  drop policy if exists "payments_owner_select" on public.payments;
  create policy "payments_owner_select"
  on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and (o.customer_id = auth.uid() or public.is_admin())
    )
  );

  drop policy if exists "payments_owner_insert" on public.payments;
  create policy "payments_owner_insert"
  on public.payments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and (o.customer_id = auth.uid() or public.is_admin())
    )
  );

  drop policy if exists "payments_owner_update" on public.payments;
  create policy "payments_owner_update"
  on public.payments
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

  drop policy if exists "public_read_active_banners" on public.banners;
  create policy "public_read_active_banners"
  on public.banners
  for select to anon, authenticated
  using (is_active = true);

  drop policy if exists "admin_manage_banners" on public.banners;
  create policy "admin_manage_banners"
  on public.banners
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

  drop policy if exists "public_read_active_categories" on public.categories;
  create policy "public_read_active_categories"
  on public.categories
  for select to anon, authenticated
  using (is_active = true);

  drop policy if exists "admin_manage_categories" on public.categories;
  create policy "admin_manage_categories"
  on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

  drop policy if exists "admin_manage_coupons" on public.coupons;
  create policy "admin_manage_coupons"
  on public.coupons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

  drop policy if exists "no_direct_login_attempts" on public.login_attempts;
  create policy "no_direct_login_attempts"
  on public.login_attempts
  for all to anon, authenticated
  using (false)
  with check (false);

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'product-images',
    'product-images',
    true,
    10485760,
    array['image/jpeg','image/png','image/webp','image/avif']
  )
  on conflict (id) do nothing;

  drop policy if exists "public_read_product_images" on storage.objects;
  create policy "public_read_product_images"
  on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

  drop policy if exists "admin_upload_product_images" on storage.objects;
  create policy "admin_upload_product_images"
  on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

  drop policy if exists "admin_update_product_images" on storage.objects;
  create policy "admin_update_product_images"
  on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

  drop policy if exists "admin_delete_product_images" on storage.objects;
  create policy "admin_delete_product_images"
  on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
