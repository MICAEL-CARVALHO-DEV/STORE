# Supabase Migrations

Ordem recomendada de execucao:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_admin_user.sql`
3. `supabase/migrations/003_seed_products.sql`

## Quando rodar cada uma

- `001_schema.sql`: primeira configuracao e mudancas estruturais (tabelas, RLS, policies).
- `002_admin_user.sql`: sempre que criar ou trocar conta admin no Auth.
- `003_seed_products.sql`: para popular ou atualizar catalogo base.

## 100% nuvem: o que significa no seu projeto

- Banco, auth e catalogo: Supabase cloud.
- Front-end ainda precisa de hospedagem para ficar publico 24/7.

## Precisa comprar host?

Nao obrigatoriamente no inicio.

Opcoes comuns:
- Vercel (free)
- Netlify (free)
- Cloudflare Pages (free)

Em producao comercial, pode migrar para plano pago conforme trafego.
