// ============================================
// Estado compartido del catalogo
// ============================================

export let productos = JSON.parse(localStorage.getItem("supli_motors_productos")) || [];

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setProductos(valor) {
    productos = valor;
}

export const categorias = JSON.parse(localStorage.getItem("supli_motors_categorias")) || [
    { id: "motor", nombre: "Motor", icono: "M" },
    { id: "transmision", nombre: "Transmision", icono: "T" },
    { id: "frenos", nombre: "Frenos", icono: "F" },
    { id: "suspension", nombre: "Suspension", icono: "S" },
    { id: "electrico", nombre: "Electrico", icono: "E" },
    { id: "lubricantes", nombre: "Lubricantes", icono: "L" },
    { id: "refrigeracion", nombre: "Refrigeracion", icono: "R" }
];

export let carrito = JSON.parse(localStorage.getItem("supli_motors_carrito")) || [];

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setCarrito(valor) {
    carrito = valor;
}

export let actualProd = null;

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setActualProd(valor) {
    actualProd = valor;
}

export let cantidadSeleccionada = 1;

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setCantidadSeleccionada(valor) {
    cantidadSeleccionada = valor;
}

export let categoriaActiva = 'todos';

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setCategoriaActiva(valor) {
    categoriaActiva = valor;
}

export let textoBusqueda = '';

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setTextoBusqueda(valor) {
    textoBusqueda = valor;
}

export let marcaFiltro = '';

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setMarcaFiltro(valor) {
    marcaFiltro = valor;
}

export let rangoPrecio = '';

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setRangoPrecio(valor) {
    rangoPrecio = valor;
}

export let stockFiltro = '';

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setStockFiltro(valor) {
    stockFiltro = valor;
}

export let perfilActual = null;

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setPerfilActual(valor) {
    perfilActual = valor;
}

export let temaActual = localStorage.getItem('supli_motors_tema') || 'claro';

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setTemaActual(valor) {
    temaActual = valor;
}

export let vistaActual = localStorage.getItem('supli_motors_vista') || 'grilla';

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setVistaActual(valor) {
    vistaActual = valor;
}

export let paginaActual = 1;

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setPaginaActual(valor) {
    paginaActual = valor;
}

export const productosPorPagina = 24;

export let productosFiltradosCache = [];

// Un import de modulo ES es de solo lectura, asi que el resto de los
// modulos cambia este valor a traves de este setter.
export function setProductosFiltradosCache(valor) {
    productosFiltradosCache = valor;
}

export const guardarInventario = () => localStorage.setItem("supli_motors_productos", JSON.stringify(productos));

export const guardarCategorias = () => localStorage.setItem("supli_motors_categorias", JSON.stringify(categorias));

export const guardarCarrito = () => localStorage.setItem("supli_motors_carrito", JSON.stringify(carrito));

// ============================================
// REINICIO DEL ESTADO
// Vuelve todo a su valor de partida. Lo usan los tests para aislar cada caso:
// el estado de un modulo ES se comparte durante toda la vida del proceso.
// ============================================
export function reiniciarEstado() {
    productos = [];
    carrito = [];
    productosFiltradosCache = [];
    actualProd = null;
    cantidadSeleccionada = 1;
    categoriaActiva = "todos";
    textoBusqueda = "";
    marcaFiltro = "";
    rangoPrecio = "";
    stockFiltro = "";
    perfilActual = null;
    temaActual = localStorage.getItem("supli_motors_tema") || "claro";
    vistaActual = localStorage.getItem("supli_motors_vista") || "grilla";
    paginaActual = 1;
}
