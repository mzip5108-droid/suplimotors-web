// Servidor estatico minimo para desarrollo, sin dependencias.
// Hace falta porque la aplicacion usa modulos ES: el navegador los bloquea si la
// pagina se abre con file:// (origen opaco), asi que hay que servirla por HTTP.
//
// Uso:  npm run dev        -> http://localhost:5500
//       PORT=8080 npm run dev
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const raiz = process.cwd();
const puerto = Number(process.env.PORT || 5500);

const TIPOS = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2"
};

const responder = (res, codigo, tipo, cuerpo) => {
    res.writeHead(codigo, { "Content-Type": tipo });
    res.end(cuerpo);
};

const servidor = http.createServer((req, res) => {
    const ruta = decodeURIComponent((req.url || "/").split("?")[0]);
    const relativa = ruta === "/" ? "index.html" : ruta.replace(/^\/+/, "");
    const destino = path.resolve(raiz, relativa);

    // Nunca servir fuera de la carpeta del proyecto
    if (destino !== raiz && !destino.startsWith(raiz + path.sep)) {
        responder(res, 403, "text/plain; charset=utf-8", "Prohibido");
        return;
    }

    fs.readFile(destino, (error, datos) => {
        if (error) {
            responder(res, 404, "text/plain; charset=utf-8", `No encontrado: ${relativa}`);
            return;
        }
        const tipo = TIPOS[path.extname(destino).toLowerCase()] || "application/octet-stream";
        responder(res, 200, tipo, datos);
    });
});

servidor.listen(puerto, () => {
    console.log(`Servidor de desarrollo: http://localhost:${puerto}`);
    console.log("Ctrl+C para detenerlo.");
});
