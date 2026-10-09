// ============================================
// Render del catalogo: tarjetas, paginacion, contadores y filtros de la UI
// ============================================

import { eliminarProducto, privatizarProducto } from "./admin.js";
import { abrirDetalle } from "./carrito.js";
import { categoriaActiva, categorias, paginaActual, perfilActual, productos, productosFiltradosCache, productosPorPagina, setCategoriaActiva, setPaginaActual, setProductosFiltradosCache, textoBusqueda } from "./estado.js";
import { filtrarProductos } from "./filtros.js";
import { CategoryService } from "../servicios/category-service.js";
import { PLACEHOLDER_IMG, getImagenMarca } from "../lib/imagenes-marcas.js";

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
    setPaginaActual(1);
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
            setCategoriaActiva(btn.dataset.categoria);
            setPaginaActual(1);
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
                setPaginaActual(pagina);
                renderizarProductosConPaginacion();
            }
        });
    });
}

export function renderizarProductosConPaginacion() {
    const productosFiltrados = filtrarProductos();
    setProductosFiltradosCache(productosFiltrados);

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
