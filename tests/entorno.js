// ============================================
// Entorno de pruebas de DOM
// Carga el index.html REAL en jsdom y reemplaza Supabase por un doble
// controlable. Se importa antes que cualquier modulo de js/: supabase-client.js
// crea el cliente al evaluarse, asi que el doble tiene que estar ya instalado.
// ============================================

import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const raiz = path.resolve(import.meta.dirname, "..");
const html = readFileSync(path.join(raiz, "index.html"), "utf8");

// ---------------------------------------------------------------- controles
export const estado = {
    // Respuesta por tabla. Los fixtures se guardan SIEMPRE como array: el doble
    // los desenvuelve solo cuando la consulta pide un unico registro.
    porTabla: {},
    // Respuesta para cualquier tabla no declarada (por defecto: no existe)
    generica: { data: null, error: { message: "tabla inexistente" } },
    sesion: { data: { session: null } },
    login: { data: { user: { id: "u1" } }, error: null },
    consultas: [],
    avisos: [],
    confirmaciones: [],
    respuestaConfirm: true,
    exportaciones: [],

    reiniciar() {
        this.porTabla = {};
        this.generica = { data: null, error: { message: "tabla inexistente" } };
        this.sesion = { data: { session: null } };
        this.login = { data: { user: { id: "u1" } }, error: null };
        this.consultas = [];
        this.avisos = [];
        this.confirmaciones = [];
        this.respuestaConfirm = true;
        this.exportaciones = [];
    },

    // Tablas consultadas desde el ultimo reinicio, sin repetir
    tablasConsultadas() {
        return [...new Set(this.consultas.map((c) => c.tabla))];
    },

    // Cuantas consultas se hicieron a una tabla
    vecesConsultada(tabla) {
        return this.consultas.filter((c) => c.tabla === tabla).length;
    }
};

// ------------------------------------------------------- doble de Supabase
function crearConsulta(tabla) {
    const registro = { tabla, pasos: [] };
    estado.consultas.push(registro);

    const responder = () => {
        const bruto = estado.porTabla[tabla] || estado.generica;
        if (!bruto || bruto.error) return bruto;

        const pideUno = registro.pasos.some(
            ([metodo]) => metodo === "single" || metodo === "maybeSingle"
        );
        const datos = bruto.data;

        if (pideUno && Array.isArray(datos)) return { ...bruto, data: datos[0] || null };
        if (!pideUno && datos && !Array.isArray(datos)) return { ...bruto, data: [datos] };
        return bruto;
    };

    const consulta = new Proxy(
        {},
        {
            get(_destino, propiedad) {
                if (typeof propiedad === "symbol") return undefined;
                if (propiedad === "then") {
                    // Convierte la consulta en "awaitable", como el builder real
                    return (resolver) => Promise.resolve().then(() => resolver(responder()));
                }
                return (...args) => {
                    registro.pasos.push([String(propiedad), args]);
                    return consulta;
                };
            }
        }
    );

    return consulta;
}

const clienteSupabaseFalso = {
    from: (tabla) => crearConsulta(tabla),
    auth: {
        getSession: async () => estado.sesion,
        signInWithPassword: async () => estado.login,
        signOut: async () => ({ error: null }),
        updateUser: async () => ({ error: null }),
        getUser: async () => ({ data: { user: { id: "u1" } }, error: null })
    },
    storage: {
        from: () => ({
            upload: async () => ({ data: { path: "productos/foto.jpg" }, error: null }),
            getPublicUrl: () => ({ data: { publicUrl: "http://localhost/foto.jpg" } })
        })
    },
    functions: {
        invoke: async () => ({ data: { ok: true, user: { id: "u9" } }, error: null })
    }
};

// ------------------------------------------------------------------- jsdom
// Cada test que necesita un DOM limpio llama a crearPagina(); los modulos leen
// document/window del global en tiempo de llamada, asi que basta con apuntarlos
// a la pagina nueva.
export let window;
export let document;

export function crearPagina() {
    const dom = new JSDOM(html, {
        url: "http://localhost:5500/",
        // Necesario para que se ejecuten los onclick="..." que el JS inyecta
        runScripts: "dangerously",
        pretendToBeVisual: true
    });

    window = dom.window;
    document = dom.window.document;

    // El SDK del CDN, sustituido por el doble
    window.supabase = { createClient: () => clienteSupabaseFalso };

    // jsdom no implementa los dialogos: se capturan para poder afirmar sobre ellos
    const alertFalso = (mensaje) => {
        estado.avisos.push(String(mensaje));
    };
    const confirmFalso = (mensaje) => {
        estado.confirmaciones.push(String(mensaje));
        return estado.respuestaConfirm;
    };
    window.alert = alertFalso;
    window.confirm = confirmFalso;
    window.prompt = () => null;

    // XLSX y pdf.js se cargan por CDN en la pagina real: aca se doblan
    window.XLSX = {
        utils: {
            aoa_to_sheet: (datos) => ({ datos }),
            book_new: () => ({ hojas: [] }),
            book_append_sheet: (libro, hoja, nombre) => libro.hojas.push({ hoja, nombre })
        },
        writeFile: (libro, nombre) => estado.exportaciones.push({ libro, nombre })
    };
    window.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 0 }) }) };

    // Globals que los modulos usan sin cualificar
    globalThis.window = window;
    globalThis.document = document;
    globalThis.localStorage = window.localStorage;
    globalThis.alert = alertFalso;
    globalThis.confirm = confirmFalso;
    globalThis.prompt = window.prompt;
    globalThis.XLSX = window.XLSX;
    globalThis.pdfjsLib = window.pdfjsLib;
    globalThis.FileReader = window.FileReader;
    globalThis.Blob = window.Blob;
    globalThis.FormData = window.FormData;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.Event = window.Event;
    globalThis.MouseEvent = window.MouseEvent;

    return { dom, window, document };
}

// Pagina por defecto, para no obligar a crearla en cada test
crearPagina();

// ============================================
// Monta una pagina nueva Y una instancia nueva de la aplicacion.
// El controlador guarda estado en el ambito del modulo (productos, filtros,
// carrito, sesion), asi que para que un test no herede el estado del anterior hay
// que reimportarlo con una version distinta en la URL: es el equivalente a
// recargar la pagina.
// ============================================
let versionModulo = 0;

export async function cargarAplicacion() {
    crearPagina();
    versionModulo++;
    return await import(`../js/paginas/catalogo.js?v=${versionModulo}`);
}

// --------------------------------------------------------- utilidades de test
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];

// Crea un evento y lo dispara, como haria el navegador
export function disparar(elemento, tipo, propiedades = {}) {
    const evento = new window.Event(tipo, { bubbles: true, cancelable: true });
    Object.assign(evento, propiedades);
    elemento.dispatchEvent(evento);
    return evento;
}

export function escribir(elemento, valor) {
    elemento.value = valor;
    disparar(elemento, "input");
}

// Deja pasar los microtasks y los temporizadores ya programados
export const esperar = (ms = 0) => new Promise((resolver) => setTimeout(resolver, ms));

// --------------------------------------------------------------- fixtures
export function perfilAdmin(extra = {}) {
    return {
        id: "u1",
        nombre: "Admin de Prueba",
        rol: "superusuario",
        activo: true,
        ultimo_login: null,
        ...extra
    };
}

export const categoriaFila = (cambios = {}) => ({
    id: "c1",
    nombre: "Motor",
    icono: "M",
    activa: true,
    ...cambios
});

export const marcaFila = (cambios = {}) => ({ id: "m1", nombre: "Fraco", activa: true, ...cambios });

// Lo que responde PostgREST para un producto: forma anidada, sin adaptar
export function filaProducto(cambios = {}) {
    return {
        id: "p1",
        codigo: "COD-1",
        nombre: "Filtro de aceite",
        descripcion: "Filtro para motor 1.6",
        precio_base: 100,
        imagen_url: null,
        activo: true,
        destacado: false,
        descuento: 0,
        created_at: "2025-01-01T00:00:00Z",
        categoria_id: "c1",
        marca_id: "m1",
        categorias: { id: "c1", nombre: "Motor", icono: "M" },
        marcas: { id: "m1", nombre: "Fraco" },
        variantes_producto: [
            { id: "v1", sku: "COD-1", atributos: {}, precio: 100, stock: 7, stock_minimo: 5, activo: true }
        ],
        ...cambios
    };
}

// Configura un escenario tipico: sesion de administrador y catalogo chico
export function escenarioAdmin({
    productos = [filaProducto()],
    categorias = [categoriaFila()],
    marcas = [marcaFila()],
    clientes = [],
    ventas = []
} = {}) {
    estado.reiniciar();
    estado.sesion = { data: { session: { user: { id: "u1" } } } };
    estado.porTabla.perfiles = { data: [perfilAdmin()], error: null };
    estado.porTabla.productos = { data: productos, error: null };
    estado.porTabla.categorias = { data: categorias, error: null };
    estado.porTabla.marcas = { data: marcas, error: null };
    estado.porTabla.clientes = { data: clientes, error: null };
    estado.porTabla.ventas = { data: ventas, error: null };
    estado.porTabla.mensajes_contacto = { data: [], error: null };
    return estado;
}
