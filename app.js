let productos = JSON.parse(localStorage.getItem("supli_motors_productos")) || [];
let categorias = JSON.parse(localStorage.getItem("supli_motors_categorias")) || [
    { id: "motor", nombre: "Motor", icono: "M" },
    { id: "transmision", nombre: "Transmision", icono: "T" },
    { id: "frenos", nombre: "Frenos", icono: "F" },
    { id: "suspension", nombre: "Suspension", icono: "S" },
    { id: "electrico", nombre: "Electrico", icono: "E" },
    { id: "lubricantes", nombre: "Lubricantes", icono: "L" },
    { id: "refrigeracion", nombre: "Refrigeracion", icono: "R" }
];
let carrito = JSON.parse(localStorage.getItem("supli_motors_carrito")) || [];
let actualProd = null;
let cantidadSeleccionada = 1;

let categoriaActiva = 'todos';
let textoBusqueda = '';
let marcaFiltro = '';
let rangoPrecio = '';
let stockFiltro = '';

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23f1f5f9'/><text x='100' y='100' font-family='Arial, sans-serif' font-size='16' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>Sin Imagen</text></svg>";
// ============================================
// NORMALIZAR TEXTO (quita tildes, minúsculas, trim)
// ============================================
function normalizarTexto(texto) {
    if (!texto) return '';
    return String(texto)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}
// ============================================
// IMÁGENES POR MARCA (hardcodeadas)
// ============================================
const IMAGENES_MARCAS = {
    'fraco': 'img/marcas/fraco.jpg',
    'federal mogul': 'img/marcas/federal-mogul.jpg',
    'melling': 'img/marcas/melling.jpg',
    'original': 'img/marcas/original.png',
    'natsuki': 'img/marcas/natsuki.png',
    'masaki': 'img/marcas/masaki.jpg',
    'grant': 'img/marcas/grant.jpg',
    'cloyes': 'img/marcas/cloyes.jpg',
    'walker': 'img/marcas/walker.jpg',
    'champion': 'img/marcas/champion.jpg',
    'spicer': 'img/marcas/spicer.jpg',
    'moresa': 'img/marcas/moresa.jpg',
    'pc pistons': 'img/marcas/pc-pistons.jpg',
    'top line': 'img/marcas/top-line.jpg',
    'usmn': 'img/marcas/usmn.jpg',
    'asiainc': 'img/marcas/asiainc.jpg',
    'sap': 'img/marcas/sap.png',
    'sm performance': 'img/marcas/sm-performance.jpg',
    'iridium': 'img/marcas/iridium.jpg',
    'exactcar': 'img/marcas/exact.jpg',
    'durabond': 'img/marcas/durabond.png',
    'fraven': 'img/marcas/fraven.jpg',
    'original': 'img/marcas/original.jpg',
    'oring': 'img/marcas/oring.jpg',
    'gomas de válvulas': 'img/marcas/gomas-de-valvulas.jpg',

};

// Helper: devuelve la URL de imagen según la marca
function getImagenMarca(marca) {
    if (!marca) return null;
    const key = String(marca).toLowerCase().trim();
    return IMAGENES_MARCAS[key] || null;
}
const guardarInventario = () => localStorage.setItem("supli_motors_productos", JSON.stringify(productos));
const guardarCategorias = () => localStorage.setItem("supli_motors_categorias", JSON.stringify(categorias));
const guardarCarrito = () => localStorage.setItem("supli_motors_carrito", JSON.stringify(carrito));

function filtrarProductos() {
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

function actualizarContadorResultados(mostrados) {
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

function renderizarProductos() {
    const productosFiltrados = filtrarProductos();
    const contenedor = document.getElementById("contenedor-productos");
    const esAdmin = perfilActual && (perfilActual.rol === 'admin' || perfilActual.rol === 'superusuario');
    const esSuper = perfilActual && perfilActual.rol === 'superusuario';
    
    if (!contenedor) return;
    contenedor.innerHTML = "";
    
    actualizarContadorResultados(productosFiltrados.length);
    
    if (productosFiltrados.length === 0) {
        contenedor.innerHTML = `
            <div class="no-resultados">
                <p>No se encontraron productos</p>
                <small>Intenta con otros terminos de busqueda o categorias</small>
            </div>
        `;
        return;
    }
    
    productosFiltrados.forEach((p, index) => {
        const div = document.createElement("div");
        div.className = "tarjeta-producto";
        div.onclick = () => abrirDetalle(p);
        
        const categoriaNombre = p.categoria_nombre || 'Sin categoría';
        const categoriaIcono = p.categoria_icono || '';
        
        div.innerHTML = `
            <img src="${p.imagen || getImagenMarca(p.marca) || PLACEHOLDER_IMG}" class="img-previa" alt="${p.nombre}">
            <div class="info-tarjeta">
                <div class="categoria-badge">${categoriaIcono} ${categoriaNombre}</div>
                <small class="codigo-producto">${p.codigo}</small>
                <h3>${p.nombre}</h3>
                ${p.marca ? `<small class="marca-producto">Marca: ${p.marca}</small>` : ''}
                <p class="precio-producto"><strong>$${parseFloat(p.precio).toFixed(2)}</strong></p>
                ${esAdmin && p.stock !== undefined ? `<small class="stock-info">Stock: ${p.stock}</small>` : ''}
                ${esAdmin ? `
                <div class="acciones-admin-tarjeta ${!esSuper ? 'solo-privatizar' : ''}" onclick="event.stopPropagation();">
                        <button class="btn-accion-admin btn-privatizar" onclick="event.stopPropagation(); privatizarProducto('${p.id}')">
                            Privatizar
                        </button>
                        ${esSuper ? `
                            <button class="btn-accion-admin btn-eliminar-admin" onclick="event.stopPropagation(); eliminarProducto('${p.id}')">
                                Eliminar
                            </button>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
        contenedor.appendChild(div);
    });
}


function renderizarCategorias() {
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
function renderizarListaMarcasAdmin() {
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
async function agregarMarca() {
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
function actualizarSelectCategorias() {
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
async function eliminarMarca(id) {
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
function actualizarSelectMarcas() {
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

function actualizarEstadisticasInventario() {
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

function actualizarFiltroMarcas() {
    const marcas = [...new Set(productos.map(p => p.marca).filter(m => m))];
    const select = document.getElementById('filtro-marca');
    if (!select) return;
    
    select.innerHTML = '<option value="">Todas las marcas</option>';
    marcas.forEach(marca => {
        select.innerHTML += `<option value="${marca}">${marca}</option>`;
    });
}

function actualizarCarrito() {
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

function quitarDelCarrito(index) {
    carrito.splice(index, 1);
    guardarCarrito();
    actualizarCarrito();
}

async function eliminarProducto(id) {
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

async function eliminarCategoria(id) {
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

function exportarDatos() {
    const datos = {
        productos: productos,
        categorias: categorias,
        fechaExportacion: new Date().toISOString()
    };
    const dataStr = JSON.stringify(datos, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `supli_motors_backup_${new Date().toISOString().slice(0,19)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    alert("Datos exportados correctamente");
}

function abrirDetalle(producto) {
    actualProd = producto;
    cantidadSeleccionada = 1;
    
    const categoriaNombre = producto.categoria_nombre || 'Sin categoría';
    const categoriaIcono = producto.categoria_icono || '';    
    document.getElementById("input-cantidad").value = cantidadSeleccionada;
    document.getElementById("detalle-img").src = 
        producto.imagen || getImagenMarca(producto.marca) || PLACEHOLDER_IMG;    document.getElementById("detalle-nombre").innerText = producto.nombre;
    document.getElementById("detalle-codigo").innerHTML = `Cod: ${producto.codigo}`;
    document.getElementById("detalle-categoria").innerHTML = `${categoriaIcono} ${categoriaNombre}`;
    document.getElementById("detalle-desc").innerText = producto.descripcion || "Sin descripcion disponible";
    document.getElementById("detalle-precio").innerText = parseFloat(producto.precio).toFixed(2);
    
    if (document.getElementById("detalle-marca")) {
        document.getElementById("detalle-marca").innerHTML = producto.marca ? `Marca: ${producto.marca}` : '';
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

function limpiarVenta() {
    carrito = [];
    guardarCarrito();
    location.reload();
}

function inicializarFiltros() {
    const buscador = document.getElementById('buscador-input');
    if (buscador) {
        buscador.addEventListener('input', (e) => {
            textoBusqueda = e.target.value;
            renderizarProductos();
        });
    }
    
    const btnBuscar = document.getElementById('btn-buscar');
    if (btnBuscar) {
        btnBuscar.addEventListener('click', () => {
            textoBusqueda = document.getElementById('buscador-input').value;
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

function generarMensajeWhatsApp(datosCliente, carrito, total) {
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

function actualizarResumenPedido() {
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

function enviarPedidoWhatsApp() {
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

function inicializarAdmin() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            document.querySelectorAll('.admin-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`tab-${tabId}`).classList.add('active');
            
            // Cargar datos al abrir el tab
            if (tabId === 'mensajes') {
                cargarMensajes();
            }
            if (tabId === 'usuarios') {
                cargarUsuarios();
            }
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

    const btnExportar = document.getElementById("btn-exportar-datos");
    if (btnExportar) {
        btnExportar.onclick = exportarDatos;
    }
}

function limpiarFormularioAdmin() {
    document.getElementById("nuevo-nombre").value = '';
    document.getElementById("nuevo-precio").value = '';
    document.getElementById("nuevo-codigo").value = '';
    document.getElementById("nueva-categoria").value = '';
    document.getElementById("nueva-marca").value = '';
    document.getElementById("nuevo-stock").value = '10';
    document.getElementById("nueva-descripcion").value = '';
    document.getElementById("nueva-imagen").value = '';
}

// ============================================
// FUNCIONES DE EXCEL
// ============================================

function exportarInventarioExcel() {
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

function importarInventarioExcel(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const datosImportados = XLSX.utils.sheet_to_json(firstSheet);
            
            if (datosImportados.length === 0) {
                alert("El archivo Excel esta vacio");
                return;
            }

            const columnasRequeridas = ['Codigo', 'Nombre', 'Precio'];
            const columnasArchivo = Object.keys(datosImportados[0]);
            const tieneColumnas = columnasRequeridas.every(col => 
                columnasArchivo.some(c => c.toLowerCase() === col.toLowerCase())
            );

            if (!tieneColumnas) {
                alert("El archivo no tiene las columnas requeridas. Debe tener: Codigo, Nombre, Precio");
                return;
            }

            const opcion = confirm(
                "Se encontraron " + datosImportados.length + " productos.\n" +
                "Presiona OK para REEMPLAZAR todo el inventario.\n" +
                "Presiona Cancelar para AGREGAR a los productos existentes."
            );

            let productosImportados = [];
            let errores = [];
            
            datosImportados.forEach((row, index) => {
                try {
                    const colCodigo = Object.keys(row).find(k => k.toLowerCase() === 'codigo');
                    const colNombre = Object.keys(row).find(k => k.toLowerCase() === 'nombre');
                    const colPrecio = Object.keys(row).find(k => k.toLowerCase() === 'precio');
                    const colCategoria = Object.keys(row).find(k => k.toLowerCase() === 'categoria');
                    const colMarca = Object.keys(row).find(k => k.toLowerCase() === 'marca');
                    const colStock = Object.keys(row).find(k => k.toLowerCase() === 'stock');
                    const colDescripcion = Object.keys(row).find(k => k.toLowerCase() === 'descripcion');

                    const producto = {
                        id: Date.now() + index,
                        codigo: row[colCodigo] ? String(row[colCodigo]).trim() : '',
                        nombre: row[colNombre] ? String(row[colNombre]).trim() : '',
                        precio: parseFloat(row[colPrecio]) || 0,
                        categoria: row[colCategoria] ? String(row[colCategoria]).trim() : '',
                        marca: row[colMarca] ? String(row[colMarca]).trim() : '',
                        stock: parseInt(row[colStock]) || 0,
                        descripcion: row[colDescripcion] ? String(row[colDescripcion]).trim() : '',
                        imagen: null
                    };

                    if (producto.nombre && producto.codigo && producto.precio > 0) {
                        productosImportados.push(producto);
                    } else {
                        errores.push(`Fila ${index + 1}: Datos incompletos`);
                    }
                } catch (error) {
                    errores.push(`Fila ${index + 1}: ${error.message}`);
                }
            });

            if (productosImportados.length === 0) {
                alert("No se pudo importar ningun producto. Verifica los datos.\n\n" + errores.join('\n'));
                return;
            }

            if (opcion) {
                productos = productosImportados;
                guardarInventario();
                guardarCategorias();
                alert(`Importacion completada! Se reemplazaron ${productosImportados.length} productos.`);
            } else {
                productos = [...productos, ...productosImportados];
                guardarInventario();
                guardarCategorias();
                alert(`Importacion completada! Se agregaron ${productosImportados.length} productos. Total: ${productos.length} productos.`);
            }

            if (errores.length > 0) {
                alert("Advertencia: Algunas filas no se importaron:\n\n" + errores.join('\n'));
            }

            actualizarEstadisticasInventario();
            actualizarFiltroMarcas();
            renderizarProductos();
            renderizarCategorias();

        } catch (error) {
            alert("Error al leer el archivo Excel: " + error.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

function inicializarExcel() {
    const btnExportar = document.getElementById('btn-exportar-excel');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarInventarioExcel);
    }

    const btnImportar = document.getElementById('btn-importar-excel');
    const inputImportar = document.getElementById('input-importar-excel');
    
    if (btnImportar && inputImportar) {
        btnImportar.addEventListener('click', () => {
            inputImportar.click();
        });

        inputImportar.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const extensionesValidas = ['xlsx', 'xls'];
                const extension = file.name.split('.').pop().toLowerCase();
                
                if (extensionesValidas.includes(extension)) {
                    importarInventarioExcel(file);
                } else {
                    alert('Por favor selecciona un archivo de Excel (.xlsx o .xls)');
                }
            }
            inputImportar.value = '';
        });
    }
}

// ============================================
// VARIABLES DE CLIENTES Y SISTEMA
// ============================================
let clientes = JSON.parse(localStorage.getItem("supli_motors_clientes")) || [];
let clienteEditando = null;




const guardarClientes = () => localStorage.setItem("supli_motors_clientes", JSON.stringify(clientes));


// ============================================
// SISTEMA DE LOGIN CON SUPABASE
// ============================================
let perfilActual = null; // Guardamos el perfil del usuario logueado

async function verificarSesion() {
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

async function iniciarSesion() {
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
        
        // Mostrar mensaje de bienvenida
        alert(`¡Bienvenido ${perfilActual.nombre}!`);
        window.location.href = 'inicio.html';
        return;
        document.body.style.overflow = '';


        
        // Ocultar modal, mostrar logout
        document.getElementById('modal-login').style.display = 'none';
        document.getElementById('btn-logout').style.display = 'block';
        document.getElementById('btn-login').style.display = 'none';
        
        // Limpiar campos
        input.value = '';
        passwordInput.value = '';
        
        // Aplicar permisos
        aplicarPermisosPorRol(perfilActual);
        
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

async function cerrarSesion() {
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
function aplicarPermisosPorRol(perfil) {
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
// ============================================
function redirigirPorRol(perfil) {

}

// ============================================
// FUNCIONES DE CLIENTES
// ============================================
function renderizarClientes(filtro = '') {
    const tbody = document.getElementById('cuerpo-clientes');
    if (!tbody) return;
    
    let clientesFiltrados = clientes;
    if (filtro) {
        const filtroLower = filtro.toLowerCase();
        clientesFiltrados = clientes.filter(c => 
            c.cedula.includes(filtroLower) ||
            c.nombre.toLowerCase().includes(filtroLower)
        );
    }
    
    tbody.innerHTML = '';
    
    if (clientesFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">No hay clientes registrados</td></tr>`;
        return;
    }
    
    clientesFiltrados.forEach((cliente, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cliente.cedula}</td>
            <td><strong>${cliente.nombre}</strong></td>
            <td>${cliente.telefono || '-'}</td>
            <td>${cliente.compras || 0}</td>
            <td>$${(cliente.totalGastado || 0).toFixed(2)}</td>
            <td>
                <button class="btn-accion-cliente btn-ver-cliente" onclick="verHistorialCliente(${index})">Ver</button>
                <button class="btn-accion-cliente btn-editar-cliente" onclick="editarCliente(${index})">Editar</button>
                <button class="btn-accion-cliente btn-eliminar-admin" onclick="eliminarCliente(${index})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalCliente(cliente = null) {
    const modal = document.getElementById('modal-cliente');
    const titulo = document.getElementById('modal-cliente-titulo');
    const cedula = document.getElementById('cliente-cedula');
    const nombre = document.getElementById('cliente-nombre');
    const telefono = document.getElementById('cliente-telefono');
    const email = document.getElementById('cliente-email');
    const direccion = document.getElementById('cliente-direccion');
    
    if (cliente) {
        titulo.textContent = 'Editar Cliente';
        cedula.value = cliente.cedula;
        cedula.disabled = true;
        nombre.value = cliente.nombre;
        telefono.value = cliente.telefono || '';
        email.value = cliente.email || '';
        direccion.value = cliente.direccion || '';
        clienteEditando = cliente;
    } else {
        titulo.textContent = 'Nuevo Cliente';
        cedula.value = '';
        cedula.disabled = false;
        nombre.value = '';
        telefono.value = '';
        email.value = '';
        direccion.value = '';
        clienteEditando = null;
    }
    // Mostrar campos de cliente por defecto
    const camposCliente = document.getElementById('campos-cliente');
    if (camposCliente) {
        camposCliente.style.display = 'block';
    }
modal.style.display = 'block';
modal.style.opacity = '1';
modal.style.visibility = 'visible';
}

function guardarCliente() {
    const cedula = document.getElementById('cliente-cedula').value.trim();
    const nombre = document.getElementById('cliente-nombre').value.trim();
    const telefono = document.getElementById('cliente-telefono').value.trim();
    const email = document.getElementById('cliente-email').value.trim();
    const direccion = document.getElementById('cliente-direccion').value.trim();
    
    if (!cedula || !nombre) {
        alert('La cedula y el nombre son obligatorios');
        return;
    }
    
    if (!clienteEditando && clientes.some(c => c.cedula === cedula)) {
        alert('Ya existe un cliente con esta cedula');
        return;
    }
    
    if (clienteEditando) {
        const index = clientes.findIndex(c => c.cedula === clienteEditando.cedula);
        if (index !== -1) {
            clientes[index] = {
                ...clientes[index],
                nombre: nombre,
                telefono: telefono,
                email: email,
                direccion: direccion
            };
        }
        alert('Cliente actualizado correctamente');
    } else {
        clientes.push({
            cedula: cedula,
            nombre: nombre,
            telefono: telefono,
            email: email,
            direccion: direccion,
            compras: 0,
            totalGastado: 0,
            fechaRegistro: new Date().toISOString()
        });
        alert('Cliente registrado correctamente');
    }
    
    guardarClientes();
    renderizarClientes();
    document.getElementById('modal-cliente').style.display = 'none';
}

function editarCliente(index) {
    abrirModalCliente(clientes[index]);
}

function eliminarCliente(index) {
    if (confirm(`Eliminar al cliente "${clientes[index].nombre}"?`)) {
        clientes.splice(index, 1);
        guardarClientes();
        renderizarClientes();
        alert('Cliente eliminado');
    }
}

function verHistorialCliente(index) {
    const cliente = clientes[index];
    const historial = JSON.parse(localStorage.getItem("supli_motors_historial")) || [];
    const compras = historial.filter(h => h.cedula === cliente.cedula);
    
    let mensaje = `HISTORIAL DE COMPRAS - ${cliente.nombre}\n`;
    mensaje += `Cedula: ${cliente.cedula}\n`;
    mensaje += `Total compras: ${cliente.compras || 0}\n`;
    mensaje += `Total gastado: $${(cliente.totalGastado || 0).toFixed(2)}\n\n`;
    
    if (compras.length === 0) {
        mensaje += 'No tiene compras registradas';
    } else {
        compras.forEach((compra, i) => {
            mensaje += `--- Compra ${i + 1} ---\n`;
            mensaje += `Fecha: ${compra.fecha || 'N/A'}\n`;
            mensaje += `Total: $${compra.total || 0}\n`;
            mensaje += `Productos: ${compra.carrito ? compra.carrito.length : 0}\n\n`;
        });
    }
    
    alert(mensaje);
}

// ============================================
// FUNCIONES DE REPORTES
// ============================================
function actualizarReportes() {
    const periodo = document.getElementById('reporte-periodo').value;
    const historial = JSON.parse(localStorage.getItem("supli_motors_historial")) || [];
    const hoy = new Date();
    let fechaInicio = new Date(0);
    
    switch(periodo) {
        case 'hoy':
            fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
            break;
        case 'semana':
            fechaInicio = new Date(hoy);
            fechaInicio.setDate(hoy.getDate() - 7);
            break;
        case 'mes':
            fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate());
            break;
        case 'trimestre':
            fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate());
            break;
        case 'anio':
            fechaInicio = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
            break;
        case 'todo':
        default:
            fechaInicio = new Date(0);
            break;
    }
    
    const ventasFiltradas = historial.filter(h => {
        if (!h.fecha) return false;
        const fechaVenta = new Date(h.fecha);
        return fechaVenta >= fechaInicio;
    });
    
    const ventasTotales = ventasFiltradas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    document.getElementById('reporte-ventas-totales').textContent = `$${ventasTotales.toFixed(2)}`;
    
    let productosVendidos = 0;
    ventasFiltradas.forEach(v => {
        if (v.carrito) {
            v.carrito.forEach(item => {
                productosVendidos += parseInt(item.cantidad || 0);
            });
        }
    });
    document.getElementById('reporte-productos-vendidos').textContent = productosVendidos;
    
    const clientesNuevos = clientes.filter(c => {
        if (!c.fechaRegistro) return false;
        return new Date(c.fechaRegistro) >= fechaInicio;
    });
    document.getElementById('reporte-clientes-nuevos').textContent = clientesNuevos.length;
    
    const ventasPorProducto = {};
    ventasFiltradas.forEach(v => {
        if (v.carrito) {
            v.carrito.forEach(item => {
                const key = item.nombre;
                if (!ventasPorProducto[key]) {
                    ventasPorProducto[key] = { cantidad: 0, total: 0 };
                }
                ventasPorProducto[key].cantidad += parseInt(item.cantidad || 0);
                ventasPorProducto[key].total += parseFloat(item.precio || 0) * parseInt(item.cantidad || 0);
            });
        }
    });
    
    let topProducto = '-';
    let maxCantidad = 0;
    for (const [nombre, data] of Object.entries(ventasPorProducto)) {
        if (data.cantidad > maxCantidad) {
            maxCantidad = data.cantidad;
            topProducto = `${nombre} (${data.cantidad})`;
        }
    }
    document.getElementById('reporte-producto-top').textContent = topProducto;
    
    const promedio = ventasFiltradas.length > 0 ? ventasTotales / ventasFiltradas.length : 0;
    document.getElementById('reporte-promedio-venta').textContent = `$${promedio.toFixed(2)}`;
    
    const tasa = clientes.length > 0 ? (ventasFiltradas.length / clientes.length * 100) : 0;
    document.getElementById('reporte-tasa-conversion').textContent = `${tasa.toFixed(1)}%`;
    
    renderizarTopProductos(ventasPorProducto);
}

function renderizarTopProductos(ventasPorProducto) {
    const container = document.getElementById('reporte-top-productos');
    if (!container) return;
    
    const sorted = Object.entries(ventasPorProducto)
        .sort((a, b) => b[1].cantidad - a[1].cantidad)
        .slice(0, 5);
    
    if (sorted.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8;">No hay datos disponibles</p>';
        return;
    }
    
    container.innerHTML = '';
    sorted.forEach(([nombre, data], index) => {
        const div = document.createElement('div');
        div.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
        `;
        div.innerHTML = `
            <div>
                <span style="font-weight:600; color:#0f172a;">${index + 1}. ${nombre}</span>
            </div>
            <div>
                <span style="color:#64748b;">Cantidad: </span>
                <span style="font-weight:600; color:#1a56db;">${data.cantidad}</span>
                <span style="color:#64748b; margin-left:15px;">Total: </span>
                <span style="font-weight:600; color:#1a56db;">$${data.total.toFixed(2)}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

// ============================================
// MEJORAS DE INTERFAZ Y EXPERIENCIA
// ============================================

// Variables de estado
let temaActual = localStorage.getItem('supli_motors_tema') || 'claro';
let vistaActual = localStorage.getItem('supli_motors_vista') || 'grilla';
let paginaActual = 1;
let productosPorPagina = 24;
let productosFiltradosCache = [];
let categoriaSeleccionada = 'todos';
let filtroBusqueda = '';

// ============================================
// 1. MODO OSCURO/CLARO
// ============================================
function toggleTema() {
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

function aplicarTemaGuardado() {
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
function toggleVista() {
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

function aplicarVistaGuardada() {
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
function renderizarPaginacion(totalProductos) {
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

function renderizarProductosConPaginacion() {
    const productosFiltrados = filtrarProductos();
    productosFiltradosCache = productosFiltrados;
    
    const inicio = (paginaActual - 1) * productosPorPagina;
    const fin = inicio + productosPorPagina;
    const productosPagina = productosFiltrados.slice(inicio, fin);
    
    renderizarProductosPagina(productosPagina);
    renderizarPaginacion(productosFiltrados.length);
    actualizarBreadcrumbs();
}

function renderizarProductosPagina(productosPagina) {
    const contenedor = document.getElementById("contenedor-productos");
    const esAdmin = perfilActual && (perfilActual.rol === 'admin' || perfilActual.rol === 'superusuario');  
    const esSuper = perfilActual && perfilActual.rol === 'superusuario';   
    if (!contenedor) return;
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
    
    productosPagina.forEach((p, index) => {
        const div = document.createElement("div");
        div.className = "tarjeta-producto";
        div.onclick = () => abrirDetalle(p);
        
        const categoriaNombre = p.categoria_nombre || 'Sin categoría';
        const categoriaIcono = p.categoria_icono || '';
        
        div.innerHTML = `
                <img src="${p.imagen || getImagenMarca(p.marca) || PLACEHOLDER_IMG}" class="img-previa" alt="${p.nombre}">
            <div class="info-tarjeta">
                <div class="categoria-badge">${categoriaIcono} ${categoriaNombre}</div>
                <small class="codigo-producto">${p.codigo}</small>
                <h3>${p.nombre}</h3>
                ${p.marca ? `<small class="marca-producto">Marca: ${p.marca}</small>` : ''}
                <p class="precio-producto"><strong>$${parseFloat(p.precio).toFixed(2)}</strong></p>
                ${esAdmin && p.stock !== undefined ? `<small class="stock-info">Stock: ${p.stock}</small>` : ''}
${esAdmin ? `
    <div class="acciones-admin-tarjeta ${!esSuper ? 'solo-privatizar' : ''}" onclick="event.stopPropagation();">
        <button class="btn-accion-admin btn-privatizar" onclick="event.stopPropagation(); privatizarProducto('${p.id}')">
            Privatizar
        </button>
        ${perfilActual.rol === 'superusuario' ? `
            <button class="btn-accion-admin btn-eliminar-admin" onclick="event.stopPropagation(); eliminarProducto('${p.id}')">
                Eliminar
            </button>
        ` : ''}
    </div>
` : ''}            </div>
        `;
        contenedor.appendChild(div);
        
    });
}

// Sobrescribir renderizarProductos para usar paginacion
const renderizarProductosOriginal = renderizarProductos;
renderizarProductos = function() {
    paginaActual = 1;
    renderizarProductosConPaginacion();
};

// ============================================
// 4. BREADCRUMBS (MIGAS DE PAN)
// ============================================
function actualizarBreadcrumbs() {
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
function agregarAnimacionesTarjetas() {
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
// Modificar renderizarProductosPagina para incluir animaciones
const renderizarProductosPaginaOriginal = renderizarProductosPagina;
renderizarProductosPagina = function(productosPagina) {
    renderizarProductosPaginaOriginal(productosPagina);
    setTimeout(agregarAnimacionesTarjetas, 50);
};

// ============================================
// 6. INICIALIZAR MEJORAS
// ============================================
function inicializarMejoras() {
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
async function cargarProductosDesdeSupabase() {
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
function actualizarProgresoCarga(porcentaje) {
    const barra = document.getElementById('overlay-progreso');
    const texto = document.getElementById('overlay-porcentaje');
    if (barra) barra.style.width = porcentaje + '%';
    if (texto) texto.textContent = porcentaje + '%';
}

function ocultarOverlayCarga() {
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
async function cargarCategoriasDesdeSupabase() {
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
async function cargarMarcasDesdeSupabase() {
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
function leerCategoriaDeURL() {
    const params = new URLSearchParams(window.location.search);
    const categoriaId = params.get('categoria');
    
    if (categoriaId) {
        categoriaActiva = categoriaId;
        console.log('Filtrando por categoria:', categoriaId);
    }
}

// ============================================
// INICIALIZACION PRINCIPAL
// ============================================

document.addEventListener("DOMContentLoaded", async  () => {
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

    // ✅ BOTON BUSCAR CON PAGINACION (AGREGADO)
    const btnBuscar = document.getElementById('btn-buscar');
    if (btnBuscar) {
        btnBuscar.addEventListener('click', function() {
            textoBusqueda = document.getElementById('buscador-input').value;
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
    // ============================================
// IMPORTADOR DE EXCEL
// ============================================



// Botón "+" para crear marca nueva
async function crearMarcaDesdeImportador() {
    const nombre = prompt("Nombre de la nueva marca:");
    if (!nombre || !nombre.trim()) return;
    
    const resultado = await BrandService.crear(nombre.trim());
    
    if (!resultado.ok) {
        alert("Error al crear marca: " + resultado.error);
        return;
    }
    
    if (resultado.yaExistia) {
        alert("Esa marca ya existía y fue seleccionada");
    } else if (resultado.reactivada) {
        alert("Marca reactivada y seleccionada");
    } else {
        alert("Marca creada correctamente");
    }
    
    // Recargar lista de marcas en el admin
    renderizarListaMarcasAdmin();
    actualizarSelectMarcas();
    
    // Recargar select del importador y seleccionar la nueva
    llenarSelectMarcaImportar();
    const select = document.getElementById('importar-marca');
    if (select && resultado.data) {
        select.value = resultado.data.id;
    }
}

// Botón "+" para crear categoría nueva
async function crearCategoriaDesdeImportador() {
    const nombre = prompt("Nombre de la nueva categoría:");
    if (!nombre || !nombre.trim()) return;
    
    const resultado = await CategoryService.crear(nombre.trim());
    
    if (!resultado.ok) {
        alert("Error al crear categoría: " + resultado.error);
        return;
    }
    
    if (resultado.yaExistia) {
        alert("Esa categoría ya existía y fue seleccionada");
    } else {
        alert("Categoría creada correctamente");
    }
    
    // Recargar lista de categorías en el admin
    renderizarListaCategoriasAdmin();
    actualizarSelectCategorias();
    
    // Recargar select del importador y seleccionar la nueva
    llenarSelectCategoriaImportar();
    const select = document.getElementById('importar-categoria');
    if (select && resultado.data) {
        select.value = resultado.data.id;
    }
}

// Procesar el Excel subido
async function procesarExcel() {
    const marcaId = document.getElementById('importar-marca').value;
    const categoriaId = document.getElementById('importar-categoria').value;
    const archivoInput = document.getElementById('importar-archivo');
    const archivo = archivoInput.files[0];

    if (!archivo) {
        alert("Selecciona un archivo Excel");
        return;
    }

    const btn = document.getElementById('btn-procesar-excel');
    btn.disabled = true;
    btn.textContent = "Procesando...";

    try {
        const resultado = await ExcelImportService.leerExcel(archivo);

        if (!resultado.ok) {
            alert("Error: " + resultado.error);
            return;
        }

        ExcelImportService.guardarDetectados(resultado.hojas);
        mostrarPasoImportar(2);
        renderizarResumenHojas(resultado.hojas);
        renderizarTablaImportar(resultado.hojas);

        // Actualizar info
        const marcaNombre = marcaId
            ? (BrandService.getCache().find(m => m.id === marcaId)?.nombre || "?")
            : "(del Excel)";
        const catNombre = categoriaId
            ? (CategoryService.getCache().find(c => c.id === categoriaId)?.nombre || "?")
            : "(del Excel)";

        document.getElementById('importar-info').textContent =
            `Se detectaron ${resultado.total} productos en ${resultado.hojas.length} hojas. Marca: ${marcaNombre} | Categoría: ${catNombre}`;

    } catch (err) {
        console.error("Error al procesar Excel:", err);
        alert("Error inesperado al procesar el Excel");
    } finally {
        btn.disabled = false;
        btn.textContent = "Procesar Excel";
    }
}
// Renderizar resumen de hojas (arriba de la tabla)
function renderizarResumenHojas(hojas) {
    const info = document.getElementById('importar-info');
    if (!info) return;

    let html = '<div class="resumen-hojas">';
    hojas.forEach(hoja => {
        const clase = 'resumen-hoja-' + hoja.estado;
        html += `<span class="resumen-hoja ${clase}">${hoja.nombre}: ${hoja.total}</span>`;
    });
    html += '</div>';

    info.innerHTML = html;
}

function renderizarTablaImportar(hojas) {
    const tbody = document.getElementById('cuerpo-importar');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Categorías disponibles para el datalist
    const categoriasDisponibles = CategoryService.getCache();
    const listaCategorias = categoriasDisponibles.map(c =>
        `<option value="${c.nombre}"></option>`
    ).join('');

    const datalistId = 'lista-categorias-importar';
    let datalist = document.getElementById(datalistId);
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = datalistId;
        datalist.innerHTML = listaCategorias;
        document.body.appendChild(datalist);
    } else {
        datalist.innerHTML = listaCategorias;
    }

    let indexGlobal = 0;

    // Recorrer todas las hojas
    hojas.forEach((hoja) => {
        // Fila de encabezado de hoja
        const trHoja = document.createElement('tr');
        trHoja.className = 'fila-hoja-titulo';
        trHoja.innerHTML = `
            <td colspan="8" class="hoja-titulo">
                <strong>${hoja.nombre}</strong> (${hoja.total} productos)
                <span class="badge-estado badge-${hoja.estado}">${hoja.estado}</span>
            </td>
        `;
        tbody.appendChild(trHoja);

        // Productos de la hoja
        hoja.productos.forEach((p, indexHoja) => {
            const tr = document.createElement('tr');
            tr.className = p.estado === 'ok' ? '' : 'estado-' + p.estado;

            tr.innerHTML = `
                <td>${indexHoja + 1}</td>
                <td>
                    <input type="text" value="${p.codigo}" data-hoja="${hoja.nombre}" data-index="${indexHoja}" data-campo="codigo">
                </td>
                <td>
                    <input type="text" value="${p.nombre.replace(/"/g, '&quot;')}" data-hoja="${hoja.nombre}" data-index="${indexHoja}" data-campo="nombre">
                </td>
                <td>
                    <input type="number" step="0.01" value="${p.precio}" data-hoja="${hoja.nombre}" data-index="${indexHoja}" data-campo="precio">
                </td>
                <td>
                    <input type="number" value="${p.cantidad}" data-hoja="${hoja.nombre}" data-index="${indexHoja}" data-campo="cantidad">
                </td>
                <td>
                    <input 
                        type="text" 
                        value="${(p.categoria || '').replace(/"/g, '&quot;')}" 
                        data-hoja="${hoja.nombre}" 
                        data-index="${indexHoja}" 
                        data-campo="categoria"
                        list="${datalistId}"
                        placeholder="Categoría"
                    >
                </td>
                <td>
                    <span class="estado-badge estado-${p.estado}">
                        ${p.estado === 'ok' ? 'OK' : 'Revisar'}
                    </span>
                </td>
                <td>
                    <button class="btn-eliminar-fila" data-hoja="${hoja.nombre}" data-index="${indexHoja}">Eliminar</button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    });

    // Event listeners para editar campos
    tbody.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', (e) => {
            const hojaNombre = e.target.dataset.hoja;
            const indexHoja = parseInt(e.target.dataset.index);
            const campo = e.target.dataset.campo;

            // Buscar la hoja correcta
            const hoja = ExcelImportService.obtenerDetectados().find(h => h.nombre === hojaNombre);
            if (!hoja) return;

            const valor = campo === 'precio' ? parseFloat(e.target.value) || 0
                        : campo === 'cantidad' ? parseInt(e.target.value) || 0
                        : e.target.value.trim();

            hoja.productos[indexHoja][campo] = valor;

            // Revalidar
            const p = hoja.productos[indexHoja];
            p.problemas = [];
            if (!p.codigo) p.problemas.push("Sin código");
            if (!p.nombre) p.problemas.push("Sin nombre");
            if (p.precio <= 0) p.problemas.push("Precio inválido");

            const categoriaFallback = document.getElementById('importar-categoria')?.value;
            if ((!p.categoria || p.categoria === 'Otros') && !categoriaFallback) {
                p.problemas.push("Sin categoría");
            }

            p.estado = p.problemas.length === 0 ? "ok" : "revisar";

            const tr = e.target.closest('tr');
            tr.className = p.estado === 'ok' ? '' : 'estado-' + p.estado;
            tr.querySelector('.estado-badge').className = 'estado-badge estado-' + p.estado;
            tr.querySelector('.estado-badge').textContent = p.estado === 'ok' ? 'OK' : 'Revisar';
        });
    });

    // Event listeners para eliminar
    tbody.querySelectorAll('.btn-eliminar-fila').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const hojaNombre = e.target.dataset.hoja;
            const indexHoja = parseInt(e.target.dataset.index);
            eliminarFilaImportar(hojaNombre, indexHoja);
        });
    });
}

// Eliminar una fila de la tabla
function eliminarFilaImportar(hojaNombre, indexHoja) {
    const hojas = ExcelImportService.obtenerDetectados();
    const hoja = hojas.find(h => h.nombre === hojaNombre);
    if (!hoja) return;

    hoja.productos.splice(indexHoja, 1);
    hoja.total = hoja.productos.length;

    renderizarTablaImportar(hojas);

    // Actualizar info
    const totalProductos = ExcelImportService.obtenerTodosLosProductos().length;
    document.getElementById('importar-info').textContent = 
        `${totalProductos} productos por importar`;
}

// Confirmar importación
async function confirmarImportacion() {
    const hojas = ExcelImportService.obtenerDetectados();
    const marcaId = document.getElementById('importar-marca').value;
    const categoriaId = document.getElementById('importar-categoria').value;
    const inputImagen = document.getElementById('importar-imagen');
    const archivoImagen = inputImagen ? inputImagen.files[0] : null;

    const totalProductos = ExcelImportService.obtenerTodosLosProductos().length;

    if (!confirm(`¿Importar ${totalProductos} productos a Supabase?`)) return;

    const btn = document.getElementById('btn-confirmar-importar');
    btn.disabled = true;
    btn.textContent = "Preparando...";

    try {
        // 1. Subir imagen común
        let imagenUrl = null;
        if (archivoImagen) {
            btn.textContent = "Subiendo imagen...";
            const subidaImagen = await ExcelImportService.subirImagenComun(
                archivoImagen,
                "import-" + Date.now()
            );

            if (subidaImagen.ok) {
                imagenUrl = subidaImagen.url;
            } else {
                alert("No se pudo subir la imagen: " + subidaImagen.error + "\nLos productos se importarán sin imagen.");
            }
        }

        // 2. Importar
        btn.textContent = "Importando...";
        const resultado = await ExcelImportService.importarATodos(
            marcaId,
            categoriaId,
            imagenUrl,
            (progreso) => {
                btn.textContent = `Importando ${progreso.actual}/${progreso.total}...`;
            }
        );

        mostrarPasoImportar(3);
        renderizarResultadoImportar(resultado);

        await cargarProductosDesdeSupabase();
        renderizarProductosConPaginacion();
        actualizarEstadisticasInventario();

    } catch (err) {
        console.error("Error al importar:", err);
        alert("Error inesperado al importar");
    } finally {
        btn.disabled = false;
        btn.textContent = "Importar a Supabase";
    }
}


// Renderizar resultado de la importación
function renderizarResultadoImportar(resultado) {
    const container = document.getElementById('importar-resultado');
    if (!container) return;
    
    let html = `
        <div class="resultado-item">
            <span>Productos importados exitosamente:</span>
            <span class="resultado-exito">${resultado.exitosos}</span>
        </div>
        <div class="resultado-item">
            <span>Productos con errores:</span>
            <span class="resultado-error">${resultado.fallidos}</span>
        </div>
    `;
    
    if (resultado.errores.length > 0) {
        html += `<div style="margin-top:16px;">
            <strong style="color:#dc2626;">Errores:</strong>
            <ul style="margin-top:8px; padding-left:20px; font-size:0.8rem; color:#64748b;">
        `;
        resultado.errores.slice(0, 10).forEach(err => {
            html += `<li>${err}</li>`;
        });
        if (resultado.errores.length > 10) {
            html += `<li>... y ${resultado.errores.length - 10} errores más</li>`;
        }
        html += `</ul></div>`;
    }
    
    container.innerHTML = html;
}

// Volver al paso 1
function volverAlPaso1() {
    mostrarPasoImportar(1);
    document.getElementById('importar-archivo').value = '';
    document.getElementById('importar-info').textContent = '';
}

// Inicializar el importador (conectar botones)
function inicializarImportador() {
    // Botón "+" marca
    const btnNuevaMarca = document.getElementById('btn-nueva-marca-importar');
    if (btnNuevaMarca) {
        btnNuevaMarca.onclick = crearMarcaDesdeImportador;
    }
    
    // Botón "+" categoría
    const btnNuevaCategoria = document.getElementById('btn-nueva-categoria-importar');
    if (btnNuevaCategoria) {
        btnNuevaCategoria.onclick = crearCategoriaDesdeImportador;
    }
    
    // Botón procesar Excel
    const btnProcesar = document.getElementById('btn-procesar-excel');
    if (btnProcesar) {
        btnProcesar.onclick = procesarExcel;
    }
    
    // Botón confirmar importación
    const btnConfirmar = document.getElementById('btn-confirmar-importar');
    if (btnConfirmar) {
        btnConfirmar.onclick = confirmarImportacion;
    }
    
    // Botón cancelar
    const btnCancelar = document.getElementById('btn-cancelar-importar');
    if (btnCancelar) {
        btnCancelar.onclick = volverAlPaso1;
    }
    
    // Botón volver (paso 3)
    const btnVolver = document.getElementById('btn-volver-importar');
    if (btnVolver) {
        btnVolver.onclick = volverAlPaso1;
    }
}

});
// Llenar el select de marcas del importador
function llenarSelectMarcaImportar() {
    const select = document.getElementById('importar-marca');
    if (!select) return;
    
    const marcas = BrandService.getCache();
    select.innerHTML = '<option value="">Seleccionar marca</option>';
    
    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca.id;
        option.textContent = marca.nombre;
        select.appendChild(option);
    });
}

// Llenar el select de categorías del importador
function llenarSelectCategoriaImportar() {
    const select = document.getElementById('importar-categoria');
    if (!select) return;
    
    const categorias = CategoryService.getCache();
    select.innerHTML = '<option value="">Seleccionar categoría</option>';
    
    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
}
// ============================================
// FUNCIONES GLOBALES
// ============================================
window.quitarDelCarrito = quitarDelCarrito;
window.eliminarProducto = eliminarProducto;
window.eliminarCategoria = eliminarCategoria;
window.limpiarVenta = limpiarVenta;

// ============================================
// USER DROPDOWN (NUEVO)
// ============================================
function inicializarUserDropdown() {
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
function inicializarSearchPanel() {
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
// ============================================
// MENSAJES DE CONTACTO (PANEL ADMIN)
// ============================================
let mensajesCache = [];
let mensajesFiltroActual = 'todos';

async function cargarMensajes() {
    const lista = document.getElementById('mensajes-lista');
    if (!lista) return;
    
    lista.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">Cargando mensajes...</p>';
    
    try {
        const { data, error } = await window.sb
            .from('mensajes_contacto')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error al cargar mensajes:', error);
            lista.innerHTML = '<p style="text-align:center; color:#dc2626; padding:40px;">Error al cargar los mensajes</p>';
            return;
        }
        
        mensajesCache = data || [];
        renderizarMensajes();
        actualizarBadgeMensajes();
        
    } catch (err) {
        console.error('Error inesperado:', err);
        lista.innerHTML = '<p style="text-align:center; color:#dc2626; padding:40px;">Error inesperado</p>';
    }
}

function renderizarMensajes() {
    const lista = document.getElementById('mensajes-lista');
    if (!lista) return;
    
    let filtrados = mensajesCache;
    
    if (mensajesFiltroActual === 'no-leidos') {
        filtrados = mensajesCache.filter(m => !m.leido);
    } else if (mensajesFiltroActual === 'leidos') {
        filtrados = mensajesCache.filter(m => m.leido);
    }
    
    if (filtrados.length === 0) {
        lista.innerHTML = `
            <div class="mensajes-vacio">
                <h3>No hay mensajes</h3>
                <p>${mensajesFiltroActual === 'no-leidos' ? 'Todos los mensajes estan leidos' : 'Aun no has recibido mensajes'}</p>
            </div>
        `;
        return;
    }
    
    lista.innerHTML = '';
    
    filtrados.forEach(mensaje => {
        const card = document.createElement('div');
        card.className = `mensaje-card ${mensaje.leido ? '' : 'no-leido'}`;
        
        const fecha = new Date(mensaje.created_at).toLocaleString('es-VE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const telefonoLimpio = (mensaje.telefono || '').replace(/\D/g, '');
        const textoWhatsApp = encodeURIComponent(`Hola ${mensaje.nombre}, recibimos tu mensaje en Supli Motors.`);
        
        card.innerHTML = `
            <div class="mensaje-header">
                <div class="mensaje-info">
                    <h4>${escapeHtml(mensaje.nombre)}</h4>
                    <p>
                        <a href="mailto:${escapeHtml(mensaje.email)}">${escapeHtml(mensaje.email)}</a>
                        ${mensaje.telefono ? ` &middot; <a href="tel:${escapeHtml(mensaje.telefono)}">${escapeHtml(mensaje.telefono)}</a>` : ''}
                    </p>
                </div>
                <span class="mensaje-fecha">${fecha}</span>
            </div>
            ${mensaje.asunto ? `<span class="mensaje-asunto">${escapeHtml(mensaje.asunto)}</span>` : ''}
            <p class="mensaje-texto">${escapeHtml(mensaje.mensaje)}</p>
            <div class="mensaje-acciones">
                ${telefonoLimpio ? `
                    <a href="https://wa.me/${telefonoLimpio}?text=${textoWhatsApp}" target="_blank" class="btn-mensaje-accion btn-mensaje-whatsapp">
                        WhatsApp
                    </a>
                ` : ''}
                <a href="mailto:${escapeHtml(mensaje.email)}?subject=Re: ${encodeURIComponent(mensaje.asunto || 'Tu consulta')}" class="btn-mensaje-accion btn-mensaje-email">
                    Responder email
                </a>
                <button class="btn-mensaje-accion btn-mensaje-eliminar" data-id="${mensaje.id}">
                    Eliminar
                </button>
            </div>
        `;
        
        // Marcar como leido al hacer click en la tarjeta (excepto en links/botones)
        card.addEventListener('click', (e) => {
            if (e.target.closest('a, button')) return;
            if (!mensaje.leido) {
                marcarMensajeComoLeido(mensaje.id);
            }
        });
        
        // Boton eliminar
        const btnEliminar = card.querySelector('.btn-mensaje-eliminar');
        btnEliminar.addEventListener('click', (e) => {
            e.stopPropagation();
            eliminarMensaje(mensaje.id);
        });
        
        lista.appendChild(card);
    });
}

async function marcarMensajeComoLeido(id) {
    try {
        const { error } = await window.sb
            .from('mensajes_contacto')
            .update({ leido: true })
            .eq('id', id);
        
        if (error) {
            console.error('Error al marcar como leido:', error);
            return;
        }
        
        // Actualizar cache local
        const mensaje = mensajesCache.find(m => m.id === id);
        if (mensaje) mensaje.leido = true;
        
        renderizarMensajes();
        actualizarBadgeMensajes();
        
    } catch (err) {
        console.error('Error inesperado:', err);
    }
}

async function eliminarMensaje(id) {
    if (!confirm('¿Eliminar este mensaje permanentemente?')) return;
    
    try {
        const { error } = await window.sb
            .from('mensajes_contacto')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error al eliminar:', error);
            alert('Error al eliminar. Verifica que tengas permisos.');
            return;
        }
        
        mensajesCache = mensajesCache.filter(m => m.id !== id);
        renderizarMensajes();
        actualizarBadgeMensajes();
        
    } catch (err) {
        console.error('Error inesperado:', err);
        alert('Error inesperado al eliminar');
    }
}

function actualizarBadgeMensajes() {
    const badge = document.getElementById('badge-mensajes');
    if (!badge) return;
    
    const noLeidos = mensajesCache.filter(m => !m.leido).length;
    
    if (noLeidos > 0) {
        badge.textContent = noLeidos > 99 ? '99+' : noLeidos;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

function inicializarMensajes() {
    // Filtros
    const filtros = document.querySelectorAll('.mensajes-filtro-btn');
    filtros.forEach(btn => {
        btn.addEventListener('click', () => {
            filtros.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mensajesFiltroActual = btn.dataset.filtro;
            renderizarMensajes();
        });
    });
    
    // Boton actualizar
    const btnActualizar = document.getElementById('btn-actualizar-mensajes');
    if (btnActualizar) {
        btnActualizar.addEventListener('click', cargarMensajes);
    }
}

// Funcion simple para escapar HTML
function escapeHtml(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}
// ============================================
// FUNCIONES FALTANTES — IMPORTADOR Y ADMIN
// ============================================

// Mostrar un paso del importador
function mostrarPasoImportar(numero) {
    const paso1 = document.getElementById('importar-paso-1');
    const paso2 = document.getElementById('importar-paso-2');
    const paso3 = document.getElementById('importar-paso-3');

    if (paso1) paso1.style.display = numero === 1 ? 'block' : 'none';
    if (paso2) paso2.style.display = numero === 2 ? 'block' : 'none';
    if (paso3) paso3.style.display = numero === 3 ? 'block' : 'none';
}

// Renderizar lista de categorías en el panel admin
function renderizarListaCategoriasAdmin() {
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

// Renderizar lista de marcas en el panel admin
function renderizarListaMarcasAdmin() {
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

    container.querySelectorAll('.btn-eliminar-marca').forEach(btn => {
        btn.addEventListener('click', () => {
            eliminarMarca(btn.dataset.id);
        });
    });
}

// Agregar marca
async function agregarMarca() {
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

// Eliminar marca
async function eliminarMarca(id) {
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

        await BrandService.listar();

        renderizarListaMarcasAdmin();
        actualizarSelectMarcas();

    } catch (err) {
        console.error(err);
        alert('Error inesperado');
    }
}

// Eliminar categoría
async function eliminarCategoria(id) {
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

        await CategoryService.listar();

        renderizarListaCategoriasAdmin();
        actualizarSelectCategorias();
        llenarSelectCategoriaImportar();
        renderizarCategorias();

    } catch (err) {
        console.error(err);
        alert('Error inesperado');
    }
}

// Actualizar select de categorías en el formulario de agregar producto
function actualizarSelectCategorias() {
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

    if (valorActual && categorias.some(c => c.id === valorActual)) {
        select.value = valorActual;
    }
}

// Actualizar select de marcas en el formulario
function actualizarSelectMarcas() {
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

    if (valorActual && marcas.some(m => m.id === valorActual)) {
        select.value = valorActual;
    }
}

// Llenar select de marcas del importador
function llenarSelectMarcaImportar() {
    const select = document.getElementById('importar-marca');
    if (!select) return;

    const marcas = BrandService.getCache();
    select.innerHTML = '<option value="">Seleccionar marca</option>';

    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca.id;
        option.textContent = marca.nombre;
        select.appendChild(option);
    });
}

// Llenar select de categorías del importador
function llenarSelectCategoriaImportar() {
    const select = document.getElementById('importar-categoria');
    if (!select) return;

    const categorias = CategoryService.getCache();
    select.innerHTML = '<option value="">Seleccionar categoría</option>';

    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
}

// Volver al paso 1 del importador
function volverAlPaso1() {
    mostrarPasoImportar(1);
    const inputArchivo = document.getElementById('importar-archivo');
    if (inputArchivo) inputArchivo.value = '';
    const info = document.getElementById('importar-info');
    if (info) info.textContent = '';
}

// Renderizar resultado de la importación
function renderizarResultadoImportar(resultado) {
    const container = document.getElementById('importar-resultado');
    if (!container) return;

    let html = `
        <div class="resultado-item">
            <span>Productos importados exitosamente:</span>
            <span class="resultado-exito">${resultado.exitosos}</span>
        </div>
        <div class="resultado-item">
            <span>Productos actualizados:</span>
            <span class="resultado-exito">${resultado.actualizados || 0}</span>
        </div>
        <div class="resultado-item">
            <span>Productos con errores:</span>
            <span class="resultado-error">${resultado.fallidos}</span>
        </div>
    `;

    if (resultado.errores && resultado.errores.length > 0) {
        html += `<div style="margin-top:16px;">
            <strong style="color:#dc2626;">Errores:</strong>
            <ul style="margin-top:8px; padding-left:20px; font-size:0.8rem; color:#64748b;">
        `;
        resultado.errores.slice(0, 10).forEach(err => {
            html += `<li>${err}</li>`;
        });
        if (resultado.errores.length > 10) {
            html += `<li>... y ${resultado.errores.length - 10} errores más</li>`;
        }
        html += `</ul></div>`;
    }

    container.innerHTML = html;
}

// Inicializar importador (conectar botones)
function inicializarImportador() {
    const btnNuevaMarca = document.getElementById('btn-nueva-marca-importar');
    if (btnNuevaMarca) {
        btnNuevaMarca.onclick = crearMarcaDesdeImportador;
    }

    const btnNuevaCategoria = document.getElementById('btn-nueva-categoria-importar');
    if (btnNuevaCategoria) {
        btnNuevaCategoria.onclick = crearCategoriaDesdeImportador;
    }

    const btnProcesar = document.getElementById('btn-procesar-excel');
    if (btnProcesar) {
        btnProcesar.onclick = procesarExcel;
    }

    const btnConfirmar = document.getElementById('btn-confirmar-importar');
    if (btnConfirmar) {
        btnConfirmar.onclick = confirmarImportacion;
    }

    const btnCancelar = document.getElementById('btn-cancelar-importar');
    if (btnCancelar) {
        btnCancelar.onclick = volverAlPaso1;
    }

    const btnVolver = document.getElementById('btn-volver-importar');
    if (btnVolver) {
        btnVolver.onclick = volverAlPaso1;
    }
}

// Crear marca nueva desde el importador
async function crearMarcaDesdeImportador() {
    const nombre = prompt("Nombre de la nueva marca:");
    if (!nombre || !nombre.trim()) return;

    const resultado = await BrandService.crear(nombre.trim());

    if (!resultado.ok) {
        alert("Error al crear marca: " + resultado.error);
        return;
    }

    if (resultado.yaExistia) {
        alert("Esa marca ya existía y fue seleccionada");
    } else if (resultado.reactivada) {
        alert("Marca reactivada y seleccionada");
    } else {
        alert("Marca creada correctamente");
    }

    renderizarListaMarcasAdmin();
    actualizarSelectMarcas();
    llenarSelectMarcaImportar();

    const select = document.getElementById('importar-marca');
    if (select && resultado.data) {
        select.value = resultado.data.id;
    }
}

// Crear categoría nueva desde el importador
async function crearCategoriaDesdeImportador() {
    const nombre = prompt("Nombre de la nueva categoría:");
    if (!nombre || !nombre.trim()) return;

    const resultado = await CategoryService.crear(nombre.trim());

    if (!resultado.ok) {
        alert("Error al crear categoría: " + resultado.error);
        return;
    }

    if (resultado.yaExistia) {
        alert("Esa categoría ya existía y fue seleccionada");
    } else {
        alert("Categoría creada correctamente");
    }

    renderizarListaCategoriasAdmin();
    actualizarSelectCategorias();
    llenarSelectCategoriaImportar();

    const select = document.getElementById('importar-categoria');
    if (select && resultado.data) {
        select.value = resultado.data.id;
    }
}
// ============================================
// GESTIÓN DE USUARIOS (PANEL ADMIN)
// ============================================
let usuariosCache = [];
let usuariosFiltroActual = 'todos';

async function cargarUsuarios() {
    const tbody = document.getElementById('cuerpo-usuarios');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">Cargando usuarios...</td></tr>';

    try {
        const { data, error } = await window.sb
            .from('perfiles')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) {
            console.error('Error al cargar usuarios:', error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#dc2626;">Error al cargar los usuarios</td></tr>';
            return;
        }

        usuariosCache = data || [];
        renderizarUsuarios();

    } catch (err) {
        console.error('Error inesperado:', err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#dc2626;">Error inesperado</td></tr>';
    }
}

function renderizarUsuarios() {
    const tbody = document.getElementById('cuerpo-usuarios');
    if (!tbody) return;

    const buscador = document.getElementById('buscador-usuarios');
    const textoBusqueda = buscador ? buscador.value.trim().toLowerCase() : '';

    let filtrados = usuariosCache;

    if (usuariosFiltroActual !== 'todos') {
        filtrados = filtrados.filter(u => u.rol === usuariosFiltroActual);
    }

    if (textoBusqueda) {
        filtrados = filtrados.filter(u =>
            (u.nombre || '').toLowerCase().includes(textoBusqueda) ||
            (u.email || '').toLowerCase().includes(textoBusqueda)
        );
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">No hay usuarios que coincidan</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    filtrados.forEach(u => {
        const usuarioTexto = u.email ? u.email.replace('@suplimotors.local', '') : '-';

        const fechaLogin = u.ultimo_login 
            ? new Date(u.ultimo_login).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'Nunca';

        const esMiPropioUsuario = perfilActual && perfilActual.id === u.id;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(u.nombre || '-')}</strong></td>
            <td>${escapeHtml(usuarioTexto)}</td>
            <td><span class="rol-badge rol-${u.rol}">${u.rol}</span></td>
            <td><span class="estado-badge-user estado-${u.activo ? 'activo' : 'inactivo'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td>${fechaLogin}</td>
<td>
    <button class="btn-user-action btn-user-ver" data-id="${u.id}" style="background: var(--accent-pale); color: var(--accent);">
        Ver
    </button>
    ${!esMiPropioUsuario ? `
        <button class="btn-user-action btn-user-toggle ${u.activo ? '' : 'activar'}" data-id="${u.id}" data-activo="${u.activo}">
            ${u.activo ? 'Desactivar' : 'Activar'}
        </button>
    ` : '<span style="color:#94a3b8; font-size:0.7rem;">Tú</span>'}
</td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-user-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const estaActivo = btn.dataset.activo === 'true';
            toggleActivoUsuario(id, estaActivo);
            
        });
    });
        tbody.querySelectorAll('.btn-user-ver').forEach(btn => {
        btn.addEventListener('click', () => {
            verUsuario(btn.dataset.id);
        });
    });
}


async function toggleActivoUsuario(id, estaActivo) {
    const accion = estaActivo ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} este usuario?`)) return;

    try {
        const { error } = await window.sb
            .from('perfiles')
            .update({ activo: !estaActivo })
            .eq('id', id);

        if (error) {
            alert('Error: ' + error.message);
            return;
        }

        const user = usuariosCache.find(u => u.id === id);
        if (user) user.activo = !estaActivo;

        renderizarUsuarios();
        alert('Usuario actualizado');

    } catch (err) {
        console.error(err);
        alert('Error inesperado');
    }
}

function abrirModalNuevoUsuario() {
    const modal = document.getElementById('modal-nuevo-usuario');
    if (!modal) return;

    document.getElementById('nuevo-usuario-nombre-usuario').value = '';
    document.getElementById('nuevo-usuario-nombre-completo').value = '';
    document.getElementById('nuevo-usuario-password').value = '';
    document.getElementById('nuevo-usuario-cedula').value = '';
    document.getElementById('nuevo-usuario-telefono').value = '';
    document.getElementById('nuevo-usuario-email-real').value = '';
    document.getElementById('nuevo-usuario-tipo').value = 'cliente';

    const opcionAdmin = document.getElementById('opcion-admin');
    if (opcionAdmin) {
        if (perfilActual && perfilActual.rol === 'superusuario') {
            opcionAdmin.style.display = 'block';
        } else {
            opcionAdmin.style.display = 'none';
        }
    }

    const msg = document.getElementById('mensaje-usuario');
    if (msg) {
        msg.style.display = 'none';
        msg.textContent = '';
    }

modal.style.display = 'block';
modal.style.opacity = '1';
modal.style.visibility = 'visible';
modal.style.animation = 'none'
}

function cerrarModalNuevoUsuario() {
    const modal = document.getElementById('modal-nuevo-usuario');
    if (modal) modal.style.display = 'none';
}

function generarPasswordRandom() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 10; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('nuevo-usuario-password').value = pass;
}

async function guardarNuevoUsuario() {
    const tipo = document.getElementById('nuevo-usuario-tipo').value;
    const usuario = document.getElementById('nuevo-usuario-nombre-usuario').value.trim();
    const nombreCompleto = document.getElementById('nuevo-usuario-nombre-completo').value.trim();
    const password = document.getElementById('nuevo-usuario-password').value;
    const cedula = document.getElementById('nuevo-usuario-cedula').value.trim();
    const telefono = document.getElementById('nuevo-usuario-telefono').value.trim();
    const emailReal = document.getElementById('nuevo-usuario-email-real').value.trim();

    const msg = document.getElementById('mensaje-usuario');
    const btn = document.getElementById('btn-guardar-usuario');

    if (!usuario || !nombreCompleto || !password) {
        mostrarMensajeUsuario('error', 'Usuario, nombre y contraseña son obligatorios');
        return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(usuario)) {
        mostrarMensajeUsuario('error', 'El usuario solo puede tener letras, números, guiones y puntos');
        return;
    }

    if (password.length < 6) {
        mostrarMensajeUsuario('error', 'La contraseña debe tener al menos 6 caracteres');
        return;
    }

    if (tipo === 'cliente' && !cedula) {
        mostrarMensajeUsuario('error', 'La cédula es obligatoria para clientes');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
        const resultado = await AuthService.crearUsuarioAdmin({
            tipo: tipo,
            emailOUsuario: usuario,
            password: password,
            nombre: nombreCompleto,
            cedula: cedula,
            telefono: telefono,
            emailReal: emailReal
        });

        if (!resultado.ok) {
            mostrarMensajeUsuario('error', 'ERROR: ' + resultado.error);
            console.error('❌ Error real de la Edge Function:', resultado.error);
            alert('Detalle del error:\n\n' + resultado.error);
            return;
        }

        mostrarMensajeUsuario('success', 
            `Usuario "${usuario}" creado correctamente. Contraseña: ${password} — ¡Copiala y envíasela al usuario!`
        );

        setTimeout(async () => {
            await cargarUsuarios();
            cerrarModalNuevoUsuario();
        }, 4000);

    } catch (err) {
        console.error(err);
        mostrarMensajeUsuario('error', 'Error inesperado');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Crear Usuario';
    }
}

function mostrarMensajeUsuario(tipo, texto) {
    const msg = document.getElementById('mensaje-usuario');
    if (!msg) return;
    msg.className = `contacto-status ${tipo}`;
    msg.textContent = texto;
    msg.style.display = 'block';
}

function inicializarUsuarios() {
    document.querySelectorAll('.usuarios-filtro-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.usuarios-filtro-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            usuariosFiltroActual = btn.dataset.filtro;
            renderizarUsuarios();
        });
    });

    const buscador = document.getElementById('buscador-usuarios');
    if (buscador) {
        buscador.addEventListener('input', () => renderizarUsuarios());
    }

    const btnNuevo = document.getElementById('btn-nuevo-usuario');
    if (btnNuevo) {
        btnNuevo.addEventListener('click', abrirModalNuevoUsuario);
    }

    const btnCerrar = document.getElementById('cerrar-modal-usuario');
    if (btnCerrar) btnCerrar.addEventListener('click', cerrarModalNuevoUsuario);

    const btnCancelar = document.getElementById('btn-cancelar-usuario');
    if (btnCancelar) btnCancelar.addEventListener('click', cerrarModalNuevoUsuario);

    const btnGuardar = document.getElementById('btn-guardar-usuario');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarNuevoUsuario);

    const btnGenerar = document.getElementById('btn-generar-password');
    if (btnGenerar) btnGenerar.addEventListener('click', generarPasswordRandom);

    // Mostrar/ocultar campos según tipo
    const selectTipo = document.getElementById('nuevo-usuario-tipo');
    if (selectTipo) {
        selectTipo.addEventListener('change', () => {
            const camposCliente = document.getElementById('campos-cliente');
            if (camposCliente) {
                camposCliente.style.display = selectTipo.value === 'cliente' ? 'block' : 'none';
            }
        });
    }

    // Cerrar modal al hacer clic fuera
    const modalUsuario = document.getElementById('modal-nuevo-usuario');
    if (modalUsuario) {
        modalUsuario.addEventListener('click', (e) => {
            if (e.target === modalUsuario) {
                cerrarModalNuevoUsuario();
            }
        });
    }
    // Modal Ver Usuario
const btnCerrarVer = document.getElementById('cerrar-modal-ver-usuario');
if (btnCerrarVer) btnCerrarVer.addEventListener('click', cerrarModalVerUsuario);

const btnCerrarVer2 = document.getElementById('btn-cerrar-ver-usuario');
if (btnCerrarVer2) btnCerrarVer2.addEventListener('click', cerrarModalVerUsuario);

// Cerrar al hacer clic fuera
const modalVerUsuario = document.getElementById('modal-ver-usuario');
if (modalVerUsuario) {
    modalVerUsuario.addEventListener('click', (e) => {
        if (e.target === modalVerUsuario) {
            cerrarModalVerUsuario();
        }
    });
}
}
// ============================================
// VER DETALLES DE UN USUARIO
// ============================================
async function verUsuario(id) {
    const modal = document.getElementById('modal-ver-usuario');
    const body = document.getElementById('ver-usuario-body');
    const titulo = document.getElementById('ver-usuario-titulo');
    if (!modal || !body) return;

    body.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:20px;">Cargando datos...</p>';
    titulo.textContent = 'Detalles del Usuario';
modal.style.display = 'block';
modal.style.opacity = '1';
modal.style.visibility = 'visible';
modal.style.animation = 'none'
    try {
// 1. Obtener perfil
const { data: perfil, error: perfilError } = await window.sb
    .from('perfiles')
    .select('*')
    .eq('id', id)
    .single();

if (perfilError || !perfil) {
    console.error('❌ Error perfilError:', perfilError);
    body.innerHTML = `<p style="text-align:center; color:#dc2626; padding:20px;">
        Error al cargar el perfil<br>
        <small>${perfilError?.message || 'Perfil no encontrado'}</small>
    </p>`;
    return;
}

        // 2. Obtener datos de cliente (si aplica)
        let cliente = null;
        if (perfil.rol === 'cliente') {
            const { data: clienteData } = await window.sb
                .from('clientes')
                .select('*')
                .eq('id', id)
                .maybeSingle();
            cliente = clienteData;
        }

        // 3. Construir HTML
        titulo.textContent = perfil.nombre || 'Usuario';

        const usuarioTexto = perfil.email ? perfil.email.replace('@suplimotors.local', '') : '-';
        const esEmailReal = perfil.email && !perfil.email.includes('@suplimotors.local');

        const fechaLogin = perfil.ultimo_login
            ? new Date(perfil.ultimo_login).toLocaleString('es-VE', {
                day: '2-digit', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })
            : 'Nunca se ha logueado';

        const fechaRegistro = cliente?.fechaRegistro
            ? new Date(cliente.fechaRegistro).toLocaleString('es-VE', {
                day: '2-digit', month: 'long', year: 'numeric'
            })
            : 'No registrada';

        let html = '';

        // Sección 1: Datos básicos
        html += `
            <div class="detalle-usuario-row">
                <span class="detalle-usuario-label">Nombre</span>
                <span class="detalle-usuario-valor">${escapeHtml(perfil.nombre || '-')}</span>
            </div>
            <div class="detalle-usuario-row">
                <span class="detalle-usuario-label">Usuario</span>
                <span class="detalle-usuario-valor">${escapeHtml(usuarioTexto)}</span>
            </div>
            <div class="detalle-usuario-row">
                <span class="detalle-usuario-label">Email</span>
                <span class="detalle-usuario-valor ${esEmailReal ? '' : 'sin-dato'}">
                    ${esEmailReal ? escapeHtml(perfil.email) : 'No tiene email real'}
                </span>
            </div>
            <div class="detalle-usuario-row">
                <span class="detalle-usuario-label">Rol</span>
                <span class="detalle-usuario-valor">
                    <span class="rol-badge rol-${perfil.rol}">${perfil.rol}</span>
                </span>
            </div>
            <div class="detalle-usuario-row">
                <span class="detalle-usuario-label">Estado</span>
                <span class="detalle-usuario-valor">
                    <span class="estado-badge-user estado-${perfil.activo ? 'activo' : 'inactivo'}">
                        ${perfil.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </span>
            </div>
            <div class="detalle-usuario-row">
                <span class="detalle-usuario-label">Último login</span>
                <span class="detalle-usuario-valor">${fechaLogin}</span>
            </div>
        `;

        // Sección 2: Datos de cliente
        if (perfil.rol === 'cliente') {
            html += `
                <div class="detalle-usuario-seccion">
                    <div class="detalle-usuario-seccion-titulo">Datos de Cliente</div>
                    <div class="detalle-usuario-row">
                        <span class="detalle-usuario-label">Cédula</span>
                        <span class="detalle-usuario-valor ${cliente?.cedula ? '' : 'sin-dato'}">
                            ${cliente?.cedula ? escapeHtml(cliente.cedula) : 'No registrada'}
                        </span>
                    </div>
                    <div class="detalle-usuario-row">
                        <span class="detalle-usuario-label">Teléfono</span>
                        <span class="detalle-usuario-valor ${cliente?.telefono ? '' : 'sin-dato'}">
                            ${cliente?.telefono ? escapeHtml(cliente.telefono) : 'No registrado'}
                        </span>
                    </div>
                    <div class="detalle-usuario-row">
                        <span class="detalle-usuario-label">Dirección</span>
                        <span class="detalle-usuario-valor ${cliente?.direccion ? '' : 'sin-dato'}">
                            ${cliente?.direccion ? escapeHtml(cliente.direccion) : 'No registrada'}
                        </span>
                    </div>
                    <div class="detalle-usuario-row">
                        <span class="detalle-usuario-label">Compras</span>
                        <span class="detalle-usuario-valor">${cliente?.compras || 0}</span>
                    </div>
                    <div class="detalle-usuario-row">
                        <span class="detalle-usuario-label">Total gastado</span>
                        <span class="detalle-usuario-valor">$${(cliente?.totalGastado || 0).toFixed(2)}</span>
                    </div>
                    <div class="detalle-usuario-row">
                        <span class="detalle-usuario-label">Fecha de registro</span>
                        <span class="detalle-usuario-valor">${fechaRegistro}</span>
                    </div>
                </div>
            `;
        }

        // Sección 3: ID técnico
        html += `
            <div class="detalle-usuario-seccion">
                <div class="detalle-usuario-seccion-titulo">Información técnica</div>
                <div class="detalle-usuario-row">
                    <span class="detalle-usuario-label">ID</span>
                    <span class="detalle-usuario-valor" style="font-family: monospace; font-size: 0.75rem;">${perfil.id}</span>
                </div>
            </div>
        `;

        body.innerHTML = html;
 const btnEditar = document.getElementById('btn-editar-usuario');
        if (btnEditar) {
            const esAdmin = perfilActual && (perfilActual.rol === 'admin' || perfilActual.rol === 'superusuario');
            const esMiPropio = perfilActual && perfilActual.id === id;
            
            if (esAdmin && !esMiPropio) {
                btnEditar.style.display = 'inline-flex';
                btnEditar.onclick = () => abrirEdicionUsuario(perfil, cliente);
            } else {
                btnEditar.style.display = 'none';
            }
        }

} catch (err) {
    console.error('❌ Error al ver usuario:', err);
    body.innerHTML = `<p style="text-align:center; color:#dc2626; padding:20px;">
        Error inesperado: ${err.message}<br>
        <small style="color:#94a3b8;">${err.stack || ''}</small>
    </p>`;
}
}

function cerrarModalVerUsuario() {
    const modal = document.getElementById('modal-ver-usuario');
    if (modal) modal.style.display = 'none';
}
// ============================================
// EDITAR DATOS DE USUARIO (email real, teléfono)
// ============================================
function abrirEdicionUsuario(perfil, cliente) {
    const body = document.getElementById('ver-usuario-body');
    const titulo = document.getElementById('ver-usuario-titulo');
    const btnEditar = document.getElementById('btn-editar-usuario');
    if (!body) return;

    titulo.textContent = `Editar: ${perfil.nombre || 'Usuario'}`;
    if (btnEditar) btnEditar.style.display = 'none';

    const emailReal = perfil.email && !perfil.email.includes('@suplimotors.local') ? perfil.email : '';
    const telefono = cliente?.telefono || '';
    const direccion = cliente?.direccion || '';

    body.innerHTML = `
        <div class="editar-usuario-campo">
            <label>Email real</label>
            <input type="email" id="edit-email-real" value="${escapeHtml(emailReal)}" placeholder="cliente@ejemplo.com">
            <small style="color:#94a3b8; font-size:0.75rem; margin-top:4px;">
                Email de contacto (no cambia el usuario de acceso)
            </small>
        </div>

        ${perfil.rol === 'cliente' ? `
            <div class="editar-usuario-campo">
                <label>Teléfono</label>
                <input type="tel" id="edit-telefono" value="${escapeHtml(telefono)}" placeholder="Ej: 0412-1234567">
            </div>

            <div class="editar-usuario-campo">
                <label>Dirección</label>
                <input type="text" id="edit-direccion" value="${escapeHtml(direccion)}" placeholder="Dirección completa">
            </div>
        ` : ''}

        <div id="mensaje-edicion" class="contacto-status"></div>

        <div class="editar-usuario-acciones">
            <button class="btn-guardar-edicion" id="btn-guardar-edicion">
                Guardar cambios
            </button>
            <button class="btn-cancelar-edicion" id="btn-cancelar-edicion">
                Cancelar
            </button>
        </div>
    `;

    document.getElementById('btn-guardar-edicion').addEventListener('click', () => {
        guardarEdicionUsuario(perfil, cliente);
    });

    document.getElementById('btn-cancelar-edicion').addEventListener('click', () => {
        verUsuario(perfil.id);
    });
}

async function guardarEdicionUsuario(perfil, cliente) {
    const msg = document.getElementById('mensaje-edicion');
    const btnGuardar = document.getElementById('btn-guardar-edicion');
    
    const emailReal = document.getElementById('edit-email-real').value.trim();
    const telefono = document.getElementById('edit-telefono')?.value.trim() || '';
    const direccion = document.getElementById('edit-direccion')?.value.trim() || '';

    if (emailReal && !emailReal.includes('@')) {
        msg.className = 'contacto-status error';
        msg.textContent = 'El email no es válido';
        msg.style.display = 'block';
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    try {
        // 1. Actualizar email en perfiles (si tiene email real)
        if (emailReal !== (perfil.email || '')) {
            const { error: errorPerfil } = await window.sb
                .from('perfiles')
                .update({ email: emailReal || perfil.email })
                .eq('id', perfil.id);

            if (errorPerfil) {
                console.warn('Error al actualizar email en perfiles:', errorPerfil);
            }
        }

        // 2. Actualizar datos en la tabla clientes (si es cliente)
        if (perfil.rol === 'cliente') {
            const { error: errorCliente } = await window.sb
                .from('clientes')
                .update({
                    telefono: telefono || null,
                    direccion: direccion || null,
                    email: emailReal || null
                })
                .eq('id', perfil.id);

            if (errorCliente) {
                msg.className = 'contacto-status error';
                msg.textContent = 'Error al actualizar: ' + errorCliente.message;
                msg.style.display = 'block';
                return;
            }
        }

        msg.className = 'contacto-status success';
        msg.textContent = 'Datos actualizados correctamente';
        msg.style.display = 'block';

        setTimeout(() => {
            verUsuario(perfil.id);
        }, 1200);

    } catch (err) {
        console.error('Error al guardar:', err);
        msg.className = 'contacto-status error';
        msg.textContent = 'Error inesperado: ' + err.message;
        msg.style.display = 'block';
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar cambios';
    }
}
// ============================================
// RECUPERAR CONTRASEÑA
// ============================================
function abrirModalRecuperar() {
    const modal = document.getElementById('modal-recuperar');
    if (!modal) return;
    
    document.getElementById('recuperar-email').value = '';
    document.getElementById('recuperar-error').style.display = 'none';
    document.getElementById('recuperar-exito').style.display = 'none';
    
    modal.style.display = 'block';
}

function cerrarModalRecuperar() {
    const modal = document.getElementById('modal-recuperar');
    if (modal) modal.style.display = 'none';
}

async function enviarEmailRecuperacion() {
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
function inicializarRecuperar() {
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
async function privatizarProducto(id) {
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