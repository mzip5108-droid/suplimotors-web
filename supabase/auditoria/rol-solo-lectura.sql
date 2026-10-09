-- ============================================
-- ROL DE SOLO LECTURA PARA AUDITORIA
-- ============================================
-- Crea un usuario de base de datos que puede LEER todo pero no puede modificar
-- nada. Sirve para auditar y medir el proyecto con datos reales sin ningun
-- riesgo para la informacion de los clientes.
--
-- Como usarlo:
--   1. Cambia la contrasena de abajo por una larga y aleatoria.
--   2. Pega este archivo completo en el SQL Editor de Supabase y ejecutalo.
--   3. Anota el host del pooler, el puerto, la base y el usuario.
--      Los encontras en: Project Settings -> Database -> Connection string.
--   4. Cuando terminemos la auditoria, borra el rol con:
--        drop owned by dsh_lectura;
--        drop role dsh_lectura;
--
-- Por que "bypassrls": las politicas RLS de este proyecto solo dejan leer a los
-- roles "authenticated" y a los administradores. Un rol nuevo no entraria en
-- ninguna politica y no veria nada, asi que la auditoria no podria medir ni
-- verificar nada. Con bypassrls el rol ve todo, pero sigue sin poder escribir
-- porque no tiene permiso de INSERT/UPDATE/DELETE.
--
-- Nota: este archivo NO es una migracion de la aplicacion. No lo ejecutes como
-- parte del esquema del proyecto; es una herramienta de diagnostico temporal.
-- ============================================

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'dsh_lectura') then
        raise notice 'El rol dsh_lectura ya existe: se actualiza la contrasena.';
        alter role dsh_lectura with login password 'CAMBIAME_por_una_clave_larga_y_aleatoria';
    else
        create role dsh_lectura with login password 'CAMBIAME_por_una_clave_larga_y_aleatoria';
        raise notice 'Rol dsh_lectura creado.';
    end if;
end
$$;

-- Puede ver todo, pero sin saltarse los permisos de escritura
alter role dsh_lectura bypassrls;

-- Solo lectura, explicito y sin herencias de otros roles
grant connect on database postgres to dsh_lectura;
grant usage on schema public to dsh_lectura;
grant select on all tables in schema public to dsh_lectura;
grant select on all sequences in schema public to dsh_lectura;

-- Nada de escritura, por si algun grant previo la habilito
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from dsh_lectura;

-- Que los objetos que se creen en el futuro tambien queden en solo lectura
alter default privileges in schema public grant select on tables to dsh_lectura;

-- Verificacion: deberia mostrar solo "SELECT" en privilege_type
select grantee, table_name, privilege_type
from information_schema.table_privileges
where grantee = 'dsh_lectura'
order by table_name, privilege_type;
