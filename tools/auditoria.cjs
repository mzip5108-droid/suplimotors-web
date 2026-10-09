// ============================================
// Auditoria de solo lectura del proyecto
// ============================================
// Lee las credenciales de supabase/auditoria/conexion.local (ignorado por git) y
// hace tres cosas, todas de lectura:
//
//   1. Volumen real: cuantas filas y cuanto pesa cada tabla.
//   2. Estado de RLS: que tablas lo tienen activado, que politicas existen y
//      cuales son sus expresiones, leidas del catalogo de Postgres.
//   3. Sondas REST con la clave publicable: comprueba que un usuario anonimo NO
//      puede leer el catalogo ni los datos de clientes.
//
// Nunca imprime la contrasena y nunca modifica nada: hay una guardia que aborta
// si una sentencia no empieza por SELECT/WITH/EXPLAIN/SHOW o si contiene
// cualquier palabra de escritura.
//
// Uso:  node tools/auditoria.cjs
const fs = require("node:fs");
const path = require("node:path");

const raiz = process.cwd();
const ARCHIVO_CREDENCIALES = path.join(raiz, "supabase", "auditoria", "conexion.local");
const CLAVE_PUBLICABLE = "sb_publishable_1AOO_cAl75uqc9ISPgn06A__2z1DFs-";
const URL_SUPABASE = "https://hzjnbuvgrlvovjhzoaab.supabase.co";

// ------------------------------------------------------------ guardia de lectura
const PROHIBIDAS = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|comment|copy|vacuum|call|do)\b/i;

function soloLectura(sql) {
    const limpio = sql.trim();
    if (!/^(select|with|explain|show)\b/i.test(limpio)) {
        throw new Error(`Sentencia rechazada por la guardia (no es de lectura): ${limpio.slice(0, 60)}`);
    }
    if (PROHIBIDAS.test(limpio)) {
        throw new Error(`Sentencia rechazada por la guardia (contiene escritura): ${limpio.slice(0, 60)}`);
    }
    return sql;
}

// --------------------------------------------------------------- credenciales
function leerCredenciales() {
    if (!fs.existsSync(ARCHIVO_CREDENCIALES)) {
        console.log("No existe supabase/auditoria/conexion.local");
        console.log("Crealo con este formato (esta ignorado por git):");
        console.log("   HOST=aws-0-us-east-1.pooler.supabase.com");
        console.log("   PUERTO=6543");
        console.log("   BASE=postgres");
        console.log("   USUARIO=dsh_lectura.hzjnbuvgrlvovjhzoaab");
        console.log("   CLAVE=...");
        process.exit(1);
    }

    const texto = fs.readFileSync(ARCHIVO_CREDENCIALES, "utf8");
    const datos = {};
    for (const linea of texto.split(/\r?\n/)) {
        const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
        if (m) datos[m[1]] = m[2];
    }
    for (const campo of ["HOST", "PUERTO", "BASE", "USUARIO", "CLAVE"]) {
        if (!datos[campo]) {
            console.log(`Falta ${campo} en supabase/auditoria/conexion.local`);
            process.exit(1);
        }
    }
    return datos;
}

// ------------------------------------------------------------------- informes
async function auditarBase(datos) {
    const { Client } = require("pg");
    const cliente = new Client({
        host: datos.HOST,
        port: Number(datos.PUERTO),
        database: datos.BASE,
        user: datos.USUARIO,
        password: datos.CLAVE,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
        statement_timeout: 30000
    });

    console.log(`Conectando a ${datos.HOST}:${datos.PUERTO}/${datos.BASE} como ${datos.USUARIO} ...`);
    await cliente.connect();
    console.log("Conectado. (La contrasena no se imprime nunca.)\n");

    const consultar = async (sql) => (await cliente.query(soloLectura(sql))).rows;

    // 1. Volumen real
    console.log("=== VOLUMEN REAL ===");
    const volumen = await consultar(`
        select relname as tabla,
               n_live_tup as filas_aprox,
               pg_size_pretty(pg_total_relation_size(relid)) as tamano
        from pg_stat_user_tables
        where schemaname = 'public'
        order by pg_total_relation_size(relid) desc
    `);
    for (const fila of volumen) {
        console.log(`   ${String(fila.tabla).padEnd(22)} ${String(fila.filas_aprox).padStart(8)} filas   ${fila.tamano}`);
    }
    if (volumen.length === 0) console.log("   (sin tablas en el esquema public)");

    const totalProductos = await consultar("select count(*)::int as total from productos");
    console.log(`\n   productos (conteo exacto): ${totalProductos[0] ? totalProductos[0].total : "?"}`);

    // 2. RLS
    console.log("\n=== RLS POR TABLA ===");
    const rls = await consultar(`
        select c.relname as tabla, c.relrowsecurity as rls_activo, count(p.policyname)::int as politicas
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_policies p on p.tablename = c.relname and p.schemaname = n.nspname
        where n.nspname = 'public' and c.relkind = 'r'
        group by c.relname, c.relrowsecurity
        order by c.relname
    `);
    for (const fila of rls) {
        const estado = fila.rls_activo ? "RLS ON " : "RLS OFF";
        const aviso = fila.rls_activo ? "" : "   <-- SIN RLS: expuesto a la API";
        console.log(`   ${String(fila.tabla).padEnd(22)} ${estado}  ${String(fila.politicas).padStart(2)} politica(s)${aviso}`);
    }

    console.log("\n=== POLITICAS ===");
    const politicas = await consultar(`
        select tablename, policyname, cmd, roles::text as roles, qual, with_check
        from pg_policies
        where schemaname = 'public'
        order by tablename, cmd, policyname
    `);
    if (politicas.length === 0) {
        console.log("   No hay ninguna politica definida: con RLS activo, nadie puede leer nada.");
    }
    let tablaActual = null;
    for (const p of politicas) {
        if (p.tablename !== tablaActual) {
            tablaActual = p.tablename;
            console.log(`\n   ${tablaActual}`);
        }
        console.log(`      ${String(p.cmd).padEnd(6)} ${String(p.policyname).padEnd(42)} ${p.roles}`);
        if (p.qual) console.log(`             using:      ${String(p.qual).replace(/\s+/g, " ").slice(0, 150)}`);
        if (p.with_check) console.log(`             with check: ${String(p.with_check).replace(/\s+/g, " ").slice(0, 150)}`);
    }

    // 3. Indices de las tablas grandes
    console.log("\n=== INDICES ===");
    const indices = await consultar(`
        select tablename, indexname, indexdef
        from pg_indexes
        where schemaname = 'public' and tablename in ('productos', 'variantes_producto')
        order by tablename, indexname
    `);
    for (const i of indices) {
        console.log(`   ${i.tablename.padEnd(20)} ${i.indexname}`);
    }

    await cliente.end();
}

async function sondearApiAnonima() {
    console.log("\n=== SONDAS COMO USUARIO ANONIMO (clave publicable) ===");
    console.log("Se espera que el catalogo y los datos de clientes NO sean legibles.\n");

    const cabeceras = {
        apikey: CLAVE_PUBLICABLE,
        Authorization: `Bearer ${CLAVE_PUBLICABLE}`
    };

    const tablas = ["productos", "variantes_producto", "categorias", "marcas", "perfiles", "clientes", "mensajes_contacto"];

    for (const tabla of tablas) {
        const url = `${URL_SUPABASE}/rest/v1/${tabla}?select=*&limit=1`;
        try {
            const respuesta = await fetch(url, { headers: cabeceras });
            const cuerpo = await respuesta.text();
            let filas = "?";
            if (respuesta.ok) {
                try {
                    filas = JSON.parse(cuerpo).length;
                } catch {
                    filas = "?";
                }
            }
            const veredicto = !respuesta.ok
                ? "BLOQUEADO por RLS"
                : filas === 0
                  ? "permitido pero sin filas visibles"
                  : "!! EXPUESTO: devuelve datos sin sesion";

            console.log(`   ${tabla.padEnd(20)} HTTP ${respuesta.status}  ${veredicto}`);
        } catch (err) {
            console.log(`   ${tabla.padEnd(20)} error de red: ${err.message}`);
        }
    }
}

// ---------------------------------------------------------------------- main
(async () => {
    // Con --solo-api se omite la parte que necesita credenciales de la base.
    // Las sondas anonimas usan la clave publicable, que ya es publica.
    if (process.argv.includes("--solo-api")) {
        console.log("Modo --solo-api: sin consultas a la base.\n");
    } else {
        const datos = leerCredenciales();
        try {
            await auditarBase(datos);
        } catch (err) {
            console.log(`\nNo se pudo auditar la base: ${err.message}`);
            console.log("Revisa el host, el puerto y que el usuario sea rol.proyecto en el pooler.");
        }
    }
    await sondearApiAnonima();
    console.log("\nAuditoria terminada. No se modifico nada.");
})();
