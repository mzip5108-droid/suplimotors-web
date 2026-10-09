-- ============================================================================
-- SUPLI MOTORS - MIGRACIÓN 0001: ESQUEMA INICIAL + SEGURIDAD (RLS)
-- ============================================================================
-- Archivo único, IDEMPOTENTE y NO DESTRUCTIVO.
-- Se puede pegar tantas veces como se quiera en el SQL Editor: no borra datos,
-- no borra tablas, no borra columnas y no ejecuta TRUNCATE.
--
-- Orden del archivo:
--   1) Extensiones / utilidades
--   2) Tablas existentes (create table if not exists + alter add column if not exists)
--   3) Tablas nuevas (ventas y venta_items)
--   4) Índices
--   5) Funciones helper (es_admin / es_superusuario)
--   6) Triggers (handle_new_user + protección de perfiles)
--   7) RLS y políticas
--   8) Storage (bucket "productos")
--   9) Instrucciones para el dueño (al final del archivo)
-- ============================================================================


-- ============================================================================
-- 1) EXTENSIONES / UTILIDADES
-- ============================================================================

-- gen_random_uuid() viene incluido en PostgreSQL 13+ (pgcrypto se activa por si
-- el proyecto es más antiguo).
create extension if not exists pgcrypto;

-- Nota: public.es_admin() y public.es_superusuario() se definen más abajo, en la
-- sección 5, porque necesitan que la tabla public.perfiles ya exista.


-- ============================================================================
-- 2) TABLAS EXISTENTES (catálogo, perfiles, clientes, contacto)
--    create table if not exists  ->  no toca la tabla si ya existe
--    alter table ... add column if not exists  ->  agrega sólo lo que falte
--    (por eso NO se usa "not null" sin default en columnas nuevas sobre tablas
--     que ya tienen filas: fallaría y rompería la migración)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2.1) categorias
-- ---------------------------------------------------------------------------
create table if not exists public.categorias (
    id      uuid primary key default gen_random_uuid(),
    nombre  text not null,
    icono   text,
    activa  boolean not null default true
);

alter table public.categorias add column if not exists nombre text;
alter table public.categorias add column if not exists icono  text;
alter table public.categorias add column if not exists activa boolean default true;

-- Único sin distinguir mayúsculas (el código hace obtenerOCrear por nombre)
create unique index if not exists categorias_nombre_lower_uidx
    on public.categorias (lower(nombre));

-- ---------------------------------------------------------------------------
-- 2.2) marcas
-- ---------------------------------------------------------------------------
create table if not exists public.marcas (
    id      uuid primary key default gen_random_uuid(),
    nombre  text not null,
    activa  boolean not null default true
);

alter table public.marcas add column if not exists nombre text;
alter table public.marcas add column if not exists activa boolean default true;

create unique index if not exists marcas_nombre_lower_uidx
    on public.marcas (lower(nombre));

-- ---------------------------------------------------------------------------
-- 2.3) productos
-- ---------------------------------------------------------------------------
create table if not exists public.productos (
    id          uuid primary key default gen_random_uuid(),
    codigo      text,
    nombre      text,
    descripcion text,
    precio_base numeric(12,2) default 0,
    imagen_url  text,
    activo      boolean not null default true,
    destacado   boolean not null default false,
    descuento   numeric(12,2) default 0,
    categoria_id uuid,
    marca_id     uuid,
    created_at  timestamptz not null default now()
);

alter table public.productos add column if not exists codigo       text;
alter table public.productos add column if not exists nombre       text;
alter table public.productos add column if not exists descripcion  text;
alter table public.productos add column if not exists precio_base  numeric(12,2) default 0;
alter table public.productos add column if not exists imagen_url   text;
alter table public.productos add column if not exists activo       boolean default true;
alter table public.productos add column if not exists destacado    boolean default false;
alter table public.productos add column if not exists descuento    numeric(12,2) default 0;
alter table public.productos add column if not exists categoria_id uuid;
alter table public.productos add column if not exists marca_id     uuid;
alter table public.productos add column if not exists created_at   timestamptz default now();

-- ---------------------------------------------------------------------------
-- 2.4) variantes_producto
-- ---------------------------------------------------------------------------
create table if not exists public.variantes_producto (
    id           uuid primary key default gen_random_uuid(),
    producto_id  uuid,
    sku          text,
    atributos    jsonb default '{}'::jsonb,
    precio       numeric(12,2),
    stock        integer default 0,
    stock_minimo integer default 5,
    activo       boolean not null default true
);

alter table public.variantes_producto add column if not exists producto_id  uuid;
alter table public.variantes_producto add column if not exists sku          text;
alter table public.variantes_producto add column if not exists atributos    jsonb default '{}'::jsonb;
alter table public.variantes_producto add column if not exists precio       numeric(12,2);
alter table public.variantes_producto add column if not exists stock        integer default 0;
alter table public.variantes_producto add column if not exists stock_minimo integer default 5;
alter table public.variantes_producto add column if not exists activo       boolean default true;

-- ---------------------------------------------------------------------------
-- 2.5) perfiles
--      (el frontend lee perfil.email en el panel de usuarios:
--       app.js usa perfil.email para mostrar el correo del usuario)
-- ---------------------------------------------------------------------------
create table if not exists public.perfiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    nombre       text,
    email        text,
    rol          text not null default 'cliente',
    activo       boolean not null default true,
    ultimo_login timestamptz,
    created_at   timestamptz not null default now()
);

alter table public.perfiles add column if not exists nombre       text;
alter table public.perfiles add column if not exists email        text;
alter table public.perfiles add column if not exists rol          text default 'cliente';
alter table public.perfiles add column if not exists activo       boolean default true;
alter table public.perfiles add column if not exists ultimo_login timestamptz;
alter table public.perfiles add column if not exists created_at   timestamptz default now();

-- Validación del rol: sólo se permiten estos tres valores.
-- Se agrega con un DO / IF NOT EXISTS para poder re-ejecutar el archivo sin error.
-- Si ya existen roles distintos en producción, la migración NO se cae: avisa por
-- consola y omite la restricción (revisá el aviso y corregí esos roles a mano).
do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'perfiles_rol_check'
    ) then
        if exists (
            select 1 from public.perfiles
            where rol is null or rol not in ('cliente', 'admin', 'superusuario')
        ) then
            raise warning 'perfiles: hay filas con rol nulo o distinto de cliente/admin/superusuario. Se omite la restriccion perfiles_rol_check. Corregilas y volve a pegar este archivo.';
        else
            alter table public.perfiles
                add constraint perfiles_rol_check
                check (rol in ('cliente', 'admin', 'superusuario'));
        end if;
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2.6) clientes
-- ---------------------------------------------------------------------------
create table if not exists public.clientes (
    id         uuid primary key references auth.users(id) on delete cascade,
    cedula     text,
    nombre     text,
    telefono   text,
    email      text,
    direccion  text,
    activo     boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.clientes add column if not exists cedula     text;
alter table public.clientes add column if not exists nombre     text;
alter table public.clientes add column if not exists telefono   text;
alter table public.clientes add column if not exists email      text;
alter table public.clientes add column if not exists direccion  text;
alter table public.clientes add column if not exists activo     boolean default true;
alter table public.clientes add column if not exists created_at timestamptz default now();

-- Cédula única. El operador de la Edge Function admin-create-user busca por
-- cedula con .maybeSingle(), por lo que la unicidad es necesaria.
-- Se protege con un DO: si ya existen cédulas duplicadas en producción, no se
-- crea el índice y se avisa por consola en vez de romper toda la migración.
do $$
begin
    if not exists (
        select 1 from pg_indexes
        where schemaname = 'public' and indexname = 'clientes_cedula_uidx'
    ) then
        if exists (
            select 1
            from public.clientes
            where cedula is not null
            group by cedula
            having count(*) > 1
        ) then
            raise warning 'clientes: hay cedulas duplicadas. Se omite el indice unico clientes_cedula_uidx. Limpia los duplicados y vuelve a pegar este archivo.';
        else
            create unique index clientes_cedula_uidx on public.clientes (cedula);
        end if;
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2.7) mensajes_contacto
-- ---------------------------------------------------------------------------
create table if not exists public.mensajes_contacto (
    id         uuid primary key default gen_random_uuid(),
    nombre     text,
    email      text,
    telefono   text,
    asunto     text,
    mensaje    text,
    leido      boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.mensajes_contacto add column if not exists nombre     text;
alter table public.mensajes_contacto add column if not exists email      text;
alter table public.mensajes_contacto add column if not exists telefono   text;
alter table public.mensajes_contacto add column if not exists asunto     text;
alter table public.mensajes_contacto add column if not exists mensaje    text;
alter table public.mensajes_contacto add column if not exists leido      boolean default false;
alter table public.mensajes_contacto add column if not exists created_at timestamptz default now();


-- ============================================================================
-- 3) TABLAS NUEVAS (reemplazan el historial de ventas del localStorage)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 3.1) ventas
--      numero: identity always -> número de pedido legible y consecutivo.
--      Aunque la tabla ya exista, se garantiza la columna y su secuencia.
-- ---------------------------------------------------------------------------
create table if not exists public.ventas (
    id             uuid primary key default gen_random_uuid(),
    numero         bigint generated always as identity,
    cliente_id     uuid references public.clientes(id) on delete set null,
    cedula         text not null,
    nombre_cliente text not null,
    email          text,
    telefono       text,
    direccion      text,
    notas          text,
    total          numeric(12,2) not null default 0,
    estado         text not null default 'pendiente'
                   check (estado in ('pendiente', 'confirmada', 'entregada', 'cancelada')),
    creado_por     uuid references auth.users(id) on delete set null,
    created_at     timestamptz not null default now()
);

-- Si la tabla ya existía sin la columna numero, se agrega con su identity.
alter table public.ventas add column if not exists numero bigint generated always as identity;
alter table public.ventas add column if not exists cliente_id     uuid;
alter table public.ventas add column if not exists cedula         text;
alter table public.ventas add column if not exists nombre_cliente text;
alter table public.ventas add column if not exists email          text;
alter table public.ventas add column if not exists telefono       text;
alter table public.ventas add column if not exists direccion      text;
alter table public.ventas add column if not exists notas          text;
alter table public.ventas add column if not exists total          numeric(12,2) default 0;
alter table public.ventas add column if not exists estado         text default 'pendiente';
alter table public.ventas add column if not exists creado_por     uuid;
alter table public.ventas add column if not exists created_at     timestamptz default now();

-- ---------------------------------------------------------------------------
-- 3.2) venta_items
-- ---------------------------------------------------------------------------
create table if not exists public.venta_items (
    id              uuid primary key default gen_random_uuid(),
    venta_id        uuid not null references public.ventas(id) on delete cascade,
    producto_id     uuid references public.productos(id) on delete set null,
    variante_id     uuid references public.variantes_producto(id) on delete set null,
    codigo          text,
    nombre          text not null,
    precio_unitario numeric(12,2) not null,
    cantidad        integer not null check (cantidad > 0),
    subtotal        numeric(12,2) not null
);

alter table public.venta_items add column if not exists venta_id        uuid;
alter table public.venta_items add column if not exists producto_id     uuid;
alter table public.venta_items add column if not exists variante_id     uuid;
alter table public.venta_items add column if not exists codigo          text;
alter table public.venta_items add column if not exists nombre          text;
alter table public.venta_items add column if not exists precio_unitario numeric(12,2);
alter table public.venta_items add column if not exists cantidad        integer;
alter table public.venta_items add column if not exists subtotal        numeric(12,2);


-- ============================================================================
-- 4) ÍNDICES
--    Todos con "if not exists": se pueden re-ejecutar sin problema.
-- ============================================================================

-- Catálogo
create index if not exists productos_categoria_id_idx on public.productos (categoria_id);
create index if not exists productos_marca_id_idx     on public.productos (marca_id);
create index if not exists productos_activo_idx       on public.productos (activo);
create index if not exists productos_created_at_idx   on public.productos (created_at desc);

create index if not exists variantes_producto_producto_id_idx on public.variantes_producto (producto_id);
create index if not exists variantes_producto_sku_idx         on public.variantes_producto (sku);

-- Personas
create index if not exists perfiles_rol_idx        on public.perfiles (rol);
create index if not exists perfiles_activo_idx     on public.perfiles (activo);
create index if not exists clientes_nombre_idx     on public.clientes (nombre);
create index if not exists clientes_telefono_idx   on public.clientes (telefono);

-- Contacto
create index if not exists mensajes_contacto_leido_idx      on public.mensajes_contacto (leido);
create index if not exists mensajes_contacto_created_at_idx on public.mensajes_contacto (created_at desc);

-- Ventas
create index if not exists ventas_creado_por_idx    on public.ventas (creado_por);
create index if not exists ventas_cliente_id_idx    on public.ventas (cliente_id);
create index if not exists ventas_cedula_idx        on public.ventas (cedula);
create index if not exists ventas_estado_idx        on public.ventas (estado);
create index if not exists ventas_created_at_idx    on public.ventas (created_at desc);
create unique index if not exists ventas_numero_uidx on public.ventas (numero);

create index if not exists venta_items_venta_id_idx    on public.venta_items (venta_id);
create index if not exists venta_items_producto_id_idx on public.venta_items (producto_id);
create index if not exists venta_items_variante_id_idx on public.venta_items (variante_id);

-- ---------------------------------------------------------------------------
-- 4.1) Código de producto único
--      product-service.js dice "¿ya existe un producto con ese código?" y
--      actualiza en vez de crear; esa lógica necesita que codigo sea único.
--      Se protege con un DO para no romper la migración si ya hay duplicados.
-- ---------------------------------------------------------------------------
do $$
begin
    if not exists (
        select 1 from pg_indexes
        where schemaname = 'public' and indexname = 'productos_codigo_uidx'
    ) then
        if exists (
            select 1
            from public.productos
            where codigo is not null
            group by codigo
            having count(*) > 1
        ) then
            raise warning 'productos: hay codigos duplicados. Se omite el indice unico productos_codigo_uidx. Limpia los duplicados y vuelve a pegar este archivo.';
        else
            create unique index productos_codigo_uidx on public.productos (codigo);
        end if;
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4.2) Claves foráneas del catálogo (productos -> categorias / marcas)
--      Se agregan sin ON DELETE (NO ACTION, el comportamiento por defecto) para
--      no cambiar el comportamiento actual de borrado.
--      Se usa NOT VALID: NO revisa las filas viejas (así no falla si hoy hay
--      productos con categoria_id o marca_id huérfanos) pero SÍ controla todo
--      lo que se inserte o modifique de ahora en adelante.
-- ---------------------------------------------------------------------------
do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'productos_categoria_id_fkey'
    ) then
        alter table public.productos
            add constraint productos_categoria_id_fkey
            foreign key (categoria_id) references public.categorias(id) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'productos_marca_id_fkey'
    ) then
        alter table public.productos
            add constraint productos_marca_id_fkey
            foreign key (marca_id) references public.marcas(id) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint where conname = 'variantes_producto_producto_id_fkey'
    ) then
        alter table public.variantes_producto
            add constraint variantes_producto_producto_id_fkey
            foreign key (producto_id) references public.productos(id) on delete cascade not valid;
    end if;
end
$$;


-- ============================================================================
-- 5) FUNCIONES HELPER
--    SECURITY DEFINER + search_path fijo: la función puede leer public.perfiles
--    aunque RLS esté activo, y no depende del search_path del llamador.
--    STABLE: se puede cachear dentro de una misma consulta.
-- ============================================================================

-- ¿El usuario actual es admin o superusuario y está activo?
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.perfiles p
        where p.id = auth.uid()
          and p.activo is true
          and p.rol in ('admin', 'superusuario')
    );
$$;

-- ¿El usuario actual es superusuario y está activo?
create or replace function public.es_superusuario()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.perfiles p
        where p.id = auth.uid()
          and p.activo is true
          and p.rol = 'superusuario'
    );
$$;

-- Las políticas usan estas funciones; se permite ejecutarlas a los roles de la API.
grant execute on function public.es_admin()        to anon, authenticated, service_role;
grant execute on function public.es_superusuario() to anon, authenticated, service_role;


-- ============================================================================
-- 6) FUNCIONES Y TRIGGERS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 6.1) handle_new_user: crea automáticamente el perfil al registrarse un usuario
--      en auth.users. Toma nombre, email y rol de raw_user_meta_data.
--      Validación del rol: si viene un rol inválido o vacío, se usa 'cliente'.
--      (NO se lanza excepción: bloquear la creación del usuario sería peor.)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_nombre text;
    v_email  text;
    v_rol    text;
begin
    v_nombre := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'nombre', '')), '');
    v_email  := new.email;
    v_rol    := lower(btrim(coalesce(new.raw_user_meta_data ->> 'rol', '')));

    -- Rol por defecto y validación contra la lista permitida
    if v_rol is null or v_rol not in ('cliente', 'admin', 'superusuario') then
        v_rol := 'cliente';
    end if;

    insert into public.perfiles (id, nombre, email, rol, activo, created_at)
    values (new.id, v_nombre, v_email, v_rol, true, now())
    on conflict (id) do nothing;

    -- Si el perfil ya existía y le faltaba el email, se completa sin tocar
    -- nombre, rol ni activo (no se pisan datos que el dueño haya editado).
    update public.perfiles p
       set email = coalesce(p.email, v_email)
     where p.id = new.id
       and p.email is null
       and v_email is not null;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 6.2) proteger_campos_perfil: impide la escalada de privilegios.
--      Un usuario autenticado puede actualizar su propio perfil (el frontend
--      actualiza ultimo_login al iniciar sesión) pero NO puede cambiarse
--      el rol ni el campo activo, salvo que sea superusuario.
--
--      Casos que se dejan pasar SIN restricción (imprescindible):
--        - service_role: es el rol que usa la Edge Function admin-create-user
--          para actualizar el perfil (set rol/nombre/activo) al crear usuarios.
--          En ese contexto auth.uid() es NULL, así que sin esta excepción la
--          Edge Function fallaría con "No tienes permiso...".
--        - El SQL Editor del panel de Supabase (corre como postgres).
--        - Cualquier otro rol que no sea la API (current_user fuera de
--          anon/authenticated), para no romper tareas administrativas.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Fuera de la API (service_role, postgres, SQL Editor) no se restringe nada
    if current_user not in ('anon', 'authenticated') then
        return new;
    end if;

    -- Un superusuario activo sí puede tocar rol y activo
    if public.es_superusuario() then
        return new;
    end if;

    if new.rol is distinct from old.rol then
        raise exception 'No tienes permiso para cambiar el rol del perfil'
            using errcode = '42501';
    end if;

    if new.activo is distinct from old.activo then
        raise exception 'No tienes permiso para cambiar el estado (activo) del perfil'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

drop trigger if exists perfiles_proteger_campos on public.perfiles;
create trigger perfiles_proteger_campos
    before update on public.perfiles
    for each row
    execute function public.proteger_campos_perfil();


-- ============================================================================
-- 7) RLS Y POLÍTICAS
--    El catálogo es PRIVADO: el frontend usa la clave publicable (anon), así que
--    toda la seguridad depende de RLS. Nada de catálogo queda visible para anon.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 7.1) Activar RLS en TODAS las tablas
-- ---------------------------------------------------------------------------
alter table public.categorias         enable row level security;
alter table public.marcas             enable row level security;
alter table public.productos          enable row level security;
alter table public.variantes_producto enable row level security;
alter table public.perfiles           enable row level security;
alter table public.clientes           enable row level security;
alter table public.mensajes_contacto  enable row level security;
alter table public.ventas             enable row level security;
alter table public.venta_items        enable row level security;

-- ---------------------------------------------------------------------------
-- 7.2) Permisos base para los roles de la API
--      (RLS decide las filas; estos grants habilitan la operación a nivel tabla)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.productos, public.variantes_producto, public.categorias, public.marcas
    to authenticated;

grant select, insert, update, delete
    on public.productos, public.variantes_producto, public.categorias, public.marcas
    to authenticated;

grant select, update on public.perfiles to authenticated;
grant select on public.clientes to authenticated;

grant insert on public.mensajes_contacto to anon, authenticated;
grant select, update, delete on public.mensajes_contacto to authenticated;

grant select, insert on public.ventas to authenticated;
grant select, insert on public.venta_items to authenticated;

-- ---------------------------------------------------------------------------
-- 7.3) CATÁLOGO: productos, variantes_producto, categorias, marcas
--      SELECT: sólo authenticated (catálogo privado, nada para anon)
--      INSERT / UPDATE / DELETE: sólo admin o superusuario
-- ---------------------------------------------------------------------------

-- productos
drop policy if exists "productos_select_autenticados" on public.productos;
create policy "productos_select_autenticados"
    on public.productos for select
    to authenticated
    using (true);

drop policy if exists "productos_insert_admin" on public.productos;
create policy "productos_insert_admin"
    on public.productos for insert
    to authenticated
    with check ((select public.es_admin()));

drop policy if exists "productos_update_admin" on public.productos;
create policy "productos_update_admin"
    on public.productos for update
    to authenticated
    using ((select public.es_admin()))
    with check ((select public.es_admin()));

drop policy if exists "productos_delete_admin" on public.productos;
create policy "productos_delete_admin"
    on public.productos for delete
    to authenticated
    using ((select public.es_admin()));

-- variantes_producto
drop policy if exists "variantes_select_autenticados" on public.variantes_producto;
create policy "variantes_select_autenticados"
    on public.variantes_producto for select
    to authenticated
    using (true);

drop policy if exists "variantes_insert_admin" on public.variantes_producto;
create policy "variantes_insert_admin"
    on public.variantes_producto for insert
    to authenticated
    with check ((select public.es_admin()));

drop policy if exists "variantes_update_admin" on public.variantes_producto;
create policy "variantes_update_admin"
    on public.variantes_producto for update
    to authenticated
    using ((select public.es_admin()))
    with check ((select public.es_admin()));

drop policy if exists "variantes_delete_admin" on public.variantes_producto;
create policy "variantes_delete_admin"
    on public.variantes_producto for delete
    to authenticated
    using ((select public.es_admin()));

-- categorias
drop policy if exists "categorias_select_autenticados" on public.categorias;
create policy "categorias_select_autenticados"
    on public.categorias for select
    to authenticated
    using (true);

drop policy if exists "categorias_insert_admin" on public.categorias;
create policy "categorias_insert_admin"
    on public.categorias for insert
    to authenticated
    with check ((select public.es_admin()));

drop policy if exists "categorias_update_admin" on public.categorias;
create policy "categorias_update_admin"
    on public.categorias for update
    to authenticated
    using ((select public.es_admin()))
    with check ((select public.es_admin()));

drop policy if exists "categorias_delete_admin" on public.categorias;
create policy "categorias_delete_admin"
    on public.categorias for delete
    to authenticated
    using ((select public.es_admin()));

-- marcas
drop policy if exists "marcas_select_autenticados" on public.marcas;
create policy "marcas_select_autenticados"
    on public.marcas for select
    to authenticated
    using (true);

drop policy if exists "marcas_insert_admin" on public.marcas;
create policy "marcas_insert_admin"
    on public.marcas for insert
    to authenticated
    with check ((select public.es_admin()));

drop policy if exists "marcas_update_admin" on public.marcas;
create policy "marcas_update_admin"
    on public.marcas for update
    to authenticated
    using ((select public.es_admin()))
    with check ((select public.es_admin()));

drop policy if exists "marcas_delete_admin" on public.marcas;
create policy "marcas_delete_admin"
    on public.marcas for delete
    to authenticated
    using ((select public.es_admin()));

-- ---------------------------------------------------------------------------
-- 7.4) PERFILES
--      - Cada usuario ve su propio perfil.
--      - admin/superusuario ven todos.
--      - UPDATE del propio perfil (el login actualiza ultimo_login).
--        El trigger perfiles_proteger_campos impide cambiar rol/activo.
--      - No hay policy de INSERT: el alta la hacen el trigger handle_new_user
--        (security definer) y el service_role de la Edge Function.
-- ---------------------------------------------------------------------------
drop policy if exists "perfiles_select_propio" on public.perfiles;
create policy "perfiles_select_propio"
    on public.perfiles for select
    to authenticated
    using (id = auth.uid());

drop policy if exists "perfiles_select_admin" on public.perfiles;
create policy "perfiles_select_admin"
    on public.perfiles for select
    to authenticated
    using ((select public.es_admin()));

drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio"
    on public.perfiles for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

drop policy if exists "perfiles_update_admin" on public.perfiles;
create policy "perfiles_update_admin"
    on public.perfiles for update
    to authenticated
    using ((select public.es_admin()))
    with check ((select public.es_admin()));

-- ---------------------------------------------------------------------------
-- 7.5) CLIENTES
--      - Cada cliente ve su propio registro (y también el admin el suyo).
--      - admin/superusuario: SELECT, INSERT, UPDATE y DELETE sobre todos.
-- ---------------------------------------------------------------------------
drop policy if exists "clientes_select_propio" on public.clientes;
create policy "clientes_select_propio"
    on public.clientes for select
    to authenticated
    using (id = auth.uid());

drop policy if exists "clientes_select_admin" on public.clientes;
create policy "clientes_select_admin"
    on public.clientes for select
    to authenticated
    using ((select public.es_admin()));

drop policy if exists "clientes_insert_admin" on public.clientes;
create policy "clientes_insert_admin"
    on public.clientes for insert
    to authenticated
    with check ((select public.es_admin()));

drop policy if exists "clientes_update_admin" on public.clientes;
create policy "clientes_update_admin"
    on public.clientes for update
    to authenticated
    using ((select public.es_admin()))
    with check ((select public.es_admin()));

drop policy if exists "clientes_delete_admin" on public.clientes;
create policy "clientes_delete_admin"
    on public.clientes for delete
    to authenticated
    using ((select public.es_admin()));

-- ---------------------------------------------------------------------------
-- 7.6) MENSAJES_CONTACTO
--      - INSERT público: el formulario de contacto no requiere login, así que
--        se permite a anon y a authenticated.
--      - SELECT / UPDATE / DELETE: sólo admin o superusuario.
-- ---------------------------------------------------------------------------
drop policy if exists "mensajes_insert_publico" on public.mensajes_contacto;
create policy "mensajes_insert_publico"
    on public.mensajes_contacto for insert
    to anon
    with check (true);

drop policy if exists "mensajes_insert_autenticados" on public.mensajes_contacto;
create policy "mensajes_insert_autenticados"
    on public.mensajes_contacto for insert
    to authenticated
    with check (true);

drop policy if exists "mensajes_select_admin" on public.mensajes_contacto;
create policy "mensajes_select_admin"
    on public.mensajes_contacto for select
    to authenticated
    using ((select public.es_admin()));

drop policy if exists "mensajes_update_admin" on public.mensajes_contacto;
create policy "mensajes_update_admin"
    on public.mensajes_contacto for update
    to authenticated
    using ((select public.es_admin()))
    with check ((select public.es_admin()));

drop policy if exists "mensajes_delete_admin" on public.mensajes_contacto;
create policy "mensajes_delete_admin"
    on public.mensajes_contacto for delete
    to authenticated
    using ((select public.es_admin()));

-- ---------------------------------------------------------------------------
-- 7.7) VENTAS Y VENTA_ITEMS
--      - INSERT: cualquier usuario autenticado (un cliente hace su pedido).
--        Si manda creado_por, debe ser su propio id.
--      - SELECT: el cliente ve sus ventas (creado_por = auth.uid() o la venta
--        está asociada a su propia fila de clientes); admin/superusuario ve todas.
--      - UPDATE: sólo admin/superusuario (cambiar estado, corregir datos).
--      - No hay policy de DELETE: el historial de ventas no se borra desde el
--        frontend (sólo el service_role puede hacerlo).
-- ---------------------------------------------------------------------------
drop policy if exists "ventas_insert_autenticados" on public.ventas;
create policy "ventas_insert_autenticados"
    on public.ventas for insert
    to authenticated
    with check (creado_por is null or creado_por = auth.uid());

drop policy if exists "ventas_select_propias" on public.ventas;
create policy "ventas_select_propias"
    on public.ventas for select
    to authenticated
    using (
        creado_por = auth.uid()
        or cliente_id in (select c.id from public.clientes c where c.id = auth.uid())
    );

drop policy if exists "ventas_select_admin" on public.ventas;
create policy "ventas_select_admin"
    on public.ventas for select
    to authenticated
    using ((select public.es_admin()));

drop policy if exists "ventas_update_admin" on public.ventas;
create policy "ventas_update_admin"
    on public.ventas for update
    to authenticated
    using ((select public.es_admin()))
    with check ((select public.es_admin()));

-- venta_items
drop policy if exists "venta_items_insert_autenticados" on public.venta_items;
create policy "venta_items_insert_autenticados"
    on public.venta_items for insert
    to authenticated
    with check (true);

drop policy if exists "venta_items_select_propios" on public.venta_items;
create policy "venta_items_select_propios"
    on public.venta_items for select
    to authenticated
    using (
        venta_id in (
            select v.id
            from public.ventas v
            where v.creado_por = auth.uid()
               or v.cliente_id in (select c.id from public.clientes c where c.id = auth.uid())
        )
    );

drop policy if exists "venta_items_select_admin" on public.venta_items;
create policy "venta_items_select_admin"
    on public.venta_items for select
    to authenticated
    using ((select public.es_admin()));

drop policy if exists "venta_items_update_admin" on public.venta_items;
create policy "venta_items_update_admin"
    on public.venta_items for update
    to authenticated
    using ((select public.es_admin()))
    with check ((select public.es_admin()));

drop policy if exists "venta_items_delete_admin" on public.venta_items;
create policy "venta_items_delete_admin"
    on public.venta_items for delete
    to authenticated
    using ((select public.es_admin()));


-- ============================================================================
-- 8) STORAGE: BUCKET "productos"
--    Lectura pública de las imágenes (getPublicUrl), pero subir, reemplazar o
--    borrar archivos sólo lo puede hacer un admin o superusuario.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 8.1) Crear el bucket si no existe (id y name del bucket son el mismo valor).
--      Si el proyecto no tiene el esquema storage (caso raro), se avisa y se
--      sigue: el resto de la migración no se cae por esto.
-- ---------------------------------------------------------------------------
do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'storage' and table_name = 'buckets'
    ) then
        insert into storage.buckets (id, name, public)
        values ('productos', 'productos', true)
        on conflict (id) do nothing;
    else
        raise warning 'No existe el esquema storage: se omite la creacion del bucket productos.';
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 8.2) Ajustes no destructivos del bucket: sólo completa lo que esté vacío.
--      NO sobrescribe un límite de tamaño ni una lista de tipos ya configurada
--      a mano desde el panel, y tampoco cambia el bucket de público a privado.
-- ---------------------------------------------------------------------------
do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'storage' and table_name = 'buckets'
    ) then
        -- Asegurar que sea público (sólo cambia la bandera, no borra archivos)
        update storage.buckets
           set public = true
         where id = 'productos'
           and public is distinct from true;

        -- Límite de 2 MB, igual que valida el frontend en product-service.js
        -- (_subirImagen). Sólo se aplica si el bucket no trae un límite propio.
        update storage.buckets
           set file_size_limit = 2097152
         where id = 'productos'
           and file_size_limit is null;

        -- Tipos de imagen permitidos. Sólo se aplica si no hay lista propia.
        update storage.buckets
           set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
         where id = 'productos'
           and allowed_mime_types is null;
    end if;
end
$$;

-- Políticas sobre storage.objects (requiere RLS; en Supabase ya viene activo)
alter table storage.objects enable row level security;

-- Lectura pública de las imágenes del bucket productos
drop policy if exists "productos_storage_lectura_publica" on storage.objects;
create policy "productos_storage_lectura_publica"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'productos');

-- Subir archivos: sólo admin/superusuario
drop policy if exists "productos_storage_insert_admin" on storage.objects;
create policy "productos_storage_insert_admin"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'productos' and (select public.es_admin()));

-- Reemplazar/mover archivos: sólo admin/superusuario
drop policy if exists "productos_storage_update_admin" on storage.objects;
create policy "productos_storage_update_admin"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'productos' and (select public.es_admin()))
    with check (bucket_id = 'productos' and (select public.es_admin()));

-- Borrar archivos: sólo admin/superusuario
drop policy if exists "productos_storage_delete_admin" on storage.objects;
create policy "productos_storage_delete_admin"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'productos' and (select public.es_admin()));


-- ============================================================================
-- 9) INSTRUCCIONES PARA EL DUEÑO (LEER ANTES DE PEGAR)
-- ============================================================================
--
-- QUÉ HACE ESTE ARCHIVO
--   - Crea las tablas que falten (nunca borra ni vacía nada).
--   - Agrega las columnas que falten en las tablas que ya existen.
--   - Crea las tablas nuevas `ventas` y `venta_items` para dejar de guardar el
--     historial de ventas en el localStorage del navegador.
--   - Activa RLS y deja el catálogo privado: sólo usuarios logueados lo ven.
--   - Crea el bucket `productos` y sus políticas de Storage.
--   - Crea el trigger que arma el perfil automáticamente al crear un usuario.
--
-- ANTES DE PEGARLO (IMPORTANTE)
--   1. HACÉ UNA COPIA DE SEGURIDAD. En el panel de Supabase:
--      Database -> Backups -> Download, o Project Settings -> Database.
--   2. PROBALO PRIMERO EN UN PROYECTO DE PRUEBA. Nunca lo pegues por primera vez
--      en el proyecto de producción: creá un proyecto gratuito de prueba,
--      pegá el archivo, revisá que no dé error y recién después pasalo a producción.
--   3. Este archivo se puede pegar varias veces sin problema (es idempotente),
--      pero probalo igual en el proyecto de prueba antes de cada cambio grande.
--
-- CÓMO PEGARLO EN EL SQL EDITOR DE SUPABASE
--   1. Entrá a https://supabase.com/dashboard y abrí tu proyecto.
--   2. En el menú lateral, entrá a "SQL Editor".
--   3. Hacé clic en "New query" (Nueva consulta).
--   4. Abrí este archivo, copiá TODO su contenido (Ctrl+A, Ctrl+C) y pegalo en el
--      editor (Ctrl+V). Importante: copiá todo, los comentarios no molestan.
--   5. Hacé clic en "Run" (o apretá Ctrl+Enter).
--   6. Revisá el panel de resultados de abajo:
--        - Si dice "Success. No rows returned" => todo bien.
--        - Si aparece algún error en rojo, NO vuelvas a ejecutar todo a ciegas:
--          leé el mensaje. Los avisos (WARNING) sobre códigos o cédulas
--          duplicadas NO son errores: significan que se omitió un índice único
--          porque hay datos repetidos. En ese caso limpiá los duplicados y
--          volvé a pegar el archivo.
--   7. Verificá que quedó todo: en el menú lateral entrá a
--      "Table Editor" y deberías ver las tablas categorias, marcas, productos,
--      variantes_producto, perfiles, clientes, mensajes_contacto, ventas y
--      venta_items. En "Storage" debería aparecer el bucket `productos`.
--
-- DESPUÉS DE PEGARLO: QUÉ REVISAR
--   a) Los usuarios existentes deben tener su fila en `perfiles`. Este archivo
--      crea los perfiles NUEVOS automáticamente, pero NO crea los que ya
--      existían sin perfil. Si al entrar al sistema algún usuario dice
--      "No se encontró el perfil del usuario", creá su fila a mano así
--      (reemplazá el correo y el rol):
--
--        insert into public.perfiles (id, nombre, email, rol, activo)
--        select u.id,
--               coalesce(u.raw_user_meta_data ->> 'nombre', split_part(u.email, '@', 1)),
--               u.email,
--               'cliente',
--               true
--          from auth.users u
--         where not exists (select 1 from public.perfiles p where p.id = u.id);
--
--      OJO: ese INSERT deja a todos como 'cliente'. Después, para nombrar al
--      superusuario y a los administradores, actualizá a mano:
--
--        update public.perfiles set rol = 'superusuario' where email = 'TU_CORREO_AQUI';
--        update public.perfiles set rol = 'admin'         where email = 'CORREO_DEL_ADMIN';
--
--      (Estos UPDATE se hacen desde el SQL Editor, que corre como postgres, por
--       eso el trigger de protección no los bloquea. Tampoco bloquea a la Edge
--       Function admin-create-user, que trabaja con service_role, ni a un
--       superusuario; sí bloquea a un admin o a un cliente que intente
--       cambiarse el rol o reactivarse a sí mismo desde el navegador.)
--
--   b) Copiá el id del usuario superusuario en `perfiles` y confirmá que exista
--      una fila suya en `clientes` sólo si lo necesitás como cliente.
--
--   c) Para guardar el historial viejo que hoy está en el localStorage del
--      navegador: abrí la consola del navegador (F12) en la página del sistema y
--      ejecutá  localStorage.getItem('supli_motors_historial')  para copiar el
--      JSON. Después cargá esas ventas en las tablas `ventas` y `venta_items`
--      (podés usar Table Editor o un INSERT). El archivo NO migra esos datos
--      solo: son datos que viven en la PC de cada navegador, no en la base.
--
--   d) Revisá que el bucket `productos` esté marcado como "Public bucket" en
--      Storage, si querés que las imágenes se vean con getPublicUrl.
--
-- ADVERTENCIAS
--   - Este archivo NO borra tablas, NO borra columnas y NO ejecuta TRUNCATE.
--   - Sí activa RLS en las tablas. Si alguna tabla tenía RLS desactivado y
--     acceso abierto con la clave anon, después de pegar esto el acceso queda
--     restringido a las políticas de arriba. Probá en el proyecto de prueba
--     para confirmar que la app sigue funcionando (login, catálogo, ventas,
--     formulario de contacto y subida de imágenes).
--   - Si el catálogo no carga después de pegar esto, casi siempre es porque el
--     usuario no está logueado (anon ya no puede leer productos) o porque su
--     fila en `perfiles` no tiene rol 'admin'/'superusuario' o está inactiva.
--   - Los avisos de índices únicos omitidos (productos.codigo, clientes.cedula)
--     indican datos duplicados: limpialos y volvé a pegar el archivo.
--
-- ============================================================================
-- FIN DEL ARCHIVO
-- ============================================================================
