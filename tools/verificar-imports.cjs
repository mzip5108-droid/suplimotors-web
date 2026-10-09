// Verifica la integridad de la aplicacion modular (js/**):
//   1. Cada import apunta a un archivo existente y a un nombre realmente exportado.
//      Esto es lo que el navegador rechazaria en tiempo de carga con
//      "does not provide an export named ...", un error que ni el linter ni los
//      tests unitarios detectan.
//   2. Ningun nombre de nivel superior esta declarado en dos modulos distintos.
//
// Uso: node tools/verificar-imports.cjs [carpeta]   (por defecto js)
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");

const raiz = process.cwd();
const carpeta = process.argv[2] || "js";
const base = path.resolve(raiz, carpeta);

const archivosDe = (dir, acumulado = []) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const completo = path.join(dir, entrada.name);
        if (entrada.isDirectory()) archivosDe(completo, acumulado);
        else if (entrada.name.endsWith(".js")) acumulado.push(completo);
    }
    return acumulado;
};

const archivos = archivosDe(base);
const exportados = new Map(); // ruta relativa -> Set de nombres exportados
const declarados = new Map(); // nombre -> ruta relativa
const imports = [];
const problemas = [];

for (const archivo of archivos) {
    const rel = path.relative(raiz, archivo).replace(/\\/g, "/");
    const codigo = fs.readFileSync(archivo, "utf8");

    let ast;
    try {
        ast = espree.parse(codigo, { ecmaVersion: 2023, sourceType: "module" });
    } catch (err) {
        problemas.push(`${rel}: no parsea — ${err.message}`);
        continue;
    }

    const exp = new Set();
    for (const node of ast.body) {
        const esExport = node.type === "ExportNamedDeclaration" && node.declaration;
        const decl = esExport ? node.declaration : node;
        let nombres = [];

        if (decl.type === "FunctionDeclaration" && decl.id) nombres = [decl.id.name];
        else if (decl.type === "VariableDeclaration") nombres = decl.declarations.map((d) => d.id.name);

        for (const nombre of nombres) {
            if (!nombre) continue;
            if (!declarados.has(nombre)) declarados.set(nombre, []);
            declarados.get(nombre).push(rel);
            if (esExport) exp.add(nombre);
        }
    }
    exportados.set(rel, exp);

    for (const m of codigo.matchAll(/^import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/gm)) {
        const destino = path
            .relative(raiz, path.resolve(path.dirname(archivo), m[2]))
            .replace(/\\/g, "/");
        imports.push({
            archivo: rel,
            destino,
            nombres: m[1].split(",").map((s) => s.trim()).filter(Boolean)
        });
    }
}

for (const imp of imports) {
    const disponibles = exportados.get(imp.destino);
    if (!disponibles) {
        problemas.push(`${imp.archivo} importa de ${imp.destino}, que no existe`);
        continue;
    }
    for (const nombre of imp.nombres) {
        if (!disponibles.has(nombre)) {
            problemas.push(`${imp.archivo} importa '${nombre}' de ${imp.destino}, que no lo exporta`);
        }
    }
}

// Duplicados POR GRAFO DE CARGA: dos modulos pueden declarar el mismo nombre
// si nunca se cargan juntos. Cada .html es un punto de entrada independiente.
const adyacencia = new Map();
for (const imp of imports) {
    if (!adyacencia.has(imp.archivo)) adyacencia.set(imp.archivo, new Set());
    adyacencia.get(imp.archivo).add(imp.destino);
}

for (const vista of fs.readdirSync(raiz).filter((f) => f.endsWith(".html"))) {
    const contenido = fs.readFileSync(path.join(raiz, vista), "utf8");
    for (const m of contenido.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)) {
        const entrada = m[1].replace(/\\/g, "/");
        const alcanzados = new Set();
        const cola = [entrada];
        while (cola.length) {
            const actual = cola.shift();
            if (alcanzados.has(actual)) continue;
            alcanzados.add(actual);
            for (const siguiente of adyacencia.get(actual) || []) cola.push(siguiente);
        }

        for (const [nombre, donde] of declarados) {
            const enGrafo = donde.filter((d) => alcanzados.has(d));
            if (enGrafo.length > 1) {
                problemas.push(
                    `nombre duplicado en ${vista}: '${nombre}' esta en ${enGrafo.join(" y ")}`
                );
            }
        }
    }
}

// Referencias a un servicio a traves de window: al pasar de scripts clasicos a
// modulos, window.sb dejo de existir y estas llamadas fallan en tiempo de
// ejecucion. ESLint no las ve, porque es un acceso a propiedad.
const nombresExportados = new Set();
for (const conjunto of exportados.values()) {
    for (const nombre of conjunto) nombresExportados.add(nombre);
}

const esPuente = (linea, nombre) => new RegExp('window\\.' + nombre + '\\s*=').test(linea);

for (const archivo of archivos) {
    const rel = path.relative(raiz, archivo).split(path.sep).join('/');
    fs.readFileSync(archivo, 'utf8')
        .split(/\r?\n/)
        .forEach((linea, i) => {
            for (const m of linea.matchAll(/window\.(\w+)/g)) {
                const nombre = m[1];
                if (!nombresExportados.has(nombre)) continue;
                if (esPuente(linea, nombre)) continue;
                problemas.push(
                    rel + ':' + (i + 1) + ' usa window.' + nombre + ', que ya no se expone: hay que importarlo'
                );
            }
        });
}

// Ademas, cada <script type="module" src="..."> de las vistas debe existir
for (const vista of fs.readdirSync(raiz).filter((f) => f.endsWith(".html"))) {
    const contenido = fs.readFileSync(path.join(raiz, vista), "utf8");
    for (const m of contenido.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)) {
        if (!fs.existsSync(path.resolve(raiz, m[1]))) {
            problemas.push(`${vista} carga ${m[1]}, que no existe`);
        }
    }
}

console.log(`Modulos analizados: ${archivos.length}`);
console.log(`Declaraciones de nivel superior: ${declarados.size}`);
console.log(`Imports verificados: ${imports.length}`);

if (problemas.length === 0) {
    console.log("OK: todos los imports apuntan a exports existentes y no hay nombres duplicados.");
    process.exit(0);
}

console.log(`\nATENCION: ${problemas.length} problema(s):`);
for (const p of problemas) console.log("   - " + p);
process.exit(1);
