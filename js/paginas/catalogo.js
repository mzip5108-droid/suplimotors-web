// ============================================
// Controlador del catalogo: estado, filtros, render, carrito, administracion y sesion
// ============================================

import { PLACEHOLDER_IMG, getImagenMarca } from "../lib/imagenes-marcas.js";
import { normalizarTexto } from "../lib/util.js";
import { abrirModalCliente, guardarCliente, renderizarClientes } from "./clientes.js";
import { inicializarImportador, llenarSelectCategoriaImportar, llenarSelectMarcaImportar } from "./importador-excel.js";
import { cargarMensajes, inicializarMensajes } from "./mensajes.js";
import { actualizarReportes } from "./reportes.js";
import { cargarUsuarios, inicializarUsuarios } from "./usuarios.js";
import { AuthService } from "../servicios/auth-service.js";
import { BrandService } from "../servicios/brand-service.js";
import { CategoryService } from "../servicios/category-service.js";
import { ProductService } from "../servicios/product-service.js";

export let productos = JSON.parse(localStorage.getItem("supli_motors_productos")) || [];

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

export let actualProd = null;

export let cantidadSeleccionada = 1;

export let categoriaActiva = 'todos';

export let textoBusqueda = '';

export let marcaFiltro = '';

export let rangoPrecio = '';

export let stockFiltro = '';

export const guardarInventario = () => localStorage.setItem("supli_motors_productos", JSON.stringify(productos));

export const guardarCategorias = () => localStorage.setItem("supli_motors_categorias", JSON.stringify(categorias));

export const guardarCarrito = () => localStorage.setItem("supli_motors_carrito", JSON.stringify(carrito));

export function filtrarProductos() {
    let productosFiltrados = [...productos];

    // Filtro por categoría activa
    if (categoriaActiva !== 'todos') {
        productosFiltrados = productosFiltrados.filter(p => p.categoria === categoriaActiva);
    }

    // Filtro por texto de búsqueda (multi-palabra + categoría + descripción)
    if (textoBusqueda) {
        const busquedaNormalizada = normalizarTexto(textoBusqueda);
        // Dividir en palabras, ignorar vacías
        const palabras = busquedaNormalizada.split(/\s+/).filter(p => p.length > 0);

        productosFiltrados = productosFiltrados.filter(p => {
            // Construir un "texto completo" del producto con todos los campos
            const textoProducto = [
                p.nombre || '',
                p.codigo || '',
                p.marca || '',
                p.categoria_nombre || '',
                p.descripcion || ''
            ].map(normalizarTexto).join(' ');

            // El producto debe contener TODAS las palabras
            return palabras.every(palabra => textoProducto.includes(palabra));
        });
    }

    // Filtro por marca
    if (marcaFiltro) {
        productosFiltrados = productosFiltrados.filter(p => p.marca === marcaFiltro);
    }

    // Filtro por rango de precio
    if (rangoPrecio) {
        const [min, max] = rangoPrecio.split('-');
        productosFiltrados = productosFiltrados.filter(p => {
            if (max === '500+') return p.precio >= 500;
            return p.precio >= parseFloat(min) && p.precio <= parseFloat(max);
        });
    }

    // Filtro por stock
    if (stockFiltro === 'bajo') {
        productosFiltrados = productosFiltrados.filter(p => p.stock < 5 && p.stock > 0);
    } else if (stockFiltro === 'agotado') {
        productosFiltrados = productosFiltrados.filter(p => p.stock === 0);
    } else if (stockFiltro === 'normal') {
        productosFiltrados = productosFiltrados.filter(p => p.stock >= 5);
    }

    return productosFiltrados;
}

export function actualizarContadorResultados(mostrados) {
    const resultadosInfo = document.getElementById('resultados-busqueda');
    if (!resultadosInfo) return;
    
    const total = productos.length;
    
    if (mostrados === total) {
        resultadosInfo.innerHTML = `📦 Mostrando los ${total} productos`;
    } else if (mostrados === 0) {
        resultadosInfo.innerHTML = `🔍 No se encontraron productos (de ${total} totales)`;
    } else {
        resultadosInfo.innerHTML = `🔍 Mostrando <strong>${mostrados}</strong> de <strong>${total}</strong> productos`;
    }
}

// ============================================
// RENDER DE PRODUCTOS
// ============================================
// Punto de entrada: cualquier cambio de filtro se procesa desde aqui,
// vuelve a la pagina 1 y repinta. El render real esta en
// renderizarProductosConPaginacion() y las tarjetas en renderizarProductosPagina().
export function renderizarProductos() {
    paginaActual = 1;
    renderizarProductosConPaginacion();
}

export function renderizarCategorias() {
    const container = document.getElementById('categorias-container');
    if (!container) return;
    
    const categoriasSupabase = CategoryService.getCache();
    
    // Mostrar solo las primeras 8 categorías
    const LIMITE = 8;
    const categoriasMostradas = categoriasSupabase.slice(0, LIMITE);
    
    let html = `<button class="categoria-btn active" data-categoria="todos">Todos</button>`;
    
    categoriasMostradas.forEach(cat => {
        html += `<button class="categoria-btn" data-categoria="${cat.id}">${cat.nombre}</button>`;
    });
    
    // Botón "Explorar todas" que lleva a categorias.html
    if (categoriasSupabase.length > LIMITE) {
        html += `<a href="categorias.html" class="categoria-btn explorar-todas-btn">Explorar todas &rarr;</a>`;
    }
    
    container.innerHTML = html;
    
    // Event listeners de categorías
    container.querySelectorAll('.categoria-btn:not(.explorar-todas-btn)').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            categoriaActiva = btn.dataset.categoria;
            paginaActual = 1;
            renderizarProductosConPaginacion();
        });
    });
    
    // Marcar como activa la categoría que viene de la URL
    if (categoriaActiva && categoriaActiva !== 'todos') {
        const btnActivo = container.querySelector(`.categoria-btn[data-categoria="${categoriaActiva}"]`);
        if (btnActivo) {
            container.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('active'));
            btnActivo.classList.add('active');
        }
    }
}

// ============================================
// RENDERIZAR LISTA DE MARCAS (PANEL ADMIN)
// ============================================
export function renderizarListaMarcasAdmin() {
    const container = document.getElementById('lista-marcas');
    if (!container) return;
    
    const marcas = BrandService.getCache();
    container.innerHTML = '';
    
    if (marcas.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; font-size:0.875rem;">No hay marcas registradas</p>';
        return;
    }
    
    marcas.forEach(marca => {
        const div = document.createElement('div');
        div.className = 'categoria-item';
        div.innerHTML = `
            ${marca.nombre}
            <button data-id="${marca.id}" class="btn-eliminar-marca">X</button>
        `;
        container.appendChild(div);
    });
    
    // Event listeners para eliminar
    container.querySelectorAll('.btn-eliminar-marca').forEach(btn => {
        btn.addEventListener('click', () => {
            eliminarMarca(btn.dataset.id);
        });
    });
}

// ============================================
// AGREGAR MARCA
// ============================================
export async function agregarMarca() {
    const input = document.getElementById('nueva-marca-nombre');
    if (!input) return;
    
    const nombre = input.value.trim();
    
    if (!nombre) {
        alert('Ingresa el nombre de la marca');
        return;
    }
    
    const resultado = await BrandService.crear(nombre);
    
    if (!resultado.ok) {
        alert('Error al crear la marca: ' + resultado.error);
        return;
    }
    
     if (resultado.reactivada) {
        alert('Marca reactivada correctamente');
    } else if (resultado.yaExistia) {
        alert('Esa marca ya existe y está activa');
    } else {
        alert('Marca agregada correctamente');
    }
    
    
    input.value = '';
    renderizarListaMarcasAdmin();
    actualizarSelectMarcas();
}

// ============================================
// ACTUALIZAR SELECT DE CATEGORÍAS EN EL FORMULARIO
// ============================================
export function actualizarSelectCategorias() {
    const select = document.getElementById('nueva-categoria');
    if (!select) return;
    
    const categorias = CategoryService.getCache();
    const valorActual = select.value;
    
    select.innerHTML = '<option value="">Seleccionar categoria</option>';
    
    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = `${cat.icono ? cat.icono + ' ' : ''}${cat.nombre}`;
        select.appendChild(option);
    });
    
    // Restaurar valor anterior si existía
    if (valorActual && categorias.some(c => c.id === valorActual)) {
        select.value = valorActual;
    }
}

// ============================================
// ELIMINAR MARCA
// ============================================
export async function eliminarMarca(id) {
    if (!confirm('¿Eliminar esta marca? Los productos que la tengan quedarán sin marca.')) {
        return;
    }
    
    try {
        const { error } = await window.sb
            .from('marcas')
            .update({ activa: false })
            .eq('id', id);
        
        if (error) {
            alert('Error al eliminar: ' + error.message);
            return;
        }
        
        alert('Marca eliminada');
        
        // Recargar cache
        await BrandService.listar();
        
        renderizarListaMarcasAdmin();
        actualizarSelectMarcas();
        
    } catch (err) {
        console.error(err);
        alert('Error inesperado');
    }
}

// ============================================
// ACTUALIZAR SELECT DE MARCAS EN EL FORMULARIO
// ============================================
export function actualizarSelectMarcas() {
    const select = document.getElementById('nueva-marca');
    if (!select) return;
    
    const marcas = BrandService.getCache();
    const valorActual = select.value;
    
    select.innerHTML = '<option value="">Seleccionar marca</option>';
    
    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca.id;
        option.textContent = marca.nombre;
        select.appendChild(option);
    });
    
    // Restaurar valor anterior si existía
    if (valorActual && marcas.some(m => m.id === valorActual)) {
        select.value = valorActual;
    }
}

export function actualizarEstadisticasInventario() {
    const totalProductos = productos.length;
    const stockBajo = productos.filter(p => p.stock < 5 && p.stock > 0).length;
    const valorInventario = productos.reduce((sum, p) => sum + (p.precio * (p.stock || 0)), 0);
    
    const totalElem = document.getElementById('total-productos');
    const stockBajoElem = document.getElementById('stock-bajo');
    const valorElem = document.getElementById('valor-inventario');
    
    if (totalElem) totalElem.textContent = totalProductos;
    if (stockBajoElem) stockBajoElem.textContent = stockBajo;
    if (valorElem) valorElem.textContent = `$${valorInventario.toFixed(2)}`;
}

export function actualizarFiltroMarcas() {
    const marcas = [...new Set(productos.map(p => p.marca).filter(m => m))];
    const select = document.getElementById('filtro-marca');
    if (!select) return;
    
    select.innerHTML = '<option value="">Todas las marcas</option>';
    marcas.forEach(marca => {
        select.innerHTML += `<option value="${marca}">${marca}</option>`;
    });
}

export function actualizarCarrito() {
    const lista = document.getElementById("lista-carrito");
    let total = 0;
    let items = 0;
    
    if (lista) {
        lista.innerHTML = "";
        carrito.forEach((item, i) => {
            const sub = parseFloat(item.precio) * item.cantidad;
            total += sub;
            items += item.cantidad;
            lista.innerHTML += `
                <li>
                    <div>
                        <strong>${item.cantidad}x</strong> ${item.nombre}<br>
                        <small>$${sub.toFixed(2)}</small>
                    </div>
                    <button class="btn-quitar-item" onclick="quitarDelCarrito(${i})">X</button>
                </li>
            `;
        });
    }
    
    const totalPago = document.getElementById("total-pago");
    const contador = document.getElementById("contador-productos");
    if (totalPago) totalPago.innerText = total.toFixed(2);
    if (contador) contador.innerText = items;
}

export function quitarDelCarrito(index) {
    carrito.splice(index, 1);
    guardarCarrito();
    actualizarCarrito();
}

export async function eliminarProducto(id) {
    // ✅ Solo superusuario puede eliminar
    if (!perfilActual || perfilActual.rol !== 'superusuario') {
        alert('Solo el superusuario puede eliminar productos permanentemente.');
        return;
    }

    if (!confirm('¿ELIMINAR este producto permanentemente?\n\nEsta acción NO se puede deshacer.\n\nSi solo querés ocultarlo del catálogo, usá "Privatizar".')) {
        return;
    }

    try {
        // 1. Borrar variantes primero
        const { error: errorVariantes } = await window.sb
            .from('variantes_producto')
            .delete()
            .eq('producto_id', id);

        if (errorVariantes) {
            console.warn('Error al borrar variantes:', errorVariantes);
        }

        // 2. Borrar el producto
        const { error } = await window.sb
            .from('productos')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Error al eliminar: ' + error.message);
            return;
        }

        // 3. Remover del array local
        productos = productos.filter(p => p.id !== id);

        // 4. Re-renderizar
        renderizarProductosConPaginacion();
        actualizarEstadisticasInventario();
        actualizarFiltroMarcas();

        alert('Producto eliminado permanentemente.');

    } catch (err) {
        console.error('Error al eliminar:', err);
        alert('Error inesperado al eliminar');
    }
}

export async function eliminarCategoria(id) {
    if (!confirm('¿Eliminar esta categoría? Los productos que la tengan quedarán sin categoría.')) {
        return;
    }
    
    try {
        const { error } = await window.sb
            .from('categorias')
            .update({ activa: false })
            .eq('id', id);
        
        if (error) {
            alert('Error al eliminar: ' + error.message);
            return;
        }
        
        alert('Categoría eliminada');
        
        // Recargar cache
        await CategoryService.listar();
        
        // Actualizar TODO
        renderizarListaCategoriasAdmin();
        actualizarSelectCategorias();
        llenarSelectCategoriaImportar();
        renderizarCategorias();
        
    } catch (err) {
        console.error(err);
        alert('Error inesperado');
    }
}

export function abrirDetalle(producto) {
    actualProd = producto;
    cantidadSeleccionada = 1;
    
    const categoriaNombre = producto.categoria_nombre || 'Sin categoría';
    const categoriaIcono = producto.categoria_icono || '';    
    document.getElementById("input-cantidad").value = cantidadSeleccionada;
    document.getElementById("detalle-img").src =
        producto.imagen || getImagenMarca(producto.marca) || PLACEHOLDER_IMG;
    document.getElementById("detalle-nombre").innerText = producto.nombre;
    document.getElementById("detalle-codigo").textContent = `Cod: ${producto.codigo || ""}`;
    document.getElementById("detalle-categoria").textContent = `${categoriaIcono} ${categoriaNombre}`.trim();
    document.getElementById("detalle-desc").innerText = producto.descripcion || "Sin descripcion disponible";
    document.getElementById("detalle-precio").innerText = parseFloat(producto.precio).toFixed(2);
    
    if (document.getElementById("detalle-marca")) {
        document.getElementById("detalle-marca").textContent = producto.marca ? `Marca: ${producto.marca}` : '';
    }
    
    if (document.getElementById("detalle-stock")) {
        const stock = producto.stock || 0;
        const esAdmin = perfilActual && (perfilActual.rol === 'admin' || perfilActual.rol === 'superusuario');
        const stockElem = document.getElementById("detalle-stock");

        if (stockElem) {
            if (esAdmin) {
                stockElem.parentElement.style.display = 'block'; // o 'inline'
                stockElem.innerHTML = stock;
                stockElem.style.color = stock < 5 ? '#dc2626' : '#16a34a';
            } else {
                // Ocultar el párrafo completo de "Stock disponible: X unidades"
                stockElem.parentElement.style.display = 'none';
            }
        }
    }
    
    document.getElementById("modal-detalle").style.display = "block";
}

export function limpiarVenta() {
    carrito = [];
    guardarCarrito();
    location.reload();
}

export function inicializarFiltros() {
    const buscador = document.getElementById('buscador-input');
    if (buscador) {
        buscador.addEventListener('input', (e) => {
            textoBusqueda = e.target.value;
            renderizarProductos();
        });
    }
    
    
    const filtroMarca = document.getElementById('filtro-marca');
    if (filtroMarca) {
        filtroMarca.addEventListener('change', (e) => {
            marcaFiltro = e.target.value;
            renderizarProductos();
        });
    }
    
    const filtroPrecio = document.getElementById('filtro-rango-precio');
    if (filtroPrecio) {
        filtroPrecio.addEventListener('change', (e) => {
            rangoPrecio = e.target.value;
            renderizarProductos();
        });
    }
    
    const filtroStock = document.getElementById('filtro-stock');
    if (filtroStock) {
        filtroStock.addEventListener('change', (e) => {
            stockFiltro = e.target.value;
            renderizarProductos();
        });
    }
    
    const btnLimpiar = document.getElementById('btn-limpiar-filtros');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            textoBusqueda = '';
            marcaFiltro = '';
            rangoPrecio = '';
            stockFiltro = '';
            if (buscador) buscador.value = '';
            if (filtroMarca) filtroMarca.value = '';
            if (filtroPrecio) filtroPrecio.value = '';
            if (filtroStock) filtroStock.value = '';
            renderizarProductos();
        });
    }
    
    const btnFiltrosAvanzados = document.getElementById('btn-filtros-avanzados');
    const filtrosAvanzados = document.getElementById('filtros-avanzados');
    if (btnFiltrosAvanzados && filtrosAvanzados) {
        btnFiltrosAvanzados.addEventListener('click', () => {
            const isVisible = filtrosAvanzados.style.display !== 'none';
            filtrosAvanzados.style.display = isVisible ? 'none' : 'flex';
            btnFiltrosAvanzados.textContent = isVisible ? 'Filtros Avanzados' : 'Ocultar Filtros';
        });
    }
}

export function generarMensajeWhatsApp(datosCliente, carrito, total) {
    let mensaje = "SUPLI MOTORS - NUEVO PEDIDO\n\n";
    mensaje += "DATOS DEL CLIENTE\n";
    mensaje += `Nombre: ${datosCliente.nombre}\n`;
    mensaje += `Cedula: ${datosCliente.cedula}\n`;
    if (datosCliente.email) mensaje += `Email: ${datosCliente.email}\n`;
    if (datosCliente.telefono) mensaje += `Telefono: ${datosCliente.telefono}\n`;
    if (datosCliente.direccion) mensaje += `Direccion: ${datosCliente.direccion}\n`;
    if (datosCliente.notas) mensaje += `Notas: ${datosCliente.notas}\n`;
    
    mensaje += "\nDETALLE DEL PEDIDO\n";
    
    carrito.forEach((item, index) => {
        const subtotal = parseFloat(item.precio) * item.cantidad;
        mensaje += `${index + 1}. ${item.nombre}\n`;
        mensaje += `   Cantidad: ${item.cantidad}\n`;
        mensaje += `   Precio unitario: $${parseFloat(item.precio).toFixed(2)}\n`;
        mensaje += `   Subtotal: $${subtotal.toFixed(2)}\n\n`;
    });
    
    mensaje += `TOTAL A PAGAR: $${total}\n\n`;
    mensaje += "Gracias por tu compra!";
    
    return encodeURIComponent(mensaje);
}

export function actualizarResumenPedido() {
    const resumenItems = document.getElementById('resumen-items');
    const resumenTotal = document.getElementById('resumen-total');
    let total = 0;
    
    if (resumenItems) {
        resumenItems.innerHTML = '';
        carrito.forEach(item => {
            const subtotal = parseFloat(item.precio) * item.cantidad;
            total += subtotal;
            
            const div = document.createElement('div');
            div.className = 'resumen-item';
            div.innerHTML = `
                <span class="item-nombre">${item.nombre}</span>
                <span class="item-cantidad">${item.cantidad}x</span>
                <span class="item-subtotal">$${subtotal.toFixed(2)}</span>
            `;
            resumenItems.appendChild(div);
        });
    }
    
    if (resumenTotal) {
        resumenTotal.textContent = `$${total.toFixed(2)}`;
    }
    
    return total.toFixed(2);
}

export function enviarPedidoWhatsApp() {
    const nombre = document.getElementById("nombre-cliente").value.trim();
    const cedula = document.getElementById("cedula-cliente").value.trim();
    const email = document.getElementById("email-cliente").value.trim();
    const telefono = document.getElementById("telefono-cliente").value.trim();
    const direccion = document.getElementById("direccion-cliente").value.trim();
    const notas = document.getElementById("notas-cliente").value.trim();
    
    if(!nombre || !cedula) {
        alert("Por favor ingresa nombre y cedula");
        return false;
    }
    
    if(carrito.length === 0) {
        alert("El carrito esta vacio");
        return false;
    }
    
    const total = actualizarResumenPedido();
    
    const datosCliente = {
        nombre: nombre,
        cedula: cedula,
        email: email,
        telefono: telefono,
        direccion: direccion,
        notas: notas
    };
    
    const numeroWhatsApp = "584141234567";
    
    const mensaje = generarMensajeWhatsApp(datosCliente, carrito, total);
    const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensaje}`;
    
    window.open(urlWhatsApp, '_blank');
    
    const fecha = new Date().toLocaleString();
    const facturaData = {
        ...datosCliente,
        carrito: carrito,
        total: total,
        fecha: fecha,
    };
    
    const historial = JSON.parse(localStorage.getItem("supli_motors_historial")) || [];
    historial.push(facturaData);
    localStorage.setItem("supli_motors_historial", JSON.stringify(historial));
    
    carrito = [];
    guardarCarrito();
    actualizarCarrito();
    
    document.getElementById("modal-compra").style.display = "none";
    
    document.getElementById("nombre-cliente").value = '';
    document.getElementById("cedula-cliente").value = '';
    document.getElementById("email-cliente").value = '';
    document.getElementById("telefono-cliente").value = '';
    document.getElementById("direccion-cliente").value = '';
    document.getElementById("notas-cliente").value = '';
    
    alert("Pedido enviado! Seras redirigido a WhatsApp para confirmar.");
    
    return true;
}

// ============================================
// ACTIVAR UNA PESTANA DEL PANEL DE ADMINISTRACION
// Se usa tanto al hacer clic en una pestana como desde el boton
// "Importar desde Excel" de la pestana de inventario.
// ============================================
export function activarPestanaAdmin(tabId) {
    document.querySelectorAll('.admin-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const panel = document.getElementById(`tab-${tabId}`);
    if (!panel) return;
    panel.classList.add('active');

    // Cargar datos al abrir la pestana
    if (tabId === 'mensajes') {
        cargarMensajes();
    }
    if (tabId === 'usuarios') {
        cargarUsuarios();
    }
}

export function inicializarAdmin() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            activarPestanaAdmin(tab.dataset.tab);
        });
    });
    
    const btnAdmin = document.getElementById("btn-modo-admin");
    const panelAdmin = document.getElementById("panel-admin");
    if (btnAdmin && panelAdmin) {
        btnAdmin.onclick = function() {
            const isVisible = panelAdmin.style.display === "block";
            panelAdmin.style.display = isVisible ? "none" : "block";
            this.innerHTML = isVisible ? "Modo Admin" : "Salir Admin";
            if (!isVisible) {
                actualizarEstadisticasInventario();
                renderizarListaCategoriasAdmin();
                renderizarListaMarcasAdmin();
                actualizarSelectCategorias();
                actualizarSelectMarcas();
                cargarMensajes();
            }
            renderizarProductos();
        };
    }
    
    const btnAgregar = document.getElementById("btn-agregar-producto");
if (btnAgregar) {
    btnAgregar.onclick = async function() {
        const nombre = document.getElementById("nuevo-nombre").value.trim();
        const precio = parseFloat(document.getElementById("nuevo-precio").value);
        const codigo = document.getElementById("nuevo-codigo").value.trim();
        const categoria_id = document.getElementById("nueva-categoria").value;
        const marca_id = document.getElementById("nueva-marca").value;
        const stock = parseInt(document.getElementById("nuevo-stock").value) || 1;
        const descripcion = document.getElementById("nueva-descripcion").value.trim();
        const file = document.getElementById("nueva-imagen").files[0];
        
        // Validaciones
        if (!nombre || !codigo || isNaN(precio) || !categoria_id) {
            alert("Por favor completa: nombre, precio, código y categoría");
            return;
        }
        
        // Deshabilitar botón mientras se procesa
        btnAgregar.disabled = true;
        btnAgregar.textContent = "Guardando...";
        
        try {
            // Llamar al ProductService
            const resultado = await ProductService.crear({
                codigo: codigo,
                nombre: nombre,
                precio: precio,
                categoria_id: categoria_id,
                marca_id: marca_id || null,
                stock: stock,
                descripcion: descripcion
            }, file);
            
            if (!resultado.ok) {
                alert("Error al crear producto: " + resultado.error);
                return;
            }
            
            alert("Producto agregado correctamente");
            
            // Limpiar formulario
            limpiarFormularioAdmin();
            
            // Recargar productos desde Supabase
            await cargarProductosDesdeSupabase();
            
            // Re-renderizar
            renderizarProductosConPaginacion();
            actualizarEstadisticasInventario();
            
        } catch (err) {
            console.error("Error inesperado:", err);
            alert("Error inesperado al crear producto");
        } finally {
            btnAgregar.disabled = false;
            btnAgregar.textContent = "Agregar al Catálogo";
        }
    };
}
    
    const btnAgregarCategoria = document.getElementById("btn-agregar-categoria");
if (btnAgregarCategoria) {
    btnAgregarCategoria.onclick = async () => {
        const nombre = document.getElementById("nueva-categoria-nombre").value.trim();
        
        if (!nombre) {
            alert("Ingresa el nombre de la categoría");
            return;
        }
        
        // Guardar en Supabase
        const resultado = await CategoryService.crear(nombre, "");
        
        if (!resultado.ok) {
            alert("Error al crear categoría: " + resultado.error);
            return;
        }
        
        if (resultado.yaExistia) {
            alert("Esa categoría ya existe y está activa");
        } else if (resultado.reactivada) {
            alert("Categoría reactivada correctamente");
        } else {
            alert("Categoría agregada correctamente");
        }
        
        document.getElementById("nueva-categoria-nombre").value = '';
        
        // Actualizar TODO (lista + selects + catálogo público)
        renderizarListaCategoriasAdmin();
        renderizarCategorias();
        actualizarSelectCategorias();
        llenarSelectCategoriaImportar();
    };
}

        // Event listener para agregar marca
    const btnAgregarMarca = document.getElementById("btn-agregar-marca");
    if (btnAgregarMarca) {
        btnAgregarMarca.onclick = agregarMarca;
    }
}

export function limpiarFormularioAdmin() {
    document.getElementById("nuevo-nombre").value = '';
    document.getElementById("nuevo-precio").value = '';
    document.getElementById("nuevo-codigo").value = '';
    document.getElementById("nueva-categoria").value = '';
    document.getElementById("nueva-marca").value = '';
    document.getElementById("nuevo-stock").value = '10';
    document.getElementById("nueva-descripcion").value = '';
    document.getElementById("nueva-imagen").value = '';
}

export function exportarInventarioExcel() {
    if (productos.length === 0) {
        alert("No hay productos para exportar");
        return;
    }

    const datosExcel = productos.map(p => ({
        'Codigo': p.codigo || '',
        'Nombre': p.nombre || '',
        'Precio': p.precio || 0,
        'Categoria': p.categoria || '',
        'Marca': p.marca || '',
        'Stock': p.stock || 0,
        'Descripcion': p.descripcion || '',
        'ID': p.id || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datosExcel);

    const colWidths = [
        { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 20 },
        { wch: 15 }, { wch: 10 }, { wch: 40 }, { wch: 20 }
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

    const nombreArchivo = `inventario_supli_motors_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
    
    alert("Inventario exportado correctamente a Excel");
}

export function inicializarExcel() {
    const btnExportar = document.getElementById('btn-exportar-excel');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarInventarioExcel);
    }

    // El boton "Importar desde Excel" lleva a la pestana del importador real,
    // que escribe en Supabase. Antes abria un importador heredado que solo
    // tocaba el localStorage del navegador y se perdia al recargar.
    const btnImportar = document.getElementById('btn-importar-excel');
    if (btnImportar) {
        btnImportar.addEventListener('click', () => activarPestanaAdmin('importar'));
    }
}

// ============================================
// SISTEMA DE LOGIN CON SUPABASE
// ============================================
export let perfilActual = null; // Guardamos el perfil del usuario logueado

export async function verificarSesion() {
    try {
        const sesion = await AuthService.getSesion();
        
        if (sesion) {
            perfilActual = await AuthService.getPerfil();
            
            if (perfilActual && perfilActual.activo) {
                // Usuario logueado
                document.getElementById('modal-login').style.display = 'none';
                document.getElementById('btn-logout').style.display = 'block';
                document.getElementById('btn-login').style.display = 'none';
                
                aplicarPermisosPorRol(perfilActual);
                
                // Desbloquear scroll del body
                document.body.style.overflow = '';
                
                console.log("✅ Sesión restaurada:", perfilActual.nombre, "-", perfilActual.rol);
                return true;
            } else {
                await AuthService.logout();
            }
        }
        
        // No hay sesión → bloquear acceso
        document.getElementById('modal-login').style.display = 'block';
        document.getElementById('btn-logout').style.display = 'none';
        document.getElementById('btn-login').style.display = 'block';
        
        // Bloquear scroll del body
        document.body.style.overflow = 'hidden';
        const overlayCarga = document.getElementById('overlay-cargando');
        if (overlayCarga) {
            overlayCarga.style.display = 'none';
            overlayCarga.remove();
        }
        return false;

    } catch (err) {
        console.error("Error al verificar sesión:", err);
        document.getElementById('modal-login').style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // ✅ Ocultar overlay de carga
        const overlayCarga = document.getElementById('overlay-cargando');
        if (overlayCarga) {
            overlayCarga.style.display = 'none';
            overlayCarga.remove();
        }
        
        return false;
    }
}

export async function iniciarSesion() {
    const input = document.getElementById('login-usuario');
    const passwordInput = document.getElementById('login-password');
    const errorDiv = document.getElementById('login-error');
    const btnLogin = document.getElementById('btn-login');
    
    const usuarioOEmail = input.value.trim();
    const password = passwordInput.value;
    
    // Validaciones básicas
    if (!usuarioOEmail || !password) {
        errorDiv.textContent = 'Ingresa usuario/email y contraseña';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Deshabilitar botón mientras se procesa
    btnLogin.disabled = true;
    btnLogin.textContent = 'Ingresando...';
    errorDiv.style.display = 'none';
    
    try {
        // Llamar al AuthService
        const resultado = await AuthService.login(usuarioOEmail, password);
        
        if (!resultado.ok) {
            errorDiv.textContent = resultado.error || 'Error al iniciar sesión';
            errorDiv.style.display = 'block';
            btnLogin.disabled = false;
            btnLogin.textContent = 'Ingresar';
            return;
        }
        
        // Login exitoso
        perfilActual = resultado.perfil;

        // Desbloquear el scroll y ocultar el modal de login
        document.body.style.overflow = '';
        document.getElementById('modal-login').style.display = 'none';
        document.getElementById('btn-logout').style.display = 'block';
        document.getElementById('btn-login').style.display = 'none';

        // Limpiar campos
        input.value = '';
        passwordInput.value = '';

        // Aplicar permisos del rol y repintar las tarjetas para que un
        // administrador vea de inmediato sus acciones
        aplicarPermisosPorRol(perfilActual);
        renderizarProductosConPaginacion();

        // Redirigir según rol
        redirigirPorRol(perfilActual);
        
    } catch (err) {
        console.error("Error inesperado:", err);
        errorDiv.textContent = 'Error inesperado. Intenta de nuevo.';
        errorDiv.style.display = 'block';
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Ingresar';
    }
}

export async function cerrarSesion() {
    if (!confirm('¿Cerrar sesión?')) return;

    // ✅ 1. Mostrar overlay bonito
    const overlay = document.getElementById('overlay-cerrando-sesion');
    if (overlay) overlay.classList.add('activo');

    // ✅ 2. Esperar un momento para que se vea la animación
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 3. Cerrar sesión en Supabase
    await AuthService.logout();

    // 4. Limpiar el carrito
    carrito = [];
    localStorage.removeItem('supli_motors_carrito');

    // 5. Recargar la página
    // (El overlay sigue visible durante la recarga)
    window.location.reload();
}

// ============================================
// APLICAR PERMISOS SEGÚN ROL
// ============================================
export function aplicarPermisosPorRol(perfil) {
    const btnModoAdmin = document.getElementById('btn-modo-admin');
    const btnLogoutHeader = document.getElementById('btn-logout-header');
    const dropdownLogin = document.getElementById('dropdown-login');
    const dropdownMyAccount = document.getElementById('dropdown-my-account');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserRole = document.getElementById('dropdown-user-role');

    // Nombre y rol en el dropdown
    if (dropdownUserName) {
        dropdownUserName.textContent = perfil ? perfil.nombre : 'Invitado';
    }
    if (dropdownUserRole) {
        if (perfil) {
            const rolTexto = perfil.rol === 'superusuario' ? 'Superusuario'
                          : perfil.rol === 'admin' ? 'Administrador'
                          : 'Cliente';
            dropdownUserRole.textContent = rolTexto;
        } else {
            dropdownUserRole.textContent = '';
        }
    }

    // Ocultar login, mostrar opciones de cuenta
    if (dropdownLogin) dropdownLogin.style.display = 'none';
    if (dropdownMyAccount) dropdownMyAccount.style.display = 'flex';
    if (btnLogoutHeader) btnLogoutHeader.style.display = 'flex';

    // Admin o superusuario: mostrar boton "Panel de administracion"
    if (btnModoAdmin) {
        if (perfil.rol === 'admin' || perfil.rol === 'superusuario') {
            btnModoAdmin.style.display = 'flex';
        } else {
            btnModoAdmin.style.display = 'none';
            const panelAdmin = document.getElementById('panel-admin');
            if (panelAdmin) panelAdmin.style.display = 'none';
        }
    }
}

// ============================================
// REDIRIGIR SEGÚN ROL
// Los administradores se quedan en el panel (index.html) y el resto de
// usuarios va a la portada. Antes esta funcion estaba vacia y el login
// redirigia a todo el mundo a inicio.html por un return anticipado.
// ============================================
export function redirigirPorRol(perfil) {
    if (!perfil) return;

    const esAdmin = perfil.rol === 'admin' || perfil.rol === 'superusuario';
    if (esAdmin) return; // ya esta en index.html: no hace falta recargar

    window.location.href = 'inicio.html';
}

// Variables de estado
export let temaActual = localStorage.getItem('supli_motors_tema') || 'claro';

export let vistaActual = localStorage.getItem('supli_motors_vista') || 'grilla';

export let paginaActual = 1;

export const productosPorPagina = 24;

export let productosFiltradosCache = [];

// ============================================
// 1. MODO OSCURO/CLARO
// ============================================
export function toggleTema() {
    const body = document.body;
    const icono = document.getElementById('icono-tema');
    
    if (temaActual === 'claro') {
        body.classList.add('modo-oscuro');
        temaActual = 'oscuro';
        icono.textContent = '☀️';
        document.getElementById('btn-toggle-tema').classList.add('activo');
    } else {
        body.classList.remove('modo-oscuro');
        temaActual = 'claro';
        icono.textContent = '🌙';
        document.getElementById('btn-toggle-tema').classList.remove('activo');
    }
    
    localStorage.setItem('supli_motors_tema', temaActual);
}

export function aplicarTemaGuardado() {
    const body = document.body;
    const icono = document.getElementById('icono-tema');
    
    if (temaActual === 'oscuro') {
        body.classList.add('modo-oscuro');
        icono.textContent = '☀️';
        document.getElementById('btn-toggle-tema').classList.add('activo');
    } else {
        body.classList.remove('modo-oscuro');
        icono.textContent = '🌙';
        document.getElementById('btn-toggle-tema').classList.remove('activo');
    }
}

// ============================================
// 2. VISTA LISTA/GRILLA
// ============================================
export function toggleVista() {
    const grid = document.getElementById('contenedor-productos');
    const icono = document.getElementById('icono-vista');
    
    if (vistaActual === 'grilla') {
        grid.classList.add('vista-lista');
        vistaActual = 'lista';
        icono.textContent = '⊞';
        document.getElementById('btn-toggle-vista').classList.add('activo');
    } else {
        grid.classList.remove('vista-lista');
        vistaActual = 'grilla';
        icono.textContent = '⊞';
        document.getElementById('btn-toggle-vista').classList.remove('activo');
    }
    
    localStorage.setItem('supli_motors_vista', vistaActual);
}

export function aplicarVistaGuardada() {
    const grid = document.getElementById('contenedor-productos');
    const icono = document.getElementById('icono-vista');
    
    if (vistaActual === 'lista') {
        grid.classList.add('vista-lista');
        icono.textContent = '⊞';
        document.getElementById('btn-toggle-vista').classList.add('activo');
    } else {
        grid.classList.remove('vista-lista');
        icono.textContent = '⊞';
        document.getElementById('btn-toggle-vista').classList.remove('activo');
    }
}

// ============================================
// 3. PAGINACION
// ============================================
export function renderizarPaginacion(totalProductos) {
    const container = document.getElementById('paginacion-container');
    if (!container) return;
    
    const totalPaginas = Math.ceil(totalProductos / productosPorPagina);
    
    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Boton Anterior
    html += `<button class="btn-paginacion" data-pagina="${paginaActual - 1}" ${paginaActual <= 1 ? 'disabled' : ''}>‹</button>`;
    
    // Numeros de pagina
    for (let i = 1; i <= totalPaginas; i++) {
        if (i === paginaActual) {
            html += `<button class="btn-paginacion active" data-pagina="${i}">${i}</button>`;
        } else if (i === 1 || i === totalPaginas || Math.abs(i - paginaActual) <= 2) {
            html += `<button class="btn-paginacion" data-pagina="${i}">${i}</button>`;
        } else if (i === 2 && paginaActual > 4) {
            html += `<span class="paginacion-puntos">...</span>`;
        } else if (i === totalPaginas - 1 && paginaActual < totalPaginas - 3) {
            html += `<span class="paginacion-puntos">...</span>`;
        }
    }
    
    // Boton Siguiente
    html += `<button class="btn-paginacion" data-pagina="${paginaActual + 1}" ${paginaActual >= totalPaginas ? 'disabled' : ''}>›</button>`;
    
    // Informacion
    const inicio = (paginaActual - 1) * productosPorPagina + 1;
    const fin = Math.min(paginaActual * productosPorPagina, totalProductos);
    html += `<span class="paginacion-info">${inicio} - ${fin} de ${totalProductos}</span>`;
    
    container.innerHTML = html;
    
    // Event listeners
    container.querySelectorAll('.btn-paginacion:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            const pagina = parseInt(btn.dataset.pagina);
            if (!isNaN(pagina) && pagina > 0) {
                paginaActual = pagina;
                renderizarProductosConPaginacion();
            }
        });
    });
}

export function renderizarProductosConPaginacion() {
    const productosFiltrados = filtrarProductos();
    productosFiltradosCache = productosFiltrados;

    actualizarContadorResultados(productosFiltrados.length);

    const inicio = (paginaActual - 1) * productosPorPagina;
    const fin = inicio + productosPorPagina;
    const productosPagina = productosFiltrados.slice(inicio, fin);
    
    renderizarProductosPagina(productosPagina);
    renderizarPaginacion(productosFiltrados.length);
    actualizarBreadcrumbs();
}

// ============================================
// TARJETAS DE PRODUCTO
// Se construyen con DOM y textContent, nunca con innerHTML interpolado:
// los datos vienen de Excel/Supabase y no se confian.
// ============================================
export function renderizarProductosPagina(productosPagina) {
    const contenedor = document.getElementById("contenedor-productos");
    if (!contenedor) return;

    const esAdmin =
        perfilActual && (perfilActual.rol === "admin" || perfilActual.rol === "superusuario");
    const esSuper = perfilActual && perfilActual.rol === "superusuario";

    contenedor.innerHTML = "";

    if (productosPagina.length === 0) {
        contenedor.innerHTML = `
            <div class="no-resultados">
                <p>No se encontraron productos</p>
                <small>Intenta con otros terminos de busqueda o categorias</small>
            </div>
        `;
        return;
    }

    productosPagina.forEach((p) => {
        contenedor.appendChild(crearTarjetaProducto(p, esAdmin, esSuper));
    });

    setTimeout(agregarAnimacionesTarjetas, 50);
}

export function crearTarjetaProducto(p, esAdmin, esSuper) {
    const div = document.createElement("div");
    div.className = "tarjeta-producto";
    div.onclick = () => abrirDetalle(p);

    const imagen = document.createElement("img");
    imagen.className = "img-previa";
    imagen.alt = p.nombre || "Producto";
    imagen.src = p.imagen || getImagenMarca(p.marca) || PLACEHOLDER_IMG;
    // Si la imagen guardada ya no existe, mostramos el placeholder en vez de un icono roto
    imagen.onerror = () => {
        imagen.onerror = null;
        imagen.src = PLACEHOLDER_IMG;
    };
    div.appendChild(imagen);

    const info = document.createElement("div");
    info.className = "info-tarjeta";

    const badge = document.createElement("div");
    badge.className = "categoria-badge";
    badge.textContent = `${p.categoria_icono || ""} ${p.categoria_nombre || "Sin categoría"}`.trim();
    info.appendChild(badge);

    const codigo = document.createElement("small");
    codigo.className = "codigo-producto";
    codigo.textContent = p.codigo || "";
    info.appendChild(codigo);

    const titulo = document.createElement("h3");
    titulo.textContent = p.nombre || "";
    info.appendChild(titulo);

    if (p.marca) {
        const marca = document.createElement("small");
        marca.className = "marca-producto";
        marca.textContent = `Marca: ${p.marca}`;
        info.appendChild(marca);
    }

    const precio = document.createElement("p");
    precio.className = "precio-producto";
    const precioValor = document.createElement("strong");
    precioValor.textContent = `$${Number(p.precio || 0).toFixed(2)}`;
    precio.appendChild(precioValor);
    info.appendChild(precio);

    if (esAdmin && p.stock !== undefined) {
        const stock = document.createElement("small");
        stock.className = "stock-info";
        stock.textContent = `Stock: ${p.stock}`;
        info.appendChild(stock);
    }

    if (esAdmin) {
        info.appendChild(crearAccionesAdminProducto(p, esSuper));
    }

    div.appendChild(info);
    return div;
}

export function crearAccionesAdminProducto(p, esSuper) {
    const contenedor = document.createElement("div");
    contenedor.className = `acciones-admin-tarjeta${esSuper ? "" : " solo-privatizar"}`;
    contenedor.onclick = (evento) => evento.stopPropagation();

    const privatizar = document.createElement("button");
    privatizar.className = "btn-accion-admin btn-privatizar";
    privatizar.textContent = "Privatizar";
    privatizar.onclick = (evento) => {
        evento.stopPropagation();
        privatizarProducto(p.id);
    };
    contenedor.appendChild(privatizar);

    if (esSuper) {
        const eliminar = document.createElement("button");
        eliminar.className = "btn-accion-admin btn-eliminar-admin";
        eliminar.textContent = "Eliminar";
        eliminar.onclick = (evento) => {
            evento.stopPropagation();
            eliminarProducto(p.id);
        };
        contenedor.appendChild(eliminar);
    }

    return contenedor;
}

// ============================================
// 4. BREADCRUMBS (MIGAS DE PAN)
// ============================================
export function actualizarBreadcrumbs() {
    const breadcrumbs = document.getElementById('breadcrumbs');
    if (!breadcrumbs) return;
    
    let html = `<span class="breadcrumb-item active">Inicio</span>`;
    
    // Categoria seleccionada
    if (categoriaActiva !== 'todos') {
        const categoriaInfo = categorias.find(c => c.id === categoriaActiva);
        if (categoriaInfo) {
            html += `<span class="breadcrumb-item">${categoriaInfo.icono} ${categoriaInfo.nombre}</span>`;
        }
    }
    
    // Busqueda
    if (textoBusqueda) {
        html += `<span class="breadcrumb-item">Busqueda: "${textoBusqueda}"</span>`;
    }
    
    // Resultados
    const total = productosFiltradosCache.length || 0;
    html += `<span class="breadcrumb-item active">${total} productos</span>`;
    
    breadcrumbs.innerHTML = html;
}

// ============================================
// 5. ANIMACIONES AVANZADAS
// ============================================
export function agregarAnimacionesTarjetas() {
    const tarjetas = document.querySelectorAll('.tarjeta-producto');
    tarjetas.forEach((tarjeta, index) => {
        // ✅ Animación escalonada: cada tarjeta 40ms después de la anterior
        const delay = index * 0.04;
        tarjeta.style.animationDelay = `${delay}s`;
        tarjeta.style.animation = `tarjetaEntrada 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s backwards`;
        tarjeta.style.willChange = 'transform, opacity';
    });
    
    // ✅ Limpiar will-change después de la animación (para performance)
    setTimeout(() => {
        tarjetas.forEach(t => t.style.willChange = 'auto');
    }, 1500);
}

// ============================================
// 6. INICIALIZAR MEJORAS
// ============================================
export function inicializarMejoras() {
    // Tema
    aplicarTemaGuardado();
    document.getElementById('btn-toggle-tema').addEventListener('click', toggleTema);
    
    // Vista
    aplicarVistaGuardada();
    document.getElementById('btn-toggle-vista').addEventListener('click', toggleVista);
    
    // Paginacion - agregar container
    const mainContent = document.querySelector('.main-content');
    const paginacionDiv = document.createElement('div');
    paginacionDiv.id = 'paginacion-container';
    paginacionDiv.className = 'paginacion';
    mainContent.appendChild(paginacionDiv);
    
    // Breadcrumbs - ya estan en el HTML
}

// ============================================
// CARGAR PRODUCTOS DESDE SUPABASE
// ============================================
export async function cargarProductosDesdeSupabase() {
    try {
        //  Mostrar progreso: 10%
        actualizarProgresoCarga(10);

        const resultado = await ProductService.listar(true);

        //  Mostrar progreso: 80%
        actualizarProgresoCarga(80);
        
        if (!resultado.ok) {
            console.error("Error al cargar productos:", resultado.error);
            productos = [];
            return;
        }
        
        productos = resultado.data;
        console.log(`✅ ${productos.length} productos cargados desde Supabase`);

        //  Mostrar progreso: 100%
        actualizarProgresoCarga(100);
        
    } catch (err) {
        console.error("Error inesperado al cargar productos:", err);
        productos = [];
    }
}

// Helper: actualizar barra de progreso
export function actualizarProgresoCarga(porcentaje) {
    const barra = document.getElementById('overlay-progreso');
    const texto = document.getElementById('overlay-porcentaje');
    if (barra) barra.style.width = porcentaje + '%';
    if (texto) texto.textContent = porcentaje + '%';
}

export function ocultarOverlayCarga() {
    const overlay = document.getElementById('overlay-cargando');
    if (!overlay) return;
    
    // 1. Desvanecer el overlay (agrega clase)
    overlay.classList.add('oculto');
    
    // 2. Reactivar scroll
    document.body.style.overflow = '';
    
    // 3. Animar las tarjetas después de que empiece la transición
    setTimeout(() => {
        agregarAnimacionesTarjetas();
    }, 300);
    
    // 4. Remover el overlay después de la transición COMPLETA (1.5s)
    setTimeout(() => {
        if (overlay.parentElement) overlay.remove();
    }, 1500);
}

// ============================================
// CARGAR CATEGORÍAS DESDE SUPABASE
// ============================================
export async function cargarCategoriasDesdeSupabase() {
    try {
        const resultado = await CategoryService.listar();
        
        if (!resultado.ok) {
            console.error("Error al cargar categorías:", resultado.error);
            return;
        }
        
        console.log(`✅ ${resultado.data.length} categorías cargadas desde Supabase`);
        
    } catch (err) {
        console.error("Error inesperado al cargar categorías:", err);
    }
}

// ============================================
// CARGAR MARCAS DESDE SUPABASE
// ============================================
export async function cargarMarcasDesdeSupabase() {
    try {
        const resultado = await BrandService.listar();
        
        if (!resultado.ok) {
            console.error("Error al cargar marcas:", resultado.error);
            return;
        }
        
        console.log(`✅ ${resultado.data.length} marcas cargadas desde Supabase`);
        
    } catch (err) {
        console.error("Error inesperado al cargar marcas:", err);
    }
}

// ============================================
// LEER PARAMETRO ?categoria=ID DE LA URL
// ============================================
export function leerCategoriaDeURL() {
    const params = new URLSearchParams(window.location.search);
    const categoriaId = params.get('categoria');
    
    if (categoriaId) {
        categoriaActiva = categoriaId;
        console.log('Filtrando por categoria:', categoriaId);
    }
}

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
    renderizarClientes();
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
        textoBusqueda = e.target.value;
        paginaActual = 1;
        renderizarProductosConPaginacion();
    });
}

// mismo tratamiento para el panel de búsqueda expandible
const searchPanelInput = document.getElementById('search-panel-input');
if (searchPanelInput) {
    searchPanelInput.addEventListener('input', function(e) {
        textoBusqueda = e.target.value;
        paginaActual = 1;
        renderizarProductosConPaginacion();
    });
}

    // ✅ CATEGORIAS CON PAGINACION
    document.querySelectorAll('.categoria-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            categoriaActiva = this.dataset.categoria;
            paginaActual = 1;
            renderizarProductosConPaginacion();
        });
    });

    // 3. EVENTOS DEL DETALLE DE PRODUCTO
    const btnMas = document.getElementById("btn-mas");
    const btnMenos = document.getElementById("btn-menos");
    const inputCantidad = document.getElementById("input-cantidad");
    
    if (btnMas) {
        btnMas.onclick = () => {
        cantidadSeleccionada++;
        if (inputCantidad) inputCantidad.value = cantidadSeleccionada;
    };
    }
    
    if (btnMenos) {
        btnMenos.onclick = () => {
            if(cantidadSeleccionada > 1) {
                cantidadSeleccionada--;
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
                carrito = [];
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


    // 11. EVENTOS DE CLIENTES
    document.getElementById('btn-nuevo-cliente').addEventListener('click', () => abrirModalCliente());
    document.getElementById('btn-guardar-cliente').addEventListener('click', guardarCliente);
    document.getElementById('cerrar-modal-cliente').addEventListener('click', () => {
        document.getElementById('modal-cliente').style.display = 'none';
    });
    document.getElementById('btn-buscar-cliente').addEventListener('click', () => {
        const filtro = document.getElementById('buscador-cliente').value;
        renderizarClientes(filtro);
    });
    document.getElementById('buscador-cliente').addEventListener('input', (e) => {
        renderizarClientes(e.target.value);
    });

    // 12. EVENTOS DE REPORTES
    document.getElementById('btn-actualizar-reporte').addEventListener('click', actualizarReportes);
    
    // 13. CERRAR MODALES AL HACER CLICK FUERA
window.onclick = (event) => {
    const modalDetalle = document.getElementById("modal-detalle");
    const modalCompra = document.getElementById("modal-compra");
    const modalCliente = document.getElementById("modal-cliente");
    const modalLogin = document.getElementById("modal-login");
    
    if (event.target === modalDetalle) modalDetalle.style.display = "none";
    if (event.target === modalCompra) modalCompra.style.display = "none";
    if (event.target === modalCliente) modalCliente.style.display = "none";
    
    // Bloquear cierre del modal de login si no hay sesión
    if (event.target === modalLogin && perfilActual) {
        modalLogin.style.display = "none";
    }
};
}

// ============================================
// USER DROPDOWN (NUEVO)
// ============================================
export function inicializarUserDropdown() {
    const btnUserMenu = document.getElementById('btn-user-menu');
    const userMenuContainer = btnUserMenu ? btnUserMenu.closest('.user-menu-container') : null;
    const dropdownLogin = document.getElementById('dropdown-login');
    const btnNavSearch = document.getElementById('btn-nav-search');

    // Toggle del dropdown
    if (btnUserMenu && userMenuContainer) {
        btnUserMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuContainer.classList.toggle('open');
        });
    }

    // Cerrar al hacer click fuera
    document.addEventListener('click', (e) => {
        if (userMenuContainer && !userMenuContainer.contains(e.target)) {
            userMenuContainer.classList.remove('open');
        }
    });

    // Boton "Iniciar sesion" -> abrir modal de login
    if (dropdownLogin) {
        dropdownLogin.addEventListener('click', () => {
            const modalLogin = document.getElementById('modal-login');
            if (modalLogin) modalLogin.style.display = 'block';
            if (userMenuContainer) userMenuContainer.classList.remove('open');
        });
    }

    // Boton buscar del navbar -> scroll al buscador
    if (btnNavSearch) {
        btnNavSearch.addEventListener('click', () => {
            const buscadorInput = document.getElementById('buscador-input');
            if (buscadorInput) {
                buscadorInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => buscadorInput.focus(), 400);
            }
        });
    }
}

// ============================================
// SEARCH PANEL (BARRA DE BUSQUEDA EXPANDIBLE)
// ============================================
export function inicializarSearchPanel() {
    const searchPanel = document.getElementById('search-panel');
    const searchPanelInput = document.getElementById('search-panel-input');
    const searchPanelClose = document.getElementById('search-panel-close');
    const btnNavSearch = document.getElementById('btn-nav-search');
    const buscadorInput = document.getElementById('buscador-input');

    if (!searchPanel || !searchPanelInput) {
        console.warn('Search panel no encontrado');
        return;
    }

    // Abrir panel al click en la lupa del navbar
    if (btnNavSearch) {
        btnNavSearch.addEventListener('click', (e) => {
            e.preventDefault();
            searchPanel.classList.add('open');
            setTimeout(() => searchPanelInput.focus(), 300);
        });
    }

    // Cerrar panel con el boton X
    if (searchPanelClose) {
        searchPanelClose.addEventListener('click', () => {
            searchPanel.classList.remove('open');
        });
    }

    // Cerrar panel con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchPanel.classList.contains('open')) {
            searchPanel.classList.remove('open');
        }
    });

    // Busqueda en vivo: al escribir, sincronizar con el buscador original
    searchPanelInput.addEventListener('input', (e) => {
        const valor = e.target.value;

        // Sincronizar con el buscador original
        if (buscadorInput) {
            buscadorInput.value = valor;
        }

        // Actualizar estado
        textoBusqueda = valor;
        paginaActual = 1;
        renderizarProductosConPaginacion();
    });

    // Enter para ejecutar busqueda
    searchPanelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchPanel.classList.remove('open');
            // Scroll a los resultados
            const contenedorProductos = document.getElementById('contenedor-productos');
            if (contenedorProductos) {
                contenedorProductos.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });
}

// Renderizar lista de categorías en el panel admin
export function renderizarListaCategoriasAdmin() {
    const container = document.getElementById('lista-categorias');
    if (!container) return;

    const categoriasSupabase = CategoryService.getCache();
    container.innerHTML = '';

    if (categoriasSupabase.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; font-size:0.875rem;">No hay categorías registradas</p>';
        return;
    }

    categoriasSupabase.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'categoria-item';
        div.innerHTML = `
            ${cat.nombre}
            <button data-id="${cat.id}" class="btn-eliminar-categoria">X</button>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll('.btn-eliminar-categoria').forEach(btn => {
        btn.addEventListener('click', () => {
            eliminarCategoria(btn.dataset.id);
        });
    });
}

// ============================================
// RECUPERAR CONTRASEÑA
// ============================================
export function abrirModalRecuperar() {
    const modal = document.getElementById('modal-recuperar');
    if (!modal) return;
    
    document.getElementById('recuperar-email').value = '';
    document.getElementById('recuperar-error').style.display = 'none';
    document.getElementById('recuperar-exito').style.display = 'none';
    
    modal.style.display = 'block';
}

export function cerrarModalRecuperar() {
    const modal = document.getElementById('modal-recuperar');
    if (modal) modal.style.display = 'none';
}

export async function enviarEmailRecuperacion() {
    const email = document.getElementById('recuperar-email').value.trim();
    const errDiv = document.getElementById('recuperar-error');
    const okDiv = document.getElementById('recuperar-exito');
    const btn = document.getElementById('btn-recuperar');
    
    errDiv.style.display = 'none';
    okDiv.style.display = 'none';
    okDiv.classList.remove('activo');
    
    if (!email || !email.includes('@')) {
        errDiv.textContent = 'Ingresá un email válido';
        errDiv.style.display = 'block';
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    
    try {
        const { error } = await window.sb.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html'
        });
        
        if (error) {
            errDiv.textContent = 'Error: ' + error.message;
            errDiv.style.display = 'block';
            return;
        }
        
        // ✅ Éxito (siempre mostramos éxito, incluso si el email no existe,
        // por seguridad, para no revelar qué emails están registrados)
        okDiv.textContent = 'Si el email está registrado, vas a recibir un link para recuperar tu contraseña. Revisá tu bandeja (y spam).';
        okDiv.classList.add('activo');
        
        // Limpiar input
        document.getElementById('recuperar-email').value = '';
        
    } catch (err) {
        console.error(err);
        errDiv.textContent = 'Error inesperado: ' + err.message;
        errDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar link de recuperación';
    }
}

// Inicializar listeners
export function inicializarRecuperar() {
    const link = document.getElementById('link-olvide-password');
    if (link) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            abrirModalRecuperar();
        });
    }
    
    const btnCerrar = document.getElementById('cerrar-modal-recuperar');
    if (btnCerrar) btnCerrar.addEventListener('click', cerrarModalRecuperar);
    
    const btnCancelar = document.getElementById('btn-cancelar-recuperar');
    if (btnCancelar) btnCancelar.addEventListener('click', cerrarModalRecuperar);
    
    const btnEnviar = document.getElementById('btn-recuperar');
    if (btnEnviar) btnEnviar.addEventListener('click', enviarEmailRecuperacion);
    
    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('modal-recuperar');
            if (modal && modal.style.display === 'block') {
                cerrarModalRecuperar();
            }
        }
    });
    
    // Cerrar al hacer clic fuera
    const modal = document.getElementById('modal-recuperar');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cerrarModalRecuperar();
        });
    }
}// ============================================

// PRIVATIZAR PRODUCTO (ocultar del catálogo público)
// ============================================
export async function privatizarProducto(id) {
    if (!confirm('¿Ocultar este producto del catálogo público?\n\nLos clientes no lo verán. Podés volver a mostrarlo desde el panel admin.')) {
        return;
    }

    try {
        // 1. Actualizar en Supabase: activo = false
        const { error } = await window.sb
            .from('productos')
            .update({ activo: false })
            .eq('id', id);

        if (error) {
            alert('Error al privatizar: ' + error.message);
            return;
        }

        // 2. Remover del array local para que desaparezca visualmente
        productos = productos.filter(p => p.id !== id);

        // 3. Re-renderizar
        renderizarProductosConPaginacion();
        actualizarEstadisticasInventario();

        alert('Producto ocultado del catálogo.');

    } catch (err) {
        console.error('Error al privatizar:', err);
        alert('Error inesperado al privatizar');
    }
}

// Puente para los handlers declarados en plantillas HTML (onclick="...")
window.quitarDelCarrito = quitarDelCarrito;
window.eliminarProducto = eliminarProducto;
window.eliminarCategoria = eliminarCategoria;
window.limpiarVenta = limpiarVenta;
