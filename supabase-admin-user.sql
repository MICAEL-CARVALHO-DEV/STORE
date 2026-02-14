-- Rode este SQL depois de criar o usuario admin no Auth > Users.
-- Troque o email abaixo pelo email real do admin.

insert into public.admin_users (user_id, role)
select id, 'admin'
from auth.users
where email = 'admin@seu-dominio.com'
on conflict (user_id) do update set role = excluded.role;
