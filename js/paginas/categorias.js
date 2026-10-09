// ============================================
// Pagina de categorias: grid con contador de productos por categoria
// ============================================

import { AuthService } from "../servicios/auth-service.js";
import { sb } from "../servicios/supabase-client.js";

// ============================================
// CATEGORIAS PAGE - Logica de la pagina de categorias
// ============================================

let todasLasCategorias = [];
let categoriasFiltradas = [];
let contadoresProductos = {};

// ============================================
// CARGAR CATEGORIAS Y CONTADORES
// ============================================
async function cargarCategoriasConContadores() {
    try {
        // 1. Cargar categorias
        const resultCats = await sb
            .from('categorias')
            .select('id, nombre, icono')
            .eq('activa', true)
            .order('nombre', { ascending: true });

        if (resultCats.error) {
            console.error('Error al cargar categorias:', resultCats.error);
            mostrarErrorCategorias();
            return;
        }

        todasLasCategorias = resultCats.data || [];

        // 2. Cargar productos activos para contar por categoria
        const resultProds = await sb
            .from('productos')
            .select('categoria_id')
            .eq('activo', true);

        if (resultProds.error) {
            console.warn('No se pudieron contar los productos:', resultProds.error);
        } else {
            // Contar productos por categoria
            contadoresProductos = {};
            (resultProds.data || []).forEach(p => {
                if (p.categoria_id) {
                    contadoresProductos[p.categoria_id] = (contadoresProductos[p.categoria_id] || 0) + 1;
                }
            });
        }

        // Solo mostrar categorias con al menos 1 producto
        const categoriasConProductos = todasLasCategorias.filter(cat => 
            (contadoresProductos[cat.id] || 0) > 0
        );

        // Ordenar de mayor a menor por cantidad de productos
        categoriasConProductos.sort((a, b) => 
            (contadoresProductos[b.id] || 0) - (contadoresProductos[a.id] || 0)
        );

        todasLasCategorias = categoriasConProductos;
        categoriasFiltradas = [...categoriasConProductos];

        renderizarCategorias();
        actualizarContador();

    } catch (err) {
        console.error('Error inesperado:', err);
        mostrarErrorCategorias();
    }
}

// ============================================
// RENDERIZAR GRID
// ============================================
function renderizarCategorias() {
    const grid = document.getElementById('categorias-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (categoriasFiltradas.length === 0) {
        grid.innerHTML = `
            <div class="categorias-vacio">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <h3>No se encontraron categorias</h3>
                <p>Intenta con otro termino de busqueda</p>
            </div>
        `;
        return;
    }

    categoriasFiltradas.forEach((cat, index) => {
        const cantidad = contadoresProductos[cat.id] || 0;
        const catCard = document.createElement('a');
        catCard.href = `index.html?categoria=${cat.id}`;
        catCard.className = 'categoria-card';
        catCard.style.animationDelay = `${index * 0.03}s`;

        catCard.innerHTML = `
            <div class="categoria-card-icono">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div class="categoria-card-info">
                <h3 class="categoria-card-nombre">${cat.nombre}</h3>
                <span class="categoria-card-count">${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}</span>
            </div>
            <div class="categoria-card-arrow">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </div>
        `;

        grid.appendChild(catCard);
    });
}

// ============================================
// CONTADOR DE RESULTADOS
// ============================================
function actualizarContador() {
    const contador = document.getElementById('categorias-contador');
    if (!contador) return;

    const total = todasLasCategorias.length;
    const mostradas = categoriasFiltradas.length;

    if (mostradas === total) {
        contador.innerHTML = `Mostrando <strong>${total}</strong> categorias`;
    } else if (mostradas === 0) {
        contador.innerHTML = `Sin resultados`;
    } else {
        contador.innerHTML = `Mostrando <strong>${mostradas}</strong> de <strong>${total}</strong> categorias`;
    }
}

// ============================================
// ERROR
// ============================================
function mostrarErrorCategorias() {
    const grid = document.getElementById('categorias-grid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="categorias-vacio">
            <h3>Error al cargar</h3>
            <p>No se pudieron cargar las categorias. Intenta de nuevo.</p>
        </div>
    `;
}

// ============================================
// BUSCADOR DE CATEGORIAS
// ============================================
function inicializarBuscadorCategorias() {
    const input = document.getElementById('categorias-search-input');
    if (!input) return;

    input.addEventListener('input', (e) => {
        const termino = e.target.value.trim().toLowerCase();

        if (!termino) {
            categoriasFiltradas = [...todasLasCategorias];
        } else {
            categoriasFiltradas = todasLasCategorias.filter(cat =>
                cat.nombre.toLowerCase().includes(termino)
            );
        }

        renderizarCategorias();
        actualizarContador();
    });
}

// ============================================
// USER DROPDOWN + VERIFICAR SESION
// ============================================
async function inicializarUserDropdown() {
    const btnUserMenu = document.getElementById('btn-user-menu');
    const userMenuContainer = btnUserMenu ? btnUserMenu.closest('.user-menu-container') : null;
    const dropdownLogin = document.getElementById('dropdown-login');

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

    // Boton "Iniciar sesion"
    if (dropdownLogin) {
        dropdownLogin.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // ============================================
    // VERIFICAR SESION ACTIVA (NUEVO)
    // ============================================
    try {
        const sesion = await AuthService.getSesion();
        
        if (sesion) {
            const perfil = await AuthService.getPerfil();
            
            if (perfil && perfil.activo) {
                // Actualizar dropdown con datos del usuario
                const dropdownUserName = document.getElementById('dropdown-user-name');
                const dropdownUserRole = document.getElementById('dropdown-user-role');
                const dropdownMyAccount = document.getElementById('dropdown-my-account');
                const btnLogoutHeader = document.getElementById('btn-logout-header');
                const btnModoAdmin = document.getElementById('btn-modo-admin');

                if (dropdownUserName) dropdownUserName.textContent = perfil.nombre;
                
                if (dropdownUserRole) {
                    const rolTexto = perfil.rol === 'superusuario' ? 'Superusuario'
                                  : perfil.rol === 'admin' ? 'Administrador'
                                  : 'Cliente';
                    dropdownUserRole.textContent = rolTexto;
                }

                if (dropdownLogin) dropdownLogin.style.display = 'none';
                if (dropdownMyAccount) dropdownMyAccount.style.display = 'flex';
                if (btnLogoutHeader) {
                    btnLogoutHeader.style.display = 'flex';
                    btnLogoutHeader.addEventListener('click', cerrarSesionSimple);
                }

                if (btnModoAdmin && (perfil.rol === 'admin' || perfil.rol === 'superusuario')) {
                    btnModoAdmin.style.display = 'flex';
                    btnModoAdmin.addEventListener('click', () => {
                        window.location.href = 'index.html';
                    });
                }

                console.log('Sesion activa:', perfil.nombre, '-', perfil.rol);
            }
        }
    } catch (err) {
        console.error('Error al verificar sesion:', err);
    }
}

// Cerrar sesion simple
async function cerrarSesionSimple() {
    if (!confirm('¿Cerrar sesión?')) return;
    await AuthService.logout();
    window.location.reload();
}

// ============================================
// BOTON BUSCAR DEL NAVBAR
// ============================================
function inicializarBotonBuscar() {
    const btnNavSearch = document.getElementById('btn-nav-search');
    if (!btnNavSearch) return;

    btnNavSearch.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// ============================================
// INICIALIZACION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    inicializarBuscadorCategorias();
    inicializarUserDropdown();
    inicializarBotonBuscar();
    await cargarCategoriasConContadores();
});
