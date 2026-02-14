-- Execute no SQL Editor do Supabase

create table if not exists public.products (
  id bigint primary key,
  nome text not null,
  categoria text not null,
  preco numeric(12,2) not null check (preco >= 0),
  preco_original numeric(12,2),
  desconto integer,
  imagem text not null,
  descricao text not null,
  popularity_score integer not null default 0,
  stock integer not null default 0,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_categoria_idx on public.products (categoria);
create index if not exists products_is_active_idx on public.products (is_active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- Tabela de administradores autenticados no Supabase Auth
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

alter table public.products enable row level security;
alter table public.admin_users enable row level security;

-- Leitura publica apenas de produtos ativos
-- (site publico pode usar anon key sem login)
drop policy if exists "public_read_active_products" on public.products;
create policy "public_read_active_products"
on public.products
for select
to anon, authenticated
using (is_active = true);

-- Admin autenticado pode ver tudo e alterar catalogo
drop policy if exists "admin_select_all_products" on public.products;
create policy "admin_select_all_products"
on public.products
for select
to authenticated
using (public.is_admin());

drop policy if exists "admin_insert_products" on public.products;
create policy "admin_insert_products"
on public.products
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admin_update_products" on public.products;
create policy "admin_update_products"
on public.products
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_delete_products" on public.products;
create policy "admin_delete_products"
on public.products
for delete
to authenticated
using (public.is_admin());

-- Usuario autenticado pode consultar apenas sua propria linha de admin
-- (insercao na admin_users deve ser feita pelo SQL Editor/service role)
drop policy if exists "admin_user_can_read_own_role" on public.admin_users;
create policy "admin_user_can_read_own_role"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());
