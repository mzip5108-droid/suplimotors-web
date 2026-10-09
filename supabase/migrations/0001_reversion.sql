-- ============================================================================
-- REVERSION DE 0001_esquema_inicial.sql
-- ============================================================================
-- Usar SOLO si despues de aplicar la migracion la aplicacion deja de funcionar:
-- los usuarios no ven el catalogo, no pueden iniciar sesion o el panel falla.
-- Devuelve el acceso al estado anterior en unos segundos.
--
-- QUE HACE
--   Borra las 20 politicas que crea la migracion sobre las tablas del
--   catalogo y el bucket de imagenes, y desactiva RLS en las 4 tablas del
--   catalogo (productos, variantes_producto, categorias, marcas).
--
-- QUE NO HACE, A PROPOSITO
--   No toca "perfiles", "clientes" ni "mensajes_contacto". Esas tablas ya tenian
--   RLS antes de la migracion (los sondeos anonimos devuelven 0 filas) y
--   desactivarlo EXPONDRIA datos personales de tus clientes. Si esas tablas
--   fallan, el problema no es esta migracion: revisa antes de tocar nada.
--
--   Tampoco borra las tablas nuevas ni las columnas ni los indices: no molestan
--   y "ventas"/"venta_items" pueden tener datos que no querrias perder.
--
-- COMO USARLO
--   Pegar todo en el SQL Editor de Supabase y ejecutar. Despues recargar la
--   aplicacion. Si el problema sigue, entonces no era RLS.
-- ============================================================================

-- 1) Politicas creadas por la migracion (20)
drop policy if exists "productos_select_autenticados" on public.productos;
drop policy if exists "productos_insert_admin" on public.productos;
drop policy if exists "productos_update_admin" on public.productos;
drop policy if exists "productos_delete_admin" on public.productos;
drop policy if exists "variantes_select_autenticados" on public.variantes_producto;
drop policy if exists "variantes_insert_admin" on public.variantes_producto;
drop policy if exists "variantes_update_admin" on public.variantes_producto;
drop policy if exists "variantes_delete_admin" on public.variantes_producto;
drop policy if exists "categorias_select_autenticados" on public.categorias;
drop policy if exists "categorias_insert_admin" on public.categorias;
drop policy if exists "categorias_update_admin" on public.categorias;
drop policy if exists "categorias_delete_admin" on public.categorias;
drop policy if exists "marcas_select_autenticados" on public.marcas;
drop policy if exists "marcas_insert_admin" on public.marcas;
drop policy if exists "marcas_update_admin" on public.marcas;
drop policy if exists "marcas_delete_admin" on public.marcas;
drop policy if exists "productos_storage_lectura_publica" on storage.objects;
drop policy if exists "productos_storage_insert_admin" on storage.objects;
drop policy if exists "productos_storage_update_admin" on storage.objects;
drop policy if exists "productos_storage_delete_admin" on storage.objects;

-- 2) RLS desactivado en las tablas del catalogo (las unicas que hoy estan abiertas)
alter table public.categorias disable row level security;
alter table public.marcas disable row level security;
alter table public.productos disable row level security;
alter table public.variantes_producto disable row level security;

-- ============================================================================
-- OPCIONAL: si el problema son los triggers o las funciones nuevas, descomentar.
-- No hace falta para recuperar el acceso al catalogo.
-- ============================================================================
-- drop trigger if exists perfiles_proteger_campos on public.perfiles;
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.proteger_campos_perfil();
-- drop function if exists public.handle_new_user();
-- drop function if exists public.es_admin();
-- drop function if exists public.es_superusuario();

-- Verificacion: las 4 tablas del catalogo deben quedar con rls_activo = false
select c.relname as tabla, c.relrowsecurity as rls_activo,
       count(p.policyname)::int as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.tablename = c.relname and p.schemaname = n.nspname
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relname;
