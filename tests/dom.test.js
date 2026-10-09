// ============================================
// Tests de DOM sobre el index.html real
// Cada test monta una pagina nueva con jsdom, configura un Supabase falso y
// ejecuta el arranque de verdad. Cubren el render, el escapado de datos
// hostiles, los filtros, la paginacion, el carrito y el login.
// ============================================

import test from "node:test";
import assert from "node:assert/strict";

import {
    cargarAplicacion,
    escenarioAdmin,
    estado,
    perfilAdmin,
    filaProducto,
    categoriaFila,
    marcaFila,
    escribir,
    esperar,
    window
} from "./entorno.js";

// El controlador se importa DESPUES del entorno (supabase-client.js crea el
// cliente al evaluarse) y con cargarAplicacion(), que da una instancia limpia
// por test. AuthService si se comparte: es el mismo objeto que usa la app.
const { AuthService } = await import("../js/servicios/auth-service.js");

const tarjetas = () => [...document.querySelectorAll(".tarjeta-producto")];
const textoDe = (selector) => {
    const elemento = document.querySelector(selector);
    return elemento ? elemento.textContent : null;
};

// ============================================================ arranque y render
test("arranca con sesion de administrador y pinta el catalogo", async () => {
    const app = await cargarAplicacion();
    escenarioAdmin({
        productos: [
            filaProducto(),
            filaProducto({ id: "p2", codigo: "COD-2", nombre: "Bujia de encendido" })
        ]
    });

    await app.arrancarCatalogo();
    // Deja correr los temporizadores del overlay de carga
    await esperar(600);

    assert.equal(tarjetas().length, 2, "deberia pintar las dos tarjetas");
    assert.match(textoDe("#resultados-busqueda"), /2/, "el contador de resultados deberia actualizarse");
    assert.equal(document.querySelector("#modal-login").style.display, "none", "no deberia pedir login");
});

test("un cliente ve el catalogo pero no las acciones de administracion", async () => {
    const app = await cargarAplicacion();
    escenarioAdmin();
    estado.porTabla.perfiles = {
        data: [perfilAdmin({ rol: "cliente", nombre: "Cliente de Prueba" })],
        error: null
    };

    await app.arrancarCatalogo();

    assert.equal(tarjetas().length, 1);
    assert.equal(document.querySelector(".btn-privatizar"), null, "un cliente no debe poder privatizar");
    assert.equal(document.querySelector(".btn-eliminar-admin"), null, "un cliente no debe poder eliminar");
});

test("con el catalogo vacio muestra el mensaje de sin resultados", async () => {
    const app = await cargarAplicacion();
    escenarioAdmin({ productos: [] });

    await app.arrancarCatalogo();

    assert.equal(tarjetas().length, 0);
    assert.ok(document.querySelector(".no-resultados"), "deberia mostrar el aviso de sin resultados");
});

// =================================================================== escapado
test("los datos hostiles del producto se pintan como texto, no como HTML", async () => {
    const app = await cargarAplicacion();

    const nombreHostil = '<img src=x onerror="window.__xss=1">';
    const codigoHostil = "<b>COD</b>";
    escenarioAdmin({
        productos: [filaProducto({ nombre: nombreHostil, codigo: codigoHostil })],
        marcas: [marcaFila({ nombre: "<i>Fraco</i>" })]
    });

    await app.arrancarCatalogo();

    const tarjeta = tarjetas()[0];
    assert.ok(tarjeta, "deberia haber una tarjeta");

    const titulo = tarjeta.querySelector("h3");
    assert.equal(titulo.textContent, nombreHostil, "el nombre debe conservarse como texto");
    assert.equal(titulo.children.length, 0, "no debe crearse ningun nodo desde el HTML inyectado");

    assert.equal(tarjeta.querySelector(".codigo-producto").textContent, codigoHostil);
    assert.equal(tarjeta.querySelectorAll("b").length, 0, "no debe aparecer el <b> inyectado");
    assert.equal(window.__xss, undefined, "no debe ejecutarse el onerror inyectado");
});

test("el detalle del producto tambien escapa el codigo y la marca", async () => {
    const app = await cargarAplicacion();
    escenarioAdmin({
        productos: [filaProducto({ codigo: "<script>alert(1)</script>", marcas: { id: "m1", nombre: "<u>Fraco</u>" } })]
    });

    await app.arrancarCatalogo();
    tarjetas()[0].click();

    assert.equal(textoDe("#detalle-codigo"), "Cod: <script>alert(1)</script>");
    assert.equal(document.querySelector("#detalle-codigo").children.length, 0);
    assert.equal(textoDe("#detalle-marca"), "Marca: <u>Fraco</u>");
    assert.equal(document.querySelector("#detalle-marca").children.length, 0);
});

// ==================================================================== filtros
test("el buscador filtra por nombre y por codigo, ignorando tildes y mayusculas", async () => {
    const app = await cargarAplicacion();
    escenarioAdmin({
        productos: [
            filaProducto({ id: "p1", codigo: "COD-1", nombre: "Filtro de aceite" }),
            filaProducto({ id: "p2", codigo: "BUJ-9", nombre: "Bujia de encendido" }),
            filaProducto({ id: "p3", codigo: "COR-3", nombre: "Correa de distribución" })
        ]
    });

    await app.arrancarCatalogo();
    assert.equal(tarjetas().length, 3);

    escribir(document.querySelector("#buscador-input"), "BUJIA");
    assert.equal(tarjetas().length, 1, "la busqueda deberia ignorar mayusculas");
    assert.match(tarjetas()[0].textContent, /Bujia/);

    escribir(document.querySelector("#buscador-input"), "distribucion");
    assert.equal(tarjetas().length, 1, "la busqueda deberia ignorar las tildes");
    assert.match(tarjetas()[0].textContent, /Correa/);

    escribir(document.querySelector("#buscador-input"), "zzz");
    assert.equal(tarjetas().length, 0);
    assert.match(textoDe("#resultados-busqueda"), /No se encontraron/i);
});

test("el buscador encuentra por codigo en minusculas", async () => {
    const app = await cargarAplicacion();
    escenarioAdmin({
        productos: [
            filaProducto({ id: "p1", codigo: "COD-1", nombre: "Filtro" }),
            filaProducto({ id: "p2", codigo: "XYZ-77", nombre: "Bujia" })
        ]
    });

    await app.arrancarCatalogo();
    escribir(document.querySelector("#buscador-input"), "xyz-77");

    assert.equal(tarjetas().length, 1);
    assert.match(tarjetas()[0].textContent, /Bujia/);
});

// ================================================================ paginacion
test("pagina de a 24 resultados y navega entre paginas", async () => {
    const app = await cargarAplicacion();
    const muchos = Array.from({ length: 30 }, (_, i) =>
        filaProducto({ id: `p${i}`, codigo: `COD-${i}`, nombre: `Producto ${i}` })
    );
    escenarioAdmin({ productos: muchos });

    await app.arrancarCatalogo();

    const irAPagina = (numero) => {
        const boton = [...document.querySelectorAll("#paginacion-container .btn-paginacion")].find(
            (b) => b.textContent.trim() === String(numero)
        );
        assert.ok(boton, `deberia existir el boton de la pagina ${numero}`);
        boton.click();
    };

    irAPagina(1);
    assert.equal(tarjetas().length, 24, "la primera pagina lleva 24");

    irAPagina(2);
    assert.equal(tarjetas().length, 6, "la segunda pagina lleva los 6 restantes");
});

// =================================================================== carrito
test("agregar al carrito y quitarlo actualiza el contador", async () => {
    const app = await cargarAplicacion();
    escenarioAdmin();
    await app.arrancarCatalogo();

    const contador = () => Number(document.querySelector("#contador-productos").textContent);
    const inicial = contador();

    // Abrir el detalle desde la tarjeta
    tarjetas()[0].click();
    assert.equal(document.querySelector("#modal-detalle").style.display, "block");

    // Agregar al carrito
    document.querySelector("#btn-anadir-desde-detalle").click();
    assert.equal(contador(), inicial + 1, "el contador deberia subir");

    // El item del carrito usa onclick inline: prueba el puente window.*
    assert.ok(document.querySelector("#lista-carrito").children.length > 0, "deberia listarse el item");
    const quitar = document.querySelector(".btn-quitar-item");
    assert.ok(quitar, "deberia existir el boton de quitar");
    quitar.click();

    assert.equal(contador(), inicial, "el contador deberia volver al valor inicial");
    assert.equal(document.querySelector("#lista-carrito").children.length, 0);
});

test("la cantidad seleccionada se respeta al agregar al carrito", async () => {
    const app = await cargarAplicacion();
    escenarioAdmin();
    await app.arrancarCatalogo();

    const contador = () => Number(document.querySelector("#contador-productos").textContent);
    const inicial = contador();

    tarjetas()[0].click();
    document.querySelector("#btn-mas").click();
    document.querySelector("#btn-mas").click();
    assert.equal(document.querySelector("#input-cantidad").value, "3", "deberia quedar en 3");

    document.querySelector("#btn-anadir-desde-detalle").click();
    assert.equal(contador(), inicial + 3, "el contador deberia subir de a 3");
});

// ===================================================================== login
test("al iniciar sesion se vuelven a pedir los datos del catalogo", async () => {
    const app = await cargarAplicacion();
    estado.reiniciar();

    // Escenario: todavia sin sesion, RLS hace que la carga anonima vuelva vacia
    estado.porTabla.productos = { data: [], error: null };
    estado.porTabla.categorias = { data: [categoriaFila()], error: null };
    estado.porTabla.marcas = { data: [marcaFila()], error: null };
    estado.porTabla.perfiles = { data: [perfilAdmin()], error: null };
    estado.porTabla.clientes = { data: [], error: null };
    estado.porTabla.ventas = { data: [], error: null };

    await app.arrancarCatalogo();
    assert.equal(tarjetas().length, 0, "sin sesion no deberia haber productos");
    assert.equal(document.querySelector("#modal-login").style.display, "block", "deberia pedir login");

    const consultasPrevias = estado.vecesConsultada("productos");

    // El login de Supabase abre la sesion; a partir de ahi RLS deja ver el catalogo
    const loginOriginal = AuthService.login;
    AuthService.login = async () => {
        estado.sesion = { data: { session: { user: { id: "u1" } } } };
        estado.porTabla.productos = { data: [filaProducto()], error: null };
        return { ok: true, perfil: perfilAdmin() };
    };

    try {
        document.querySelector("#login-usuario").value = "admin";
        document.querySelector("#login-password").value = "secreta";
        await app.iniciarSesion();
    } finally {
        AuthService.login = loginOriginal;
    }

    assert.equal(document.querySelector("#modal-login").style.display, "none", "el modal deberia cerrarse");
    assert.ok(
        estado.vecesConsultada("productos") > consultasPrevias,
        "tras el login hay que volver a pedir el catalogo (bug de la sesion anonima)"
    );
    assert.equal(tarjetas().length, 1, "el administrador deberia ver el catalogo recien cargado");
    assert.ok(document.querySelector(".btn-privatizar"), "deberia ver sus acciones de administracion");
});

test("un login fallido muestra el error y deja el modal abierto", async () => {
    const app = await cargarAplicacion();
    estado.reiniciar();
    estado.porTabla.categorias = { data: [categoriaFila()], error: null };
    estado.porTabla.marcas = { data: [marcaFila()], error: null };
    estado.porTabla.productos = { data: [], error: null };

    await app.arrancarCatalogo();

    const loginOriginal = AuthService.login;
    AuthService.login = async () => ({ ok: false, error: "Credenciales invalidas" });

    try {
        document.querySelector("#login-usuario").value = "admin";
        document.querySelector("#login-password").value = "mal";
        await app.iniciarSesion();
    } finally {
        AuthService.login = loginOriginal;
    }

    assert.equal(document.querySelector("#modal-login").style.display, "block");
    assert.equal(textoDe("#login-error"), "Credenciales invalidas");
});

// ====================================================== panel de administracion
test("las pestanas del panel cambian de contenido y cargan sus datos", async () => {
    const app = await cargarAplicacion();
    escenarioAdmin();
    estado.porTabla.clientes = {
        data: [
            {
                id: "c1",
                cedula: "12345678",
                nombre: "Ana Perez",
                telefono: "0414-0000000",
                email: "ana@ejemplo.com",
                direccion: null,
                activo: true,
                created_at: "2025-01-01T00:00:00Z"
            }
        ],
        error: null
    };

    await app.arrancarCatalogo();

    const pestanaClientes = document.querySelector('.admin-tab[data-tab="clientes"]');
    pestanaClientes.click();
    await esperar(20);

    assert.ok(
        document.querySelector("#tab-clientes").classList.contains("active"),
        "el panel de clientes deberia quedar visible"
    );
    const filas = document.querySelectorAll("#cuerpo-clientes tr");
    assert.equal(filas.length, 1, "deberia listar el cliente que vino de Supabase");
    assert.match(filas[0].textContent, /Ana Perez/);

    const pestanaMensajes = document.querySelector('.admin-tab[data-tab="mensajes"]');
    pestanaMensajes.click();
    assert.ok(document.querySelector("#tab-mensajes").classList.contains("active"));
    assert.ok(!document.querySelector("#tab-clientes").classList.contains("active"));
});

test("la pestana de mensajes lista los mensajes y cuenta los no leidos", async () => {
    const app = await cargarAplicacion();
    escenarioAdmin();
    estado.porTabla.mensajes_contacto = {
        data: [
            {
                id: "m1",
                nombre: "Juan Perez",
                email: "juan@ejemplo.com",
                telefono: "0414-1111111",
                asunto: "Consulta",
                mensaje: "Necesito un presupuesto",
                leido: false,
                created_at: "2025-02-01T10:00:00Z"
            }
        ],
        error: null
    };

    await app.arrancarCatalogo();
    document.querySelector('.admin-tab[data-tab="mensajes"]').click();
    await esperar(20);

    const lista = document.querySelector("#mensajes-lista");
    assert.match(lista.textContent, /Juan Perez/, "deberia listar el mensaje");
    assert.match(lista.textContent, /Necesito un presupuesto/);
    assert.equal(document.querySelector("#badge-mensajes").textContent, "1", "deberia contar 1 no leido");
});

test("privatizar un producto lo desactiva en Supabase y lo saca del catalogo", async () => {
    const app = await cargarAplicacion();
    escenarioAdmin();
    await app.arrancarCatalogo();

    assert.equal(tarjetas().length, 1);
    const boton = document.querySelector(".btn-privatizar");
    assert.ok(boton, "el admin deberia tener el boton de privatizar");

    boton.click();
    await esperar(20);

    const actualizacion = estado.consultas.find(
        (c) => c.tabla === "productos" && c.pasos.some(([metodo]) => metodo === "update")
    );
    assert.ok(
        actualizacion,
        "deberia haber actualizado el producto en Supabase (este camino usaba window.sb)"
    );
    assert.equal(estado.confirmaciones.length, 1, "deberia haber pedido confirmacion");
    assert.equal(tarjetas().length, 0, "el producto privatizado sale del catalogo");
});
