-- ============================================================================
-- 0002: SOPORTE PARA FILTRAR Y PAGINAR EN EL SERVIDOR
-- ============================================================================
-- Va DESPUES de 0001_esquema_inicial.sql. Resuelve el problema de escala del
-- catalogo: hoy el navegador se baja los 2.994 productos y las 4.293 variantes
-- (3,1 MB de JSON) para mostrar 24, y filtra en memoria.
--
-- Esta migracion aporta las tres piezas que faltan para que el filtrado, la
-- busqueda y la paginacion ocurran en Postgres:
--
--   1. Una columna normalizada para buscar sin tildes ni mayusculas.
--      PostgREST solo sabe filtrar por columnas, no por expresiones, y "ilike"
--      distingue acentos: sin esto, buscar "bujia" no encontraria "Bujia".
--   2. Dos columnas derivadas (precio minimo y stock total) para poder filtrar
--      por precio y por stock sin recorrer las variantes de cada producto.
--   3. Los indices para que esas consultas no hagan un recorrido completo.
--
-- SOBRE LOS DATOS: no borra ni modifica ningun dato existente. Lo unico que
-- escribe es el valor inicial de las tres columnas nuevas, calculado a partir de
-- los datos que ya estaban. Es idempotente: se puede volver a ejecutar.
--
-- SOBRE LAS EXTENSIONES: a proposito NO se usa la extension "unaccent". En
-- Supabase puede estar instalada en el esquema "extensions" y no en "public", y
-- entonces la referencia fallaria. La normalizacion se hace con translate(), que
-- es inmutable por naturaleza y cubre los acentos del espanol. La extension
-- pg_trgm si se intenta, pero solo para acelerar el indice: si no esta
-- disponible, se avisa y todo sigue funcionando (mas lento, pero correcto).
--
-- Como aplicarla: pegar todo en el SQL Editor de Supabase despues de 0001.
-- ============================================================================


-- ============================================================================
-- 1) BUSQUEDA SIN TILDES
-- ============================================================================

-- Pasa un texto a minusculas y sin acentos. translate() es inmutable, asi que
-- puede usarse en una columna generada y en un indice.
create or replace function public.normalizar_busqueda(texto text)
returns text
language sql
immutable
parallel safe
as $$
    select lower(
        translate(
            coalesce(texto, ''),
            'áéíóúüñàèìòùâêîôûäëïöüçÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÇ',
            'aeiouunaeiouaeiouaeioucAEIOUUNAEIOUAEIOUAEIOUC'
        )
    )
$$;

comment on function public.normalizar_busqueda(text) is
    'Pasa un texto a minusculas y sin acentos. Se usa para la columna de busqueda del catalogo.';

-- Columna generada: Postgres la mantiene sola, no hay triggers que se puedan
-- desincronizar. Incluye nombre, codigo y descripcion.
alter table public.productos
    add column if not exists busqueda text
    generated always as (
        public.normalizar_busqueda(
            coalesce(nombre, '') || ' ' || coalesce(codigo, '') || ' ' || coalesce(descripcion, '')
        )
    ) stored;

comment on column public.productos.busqueda is
    'Texto de busqueda normalizado (minusculas, sin acentos). Generada automaticamente.';

-- Indice trigram (mejor esfuerzo). Sin el, la busqueda funciona igual pero
-- recorre la tabla. Con 3.000 filas es rapido igual; con 50.000 no.
do $$
begin
    begin
        create index if not exists productos_busqueda_trgm
            on public.productos using gin (busqueda gin_trgm_ops);
        raise notice 'Indice trigram de busqueda creado.';
    exception
        when others then
            raise warning 'No se pudo crear el indice trigram (%). La busqueda funcionara igual, recorriendo la tabla. Se puede habilitar pg_trgm desde Database -> Extensions.', sqlerrm;
    end;
end
$$;


-- ============================================================================
-- 2) PRECIO MINIMO Y STOCK TOTAL
-- ============================================================================
-- El catalogo muestra el menor precio de las variantes activas y la suma de su
-- stock, y hay que poder filtrar por esos valores en el servidor.

alter table public.productos
    add column if not exists precio_min numeric(12,2),
    add column if not exists stock_total integer not null default 0;

comment on column public.productos.precio_min is
    'Menor precio entre las variantes activas con precio valido. Si no hay, el precio base.';
comment on column public.productos.stock_total is
    'Suma del stock de las variantes activas.';

create index if not exists productos_precio_min_idx on public.productos (precio_min);
create index if not exists productos_stock_total_idx on public.productos (stock_total);
create index if not exists productos_activo_created_idx on public.productos (activo, created_at desc);

-- Recalcula las dos columnas de un producto a partir de sus variantes.
create or replace function public.recalcular_resumen_producto(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.productos p
       set precio_min = coalesce(resumen.minimo, p.precio_base),
           stock_total = coalesce(resumen.stock, 0)
      from (
            select min(nullif(v.precio, 0)) as minimo,
                   sum(coalesce(v.stock, 0))  as stock
              from public.variantes_producto v
             where v.producto_id = p_id
               and v.activo is not false
           ) as resumen
     where p.id = p_id;
$$;

comment on function public.recalcular_resumen_producto(uuid) is
    'Recalcula precio_min y stock_total de un producto. Lo llaman los triggers de variantes_producto.';

-- Trigger sobre las variantes: cualquier alta, cambio o baja recalcula su producto
create or replace function public.trigger_recalcular_resumen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- En un delete, NEW no existe: se usa OLD
    if tg_op = 'DELETE' then
        perform public.recalcular_resumen_producto(old.producto_id);
        return old;
    end if;

    perform public.recalcular_resumen_producto(new.producto_id);

    -- Si la variante cambio de producto, hay que recalcular tambien el anterior
    if tg_op = 'UPDATE' and old.producto_id is distinct from new.producto_id then
        perform public.recalcular_resumen_producto(old.producto_id);
    end if;

    return new;
end;
$$;

drop trigger if exists variantes_recalcular_resumen on public.variantes_producto;
create trigger variantes_recalcular_resumen
    after insert or update or delete on public.variantes_producto
    for each row execute function public.trigger_recalcular_resumen();

-- Y uno sobre el producto, por si le cambian el precio base sin tocar variantes
create or replace function public.trigger_recalcular_resumen_producto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.recalcular_resumen_producto(new.id);
    return new;
end;
$$;

drop trigger if exists productos_recalcular_resumen on public.productos;
create trigger productos_recalcular_resumen
    after insert or update of precio_base on public.productos
    for each row execute function public.trigger_recalcular_resumen_producto();


-- ============================================================================
-- 3) VALORES INICIALES
-- ============================================================================
-- Rellena las columnas nuevas de los productos que ya existen.
do $$
declare
    p record;
    procesados integer := 0;
begin
    for p in select id from public.productos loop
        perform public.recalcular_resumen_producto(p.id);
        procesados := procesados + 1;
    end loop;
    raise notice 'Resumen recalculado en % productos.', procesados;
end
$$;


-- ============================================================================
-- 4) VERIFICACION
-- ============================================================================
-- Deberia mostrar los 2.994 productos con precio_min y stock_total cargados, y
-- ninguno con busqueda vacia.
select count(*)                                                 as productos,
       count(*) filter (where precio_min is null)               as sin_precio_min,
       count(*) filter (where busqueda is null or busqueda = '') as sin_busqueda,
       count(*) filter (where stock_total > 0)                  as con_stock
from public.productos;

-- Prueba de la busqueda sin tildes: deberia encontrar productos aunque en la
-- tabla figuren con acento o en mayusculas.
select codigo, nombre
from public.productos
where busqueda like '%bujia%'
limit 5;

-- ============================================================================
-- REVERSION
-- ============================================================================
-- No hace falta revertir nada para volver a la aplicacion anterior: las columnas
-- nuevas son ignoradas por el codigo viejo. Si aun asi se quieren borrar,
-- descomentar:
--
--   drop trigger if exists variantes_recalcular_resumen on public.variantes_producto;
--   drop trigger if exists productos_recalcular_resumen on public.productos;
--   drop function if exists public.trigger_recalcular_resumen();
--   drop function if exists public.trigger_recalcular_resumen_producto();
--   drop function if exists public.recalcular_resumen_producto(uuid);
--   drop function if exists public.normalizar_busqueda(text);
--   alter table public.productos drop column if exists busqueda;
--   alter table public.productos drop column if exists precio_min;
--   alter table public.productos drop column if exists stock_total;
-- ============================================================================
