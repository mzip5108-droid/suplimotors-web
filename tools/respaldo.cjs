// ============================================
// Respaldo de datos
// ============================================
// El plan Free de Supabase no incluye backups, asi que este script genera un
// respaldo en archivos JSON dentro de respaldo/<fecha>/.
//
// Dos modos:
//
//   node tools/respaldo.cjs
//       Catalogo por la API publica: productos, variantes_producto, categorias y
//       marcas. Funciona YA, sin credenciales nuevas, porque esas cuatro tablas
//       son las que hoy se pueden leer sin sesion. Es el respaldo mas importante:
//       son 3.000 productos y 4.300 variantes, y es justo lo que la migracion
//       va a cerrar.
//
//   node tools/respaldo.cjs --completo
//       Todas las tablas del esquema public, incluidos perfiles, clientes,
//       mensajes_contacto y ventas. Necesita el rol de solo lectura en
//       supabase/auditoria/conexion.local.
//
// Lo que NO se puede respaldar por aca: la tabla auth.users (las contrasenas
// estan hasheadas y el rol de auditoria no tiene permiso sobre ese esquema). Si
// alguna vez hubiera que reconstruir los usuarios, se hace con la Edge Function
// y los clientes cambian su contrasena con "olvide mi contrasena".
const fs = require("node:fs");
const path = require("node:path");

const raiz = process.cwd();
const CLAVE_PUBLICABLE = "sb_publishable_1AOO_cAl75uqc9ISPgn06A__2z1DFs-";
const URL_SUPABASE = "https://hzjnbuvgrlvovjhzoaab.supabase.co";
const TABLAS_CATALOGO = ["productos", "variantes_producto", "categorias", "marcas"];

const selloDeTiempo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const destino = path.join(raiz, "respaldo", selloDeTiempo);
fs.mkdirSync(destino, { recursive: true });

// --------------------------------------------------------- modo catalogo (API)
async function respaldarPorApi(tabla) {
    const filas = [];
    const PASO = 1000;
    let offset = 0;

    while (true) {
        const respuesta = await fetch(
            `${URL_SUPABASE}/rest/v1/${tabla}?select=*&limit=${PASO}&offset=${offset}&order=id`,
            { headers: { apikey: CLAVE_PUBLICABLE, Authorization: `Bearer ${CLAVE_PUBLICABLE}` } }
        );

        if (!respuesta.ok) {
            throw new Error(`HTTP ${respuesta.status} ${(await respuesta.text()).slice(0, 120)}`);
        }

        const lote = await respuesta.json();
        if (!Array.isArray(lote)) throw new Error("respuesta inesperada (no es un array)");

        filas.push(...lote);
        if (lote.length < PASO) break;
        offset += PASO;
    }

    return filas;
}

// -------------------------------------------------------- modo completo (SQL)
async function respaldarPorSql(tabla, cliente) {
    const resultado = await cliente.query(`select * from public."${tabla}"`);
    return resultado.rows;
}

// ---------------------------------------------------------------------- main
(async () => {
    const completo = process.argv.includes("--completo");
    const resumen = [];

    if (completo) {
        const archivo = path.join(raiz, "supabase", "auditoria", "conexion.local");
        if (!fs.existsSync(archivo)) {
            console.log("Para --completo hace falta supabase/auditoria/conexion.local");
            console.log("(el rol de solo lectura). Probando el modo catalogo...\n");
        } else {
            const datos = {};
            for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
                const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
                if (m) datos[m[1]] = m[2];
            }
            const { Client } = require("pg");
            const cliente = new Client({
                host: datos.HOST,
                port: Number(datos.PUERTO),
                database: datos.BASE,
                user: datos.USUARIO,
                password: datos.CLAVE,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 15000
            });
            await cliente.connect();
            console.log("Conectado al proyecto. Respaldando todas las tablas...\n");

            const tablas = (
                await cliente.query(
                    "select tablename from pg_tables where schemaname = 'public' order by tablename"
                )
            ).rows.map((f) => f.tablename);

            for (const tabla of tablas) {
                try {
                    const filas = await respaldarPorSql(tabla, cliente);
                    fs.writeFileSync(
                        path.join(destino, `${tabla}.json`),
                        JSON.stringify(filas, null, 2),
                        "utf8"
                    );
                    resumen.push({ tabla, filas: filas.length });
                } catch (err) {
                    resumen.push({ tabla, error: err.message });
                }
            }
            await cliente.end();
        }
    }

    if (resumen.length === 0) {
        console.log("Respaldo del catalogo por la API publica...\n");
        for (const tabla of TABLAS_CATALOGO) {
            try {
                const filas = await respaldarPorApi(tabla);
                fs.writeFileSync(
                    path.join(destino, `${tabla}.json`),
                    JSON.stringify(filas, null, 2),
                    "utf8"
                );
                resumen.push({ tabla, filas: filas.length });
            } catch (err) {
                resumen.push({ tabla, error: err.message });
            }
        }
    }

    console.log("RESPALDO");
    let total = 0;
    for (const r of resumen) {
        if (r.error) {
            console.log(`   ${r.tabla.padEnd(22)} ERROR: ${r.error.slice(0, 60)}`);
        } else {
            total += r.filas;
            console.log(`   ${r.tabla.padEnd(22)} ${String(r.filas).padStart(6)} filas`);
        }
    }

    const tamano = fs
        .readdirSync(destino)
        .reduce((suma, f) => suma + fs.statSync(path.join(destino, f)).size, 0);

    console.log(`\n   ${total} filas en total`);
    console.log(`   ${(tamano / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   ${path.relative(raiz, destino)}`);
    console.log("\nLos archivos quedan en respaldo/, que esta ignorado por git:");
    console.log("son datos de tu negocio y no deben versionarse.");
})();
