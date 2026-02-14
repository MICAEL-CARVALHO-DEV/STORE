# Setup Supabase (7STORE) - Producao Segura

1. Crie um projeto no Supabase.
2. No SQL Editor, rode `supabase/migrations/001_schema.sql`.
3. No painel Auth > Users, crie um usuario para admin (email/senha).
4. No SQL Editor, execute `supabase/migrations/002_admin_user.sql` (troque o email, se necessario):

```sql
insert into public.admin_users (user_id, role)
select id, 'admin'
from auth.users
where email = 'admin@seu-dominio.com'
on conflict (user_id) do update set role = excluded.role;
```

5. No SQL Editor, rode `supabase/migrations/003_seed_products.sql` para popular o catalogo inicial.
6. No SQL Editor, rode `supabase/migrations/004_commerce_marketing_security.sql` (pedidos, cupons, banners, categorias, storage, rate-limit).
7. No SQL Editor, rode `supabase/migrations/005_checkout_rpc_security.sql` (RPC de checkout: `quote_cart`, `create_order_from_cart`, `cancel_order`).
8. Copie `Project URL` e `anon public key` (Project Settings > API).
9. Opcional (recomendado para producao): preencha `supabase-config.js` com URL/Key para a vitrine publica carregar direto da nuvem.
10. Abra `admin.html` e preencha URL/Key na secao `Sync Nuvem (Supabase)`.
11. Clique em `Salvar credenciais` e `Testar conexao`.
12. Em `Email admin` + `Senha admin`, faca `Login cloud admin`.
13. Clique `Testar acesso admin`.

## Pagamento (Pix) via Supabase Edge Functions (opcional)
- Existe uma funcao exemplo em `supabase/functions/create-payment` (Mercado Pago Pix).
- Para usar:
  - Defina `MP_ACCESS_TOKEN` nas variaveis do Supabase Functions.
  - Faça deploy com Supabase CLI (`supabase functions deploy create-payment`).
- Sem isso, o checkout ainda cria o pedido e deixa o pagamento como `pending`.

## Deploy na Vercel
1. Suba o projeto para um repositorio (GitHub/GitLab/Bitbucket).
2. Na Vercel, clique em `Adicionar -> Projeto` e `Importar` o repositorio.
3. Framework preset: `Other` (site estatico).
4. Deploy.
5. No Supabase (Auth -> URL Configuration):
   - `Site URL`: use a URL do seu projeto na Vercel (ex: `https://seu-site.vercel.app`).
   - `Additional Redirect URLs`: adicione a mesma URL e, se quiser, o dominio custom (quando configurar).

### SEO na Vercel (robots/sitemap)
- O projeto agora expõe:
  - `https://SEU-DOMINIO/robots.txt`
  - `https://SEU-DOMINIO/sitemap.xml`
- Para incluir URLs de produtos no sitemap, configure env vars na Vercel:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

### Supabase config (sem chave no repo)
- Para nao deixar `anonKey` hardcoded no Git, a Vercel injeta config em runtime:
  - `https://SEU-DOMINIO/api/supabase-config`
- Configure as mesmas env vars na Vercel:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

## Fluxo de uso
- Site publico: usa leitura anon de produtos ativos.
- Painel admin: exige login Supabase Auth para ler tudo e escrever.

## Importante
- Nao use `service_role` no front-end.
- Mantenha a `anon key` apenas para leitura publica + login Auth.
- As escritas ficam protegidas por RLS + JWT do usuario admin.
