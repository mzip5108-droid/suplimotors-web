// ============================================
// Entrada de la pagina de catalogo (index.html)
// Solo arranca la aplicacion: el estado vive en catalogo/estado.js y cada
// responsabilidad en su propio modulo de catalogo/.
// ============================================

import { actualizarSelectCategorias, actualizarSelectMarcas, inicializarAdmin, inicializarExcel } from "../catalogo/admin.js";
import { actualizarCarrito, actualizarResumenPedido, enviarPedidoWhatsApp } from "../catalogo/carrito.js";
import { cargarCategoriasDesdeSupabase, cargarMarcasDesdeSupabase, cargarProductosDesdeSupabase, ocultarOverlayCarga } from "../catalogo/datos.js";
import { actualProd, cantidadSeleccionada, carrito, guardarCarrito, perfilActual, setCantidadSeleccionada, setCarrito, setCategoriaActiva, setPaginaActual, setTextoBusqueda } from "../catalogo/estado.js";
import { inicializarFiltros, leerCategoriaDeURL } from "../catalogo/filtros.js";
import { actualizarEstadisticasInventario, actualizarFiltroMarcas, renderizarCategorias, renderizarProductos, renderizarProductosConPaginacion } from "../catalogo/render.js";
import { cerrarSesion, inicializarRecuperar, iniciarSesion, verificarSesion } from "../catalogo/sesion.js";
import { inicializarMejoras, inicializarSearchPanel, inicializarUserDropdown } from "../catalogo/ui.js";
import { inicializarClientes } from "./clientes.js";
import { inicializarImportador, llenarSelectCategoriaImportar, llenarSelectMarcaImportar } from "./importador-excel.js";
import { inicializarMensajes } from "./mensajes.js";
import { actualizarReportes } from "./reportes.js";
import { inicializarUsuarios } from "./usuarios.js";

export async function arrancarCatalogo() {
    document.body.style.overflow = 'hidden';
    leerCategoriaDeURL();
    // 1. VERIFICAR SESION PRIMERO
    await verificarSesion();
    await cargarCategoriasDesdeSupabase();
    await cargarMarcasDesdeSupabase();
    await cargarProductosDesdeSupabase();


    // 2. INICIALIZAR TODO
    inicializarRecuperar();
    renderizarCategorias();
    actualizarSelectCategorias();
    actualizarSelectMarcas();
    renderizarProductos();
    actualizarCarrito();
    actualizarFiltroMarcas();
    actualizarEstadisticasInventario();
    inicializarFiltros();
    inicializarAdmin();
    inicializarImportador();
    inicializarExcel();
    // Carga los clientes desde Supabase, los pinta y deja armado el buscador
    await inicializarClientes();
    actualizarReportes();
    inicializarMejoras();
    inicializarUserDropdown();
    inicializarMensajes();
    inicializarUsuarios();
    inicializarSearchPanel();
    renderizarProductosConPaginacion();
    llenarSelectMarcaImportar();
    llenarSelectCategoriaImportar();
        setTimeout(() => {
        ocultarOverlayCarga();
    }, 500);

const buscadorInput = document.getElementById('buscador-input');
if (buscadorInput) {
    buscadorInput.addEventListener('input', function(e) {
        setTextoBusqueda(e.target.value);
        setPaginaActual(1);
        renderizarProductosConPaginacion();
    });
}

// mismo tratamiento para el panel de búsqueda expandible
const searchPanelInput = document.getElementById('search-panel-input');
if (searchPanelInput) {
    searchPanelInput.addEventListener('input', function(e) {
        setTextoBusqueda(e.target.value);
        setPaginaActual(1);
        renderizarProductosConPaginacion();
    });
}

    // ✅ CATEGORIAS CON PAGINACION
    document.querySelectorAll('.categoria-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            setCategoriaActiva(this.dataset.categoria);
            setPaginaActual(1);
            renderizarProductosConPaginacion();
        });
    });

    // 3. EVENTOS DEL DETALLE DE PRODUCTO
    const btnMas = document.getElementById("btn-mas");
    const btnMenos = document.getElementById("btn-menos");
    const inputCantidad = document.getElementById("input-cantidad");
    
    if (btnMas) {
        btnMas.onclick = () => {
        setCantidadSeleccionada(cantidadSeleccionada + 1);
        if (inputCantidad) inputCantidad.value = cantidadSeleccionada;
    };
    }
    
    if (btnMenos) {
        btnMenos.onclick = () => {
            if(cantidadSeleccionada > 1) {
                setCantidadSeleccionada(cantidadSeleccionada - 1);
                if (inputCantidad) inputCantidad.value = cantidadSeleccionada;
            }
        };
    }
    
    const btnCerrarDetalle = document.getElementById("cerrar-detalle");
    if (btnCerrarDetalle) {
        btnCerrarDetalle.onclick = () => document.getElementById("modal-detalle").style.display = "none";
    }
    
    // 4. EVENTOS DEL CARRITO
    const sidebar = document.getElementById("carrito-desplegable");
    const abrirCarrito = document.getElementById("abrir-carrito");
    const cerrarCarrito = document.getElementById("cerrar-carrito");
    
    if (abrirCarrito) {
        abrirCarrito.onclick = () => sidebar.classList.add("active");
    }
    if (cerrarCarrito) {
        cerrarCarrito.onclick = () => sidebar.classList.remove("active");
    }
    
    // 5. AGREGAR AL CARRITO DESDE DETALLE
    const btnAniadirDetalle = document.getElementById("btn-anadir-desde-detalle");
    if (btnAniadirDetalle) {
        btnAniadirDetalle.onclick = () => {
            if (actualProd) {
                const itemEnCarrito = carrito.find(item => item.id === actualProd.id);
                if (itemEnCarrito) {
                    itemEnCarrito.cantidad += cantidadSeleccionada;
                } else {
                    carrito.push({ ...actualProd, cantidad: cantidadSeleccionada });
                }
                guardarCarrito();
                actualizarCarrito();
                document.getElementById("modal-detalle").style.display = "none";
                alert(`${cantidadSeleccionada}x ${actualProd.nombre} agregado al carrito`);
            }
        };
    }
    
    // 6. VACIAR CARRITO
    const btnVaciar = document.getElementById("btn-vaciar");
    if (btnVaciar) {
        btnVaciar.onclick = () => {
            if(confirm("Vaciar todo el carrito?")) {
                setCarrito([]);
                guardarCarrito();
                actualizarCarrito();
            }
        };
    }
    
    // 7. FINALIZAR COMPRA
    const btnFinalizarCompra = document.getElementById("btn-finalizar-compra");
    if (btnFinalizarCompra) {
        btnFinalizarCompra.onclick = () => {
            if(carrito.length === 0) {
                alert("El carrito esta vacio");
                return;
            }
            actualizarResumenPedido();
            document.getElementById("modal-compra").style.display = "block";
        };
    }
    
    // 8. CONFIRMAR PEDIDO
    document.getElementById("btn-confirmar").onclick = (e) => {
        e.preventDefault();
        enviarPedidoWhatsApp();
    };
    
    // 9. CERRAR MODALES
    document.getElementById("cerrar-factura").onclick = () => {
        document.getElementById("modal-compra").style.display = "none";
    };
    
    const btnCancelar = document.getElementById("btn-cancelar");
    if (btnCancelar) {
        btnCancelar.onclick = () => document.getElementById("modal-compra").style.display = "none";
    }
    
    // 10. EVENTOS DE LOGIN
    document.getElementById('btn-login').addEventListener('click', iniciarSesion);
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') iniciarSesion();
    });
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
    document.getElementById('btn-logout-header').addEventListener('click', cerrarSesion);


    // 11. EVENTOS DE CLIENTES: los arma el modulo de clientes (ver inicializarClientes)

    // 12. EVENTOS DE REPORTES
    document.getElementById('btn-actualizar-reporte').addEventListener('click', actualizarReportes);
    
    // 13. CERRAR MODALES AL HACER CLICK FUERA
window.onclick = (event) => {
    const modalDetalle = document.getElementById("modal-detalle");
    const modalCompra = document.getElementById("modal-compra");
    const modalLogin = document.getElementById("modal-login");
    
    if (event.target === modalDetalle) modalDetalle.style.display = "none";
    if (event.target === modalCompra) modalCompra.style.display = "none";
    
    // Bloquear cierre del modal de login si no hay sesión
    if (event.target === modalLogin && perfilActual) {
        modalLogin.style.display = "none";
    }
};
}
