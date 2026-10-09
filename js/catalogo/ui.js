// ============================================
// Mejoras de interfaz: tema, vista, dropdown de usuario y buscador
// ============================================

import { setPaginaActual, setTemaActual, setTextoBusqueda, setVistaActual, temaActual, vistaActual } from "./estado.js";
import { renderizarProductosConPaginacion } from "./render.js";

// ============================================
// 1. MODO OSCURO/CLARO
// ============================================
export function toggleTema() {
    const body = document.body;
    const icono = document.getElementById('icono-tema');
    
    if (temaActual === 'claro') {
        body.classList.add('modo-oscuro');
        setTemaActual('oscuro');
        icono.textContent = '☀️';
        document.getElementById('btn-toggle-tema').classList.add('activo');
    } else {
        body.classList.remove('modo-oscuro');
        setTemaActual('claro');
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
        setVistaActual('lista');
        icono.textContent = '⊞';
        document.getElementById('btn-toggle-vista').classList.add('activo');
    } else {
        grid.classList.remove('vista-lista');
        setVistaActual('grilla');
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
        setTextoBusqueda(valor);
        setPaginaActual(1);
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
