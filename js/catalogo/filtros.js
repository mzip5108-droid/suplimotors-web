// ============================================
// Filtros del catalogo: busqueda, categoria, marca, precio y stock
// ============================================

import { categoriaActiva, marcaFiltro, productos, rangoPrecio, setCategoriaActiva, setMarcaFiltro, setRangoPrecio, setStockFiltro, setTextoBusqueda, stockFiltro, textoBusqueda } from "./estado.js";
import { renderizarProductos } from "./render.js";
import { normalizarTexto } from "../lib/util.js";

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

export function inicializarFiltros() {
    const buscador = document.getElementById('buscador-input');
    if (buscador) {
        buscador.addEventListener('input', (e) => {
            setTextoBusqueda(e.target.value);
            renderizarProductos();
        });
    }
    
    
    const filtroMarca = document.getElementById('filtro-marca');
    if (filtroMarca) {
        filtroMarca.addEventListener('change', (e) => {
            setMarcaFiltro(e.target.value);
            renderizarProductos();
        });
    }
    
    const filtroPrecio = document.getElementById('filtro-rango-precio');
    if (filtroPrecio) {
        filtroPrecio.addEventListener('change', (e) => {
            setRangoPrecio(e.target.value);
            renderizarProductos();
        });
    }
    
    const filtroStock = document.getElementById('filtro-stock');
    if (filtroStock) {
        filtroStock.addEventListener('change', (e) => {
            setStockFiltro(e.target.value);
            renderizarProductos();
        });
    }
    
    const btnLimpiar = document.getElementById('btn-limpiar-filtros');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            setTextoBusqueda('');
            setMarcaFiltro('');
            setRangoPrecio('');
            setStockFiltro('');
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

export function leerCategoriaDeURL() {
    const params = new URLSearchParams(window.location.search);
    const categoriaId = params.get('categoria');
    
    if (categoriaId) {
        setCategoriaActiva(categoriaId);
        console.log('Filtrando por categoria:', categoriaId);
    }
}
