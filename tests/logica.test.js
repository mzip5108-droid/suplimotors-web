// ============================================
// Tests de la logica de negocio que no depende del DOM
// Se ejecutan con: npm test  (runner nativo de Node, sin dependencias)
//
// Los modulos son ES y de navegador, asi que antes de importarlos se instalan
// stubs minimos de `window`, `localStorage` y del cliente de Supabase.
// ============================================

import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------- stubs
let respuestaSupabase = { data: null, error: { message: "tabla inexistente" } };
let historialLocal = null;

const clienteSupabaseFalso = {
    from() {
        return {
            select: () => ({ order: async () => respuestaSupabase }),
            insert: () => ({ select: () => ({ single: async () => respuestaSupabase }) }),
            update: () => ({ eq: async () => respuestaSupabase }),
            delete: () => ({ eq: async () => respuestaSupabase })
        };
    },
    auth: {
        getSession: async () => ({ data: { session: null } })
    }
};

globalThis.window = globalThis.window || {};
globalThis.window.supabase = { createClient: () => clienteSupabaseFalso };
globalThis.localStorage = {
    getItem: (clave) => (clave === "supli_motors_historial" ? historialLocal : null),
    setItem: () => {},
    removeItem: () => {}
};

// ---------------------------------------------------------------- imports
const { ProductService } = await import("../js/servicios/product-service.js");
const { ExcelImportService } = await import("../js/servicios/excel-import-service.js");
const { VentaService } = await import("../js/servicios/venta-service.js");
const { getImagenMarca } = await import("../js/lib/imagenes-marcas.js");
const { normalizarTexto } = await import("../js/lib/util.js");

// ================================================================ utilidades
test("normalizarTexto quita tildes, mayusculas y espacios sobrantes", () => {
    assert.equal(normalizarTexto("  Gomas de Válvulas  "), "gomas de valvulas");
    assert.equal(normalizarTexto(""), "");
    assert.equal(normalizarTexto(null), "");
});

test("getImagenMarca encuentra el logo ignorando tildes y mayusculas", () => {
    assert.equal(getImagenMarca("Gomas de Válvulas"), "img/marcas/gomas-de-valvulas.jpg");
    assert.equal(getImagenMarca("  FEDERAL MOGUL "), "img/marcas/federal-mogul.jpg");
});

test("getImagenMarca resuelve Exact y Exactcar al mismo archivo", () => {
    assert.equal(getImagenMarca("Exact"), "img/marcas/exact.jpg");
    assert.equal(getImagenMarca("Exactcar"), "img/marcas/exact.jpg");
});

test("getImagenMarca devuelve null si la marca no tiene logo", () => {
    assert.equal(getImagenMarca("Marca Inexistente"), null);
    assert.equal(getImagenMarca(""), null);
    assert.equal(getImagenMarca(null), null);
});

// ================================================================ importador
test("detecta las columnas tipicas de una planilla", () => {
    const columnas = ExcelImportService._detectarColumnas([
        "Codigo",
        "Descripcion",
        "Precio",
        "Cantidad",
        "Marca",
        "Categoria"
    ]);
    assert.deepEqual(columnas, {
        codigo: 0,
        nombre: 1,
        precio: 2,
        cantidad: 3,
        marca: 4,
        categoria: 5
    });
});

test("prefiere 'Codigo' antes que 'Codigo de barras'", () => {
    const columnas = ExcelImportService._detectarColumnas(["Codigo de barras", "Codigo", "Producto", "PVP"]);
    assert.equal(columnas.codigo, 1, "debe elegir la coincidencia exacta");
    assert.equal(columnas.nombre, 2);
    assert.equal(columnas.precio, 3);
});

test("no asigna la misma columna a dos campos distintos", () => {
    const columnas = ExcelImportService._detectarColumnas(["Codigo producto", "Precio"]);
    assert.equal(columnas.codigo, 0);
    assert.notEqual(columnas.nombre, 0);
});

test("deja en null los campos sin columna y tolera encabezados vacios", () => {
    const soloNombre = ExcelImportService._detectarColumnas(["Nombre"]);
    assert.equal(soloNombre.nombre, 0);
    assert.equal(soloNombre.codigo, null);
    assert.equal(soloNombre.precio, null);

    assert.equal(ExcelImportService._detectarColumnas(null).codigo, null);
    assert.equal(ExcelImportService._detectarColumnas([null, "", "   "]).codigo, null);
});

// ================================================================ productos
test("el precio de catalogo es el menor de las variantes", () => {
    const producto = ProductService._adaptarProducto({
        id: "p1",
        codigo: "A1",
        nombre: "Filtro",
        precio_base: 100,
        variantes_producto: [
            { id: "v1", precio: 150, stock: 2, activo: true },
            { id: "v2", precio: 120, stock: 3, activo: true }
        ]
    });
    assert.equal(producto.precio, 120);
    assert.equal(producto.stock, 5);
});

test("sin variantes con precio valido usa el precio base", () => {
    const producto = ProductService._adaptarProducto({
        id: "p2",
        codigo: "A2",
        nombre: "Bujia",
        precio_base: 80,
        variantes_producto: [{ id: "v1", precio: 0, stock: 1, activo: true }]
    });
    assert.equal(producto.precio, 80);
});

test("las variantes inactivas no suman stock", () => {
    const producto = ProductService._adaptarProducto({
        id: "p3",
        codigo: "A3",
        nombre: "Correa",
        precio_base: 10,
        variantes_producto: [
            { id: "v1", precio: 10, stock: 4, activo: true },
            { id: "v2", precio: 10, stock: 9, activo: false }
        ]
    });
    assert.equal(producto.stock, 4);
});

test("marca_id se propaga y la categoria tiene valor por defecto", () => {
    const producto = ProductService._adaptarProducto({
        id: "p4",
        codigo: "A4",
        nombre: "Bomba",
        precio_base: 1,
        marca_id: "m1"
    });
    assert.equal(producto.marca_id, "m1");
    assert.equal(producto.marca, null);
    assert.equal(producto.categoria_nombre, "Sin categoría");
});

test("crear rechaza precios invalidos antes de tocar la base", async () => {
    const sinPrecio = await ProductService.crear({
        codigo: "C1",
        nombre: "Nombre",
        precio: "abc",
        categoria_id: "cat-1"
    });
    assert.equal(sinPrecio.ok, false);
    assert.match(sinPrecio.error, /precio/i);

    const precioCero = await ProductService.crear({
        codigo: "C2",
        nombre: "Nombre",
        precio: 0,
        categoria_id: "cat-1"
    });
    assert.equal(precioCero.ok, false);
    assert.match(precioCero.error, /precio/i);
});

test("crear exige codigo, nombre y categoria", async () => {
    const resultado = await ProductService.crear({ precio: 10 });
    assert.equal(resultado.ok, false);
    assert.match(resultado.error, /campos obligatorios/i);
});

// ================================================================ ventas
test("no registra una venta sin items", async () => {
    const resultado = await VentaService.registrar({ nombre: "X", cedula: "1" }, [], 0);
    assert.equal(resultado.ok, false);
});

test("el historial usa Supabase cuando esta disponible", async () => {
    respuestaSupabase = {
        error: null,
        data: [
            {
                id: "v1",
                numero: 1,
                created_at: "2025-01-01T10:00:00Z",
                total: "100.50",
                cedula: "123",
                nombre_cliente: "Ana",
                estado: "pendiente",
                venta_items: [{ nombre: "Filtro", cantidad: 2, precio_unitario: 50.25 }]
            }
        ]
    };

    const resultado = await VentaService.historial();
    assert.equal(resultado.origen, "supabase");
    assert.equal(resultado.data[0].total, 100.5);
    assert.equal(resultado.data[0].carrito[0].cantidad, 2);
    assert.equal(resultado.data[0].carrito[0].precio, 50.25);
});

test("el historial cae al respaldo del navegador si la tabla no existe", async () => {
    respuestaSupabase = { data: null, error: { message: 'relation "ventas" does not exist' } };
    historialLocal = JSON.stringify([
        {
            cedula: "123",
            total: "50",
            fecha: "1/1/2025",
            carrito: [{ nombre: "Bujia", cantidad: 2, precio: 25 }]
        }
    ]);

    const resultado = await VentaService.historial();
    assert.equal(resultado.origen, "local");
    assert.equal(resultado.data.length, 1);
    assert.equal(resultado.data[0].total, 50);
    assert.equal(resultado.data[0].carrito[0].nombre, "Bujia");
});
