// ============================================
// CONTACTO PAGE
// ============================================

const NUMERO_WHATSAPP = '584141234567';

// ============================================
// ENVIAR MENSAJE A SUPABASE
// ============================================
async function enviarMensajeSupabase(datos) {
    try {
        const { error } = await window.sb
            .from('mensajes_contacto')
            .insert({
                nombre: datos.nombre,
                email: datos.email,
                telefono: datos.telefono || null,
                asunto: datos.asunto || null,
                mensaje: datos.mensaje
            });

        if (error) {
            console.error('Error al guardar mensaje:', error);
            return { ok: false, error: error.message };
        }

        return { ok: true };
    } catch (err) {
        console.error('Error inesperado:', err);
        return { ok: false, error: err.message };
    }
}

// ============================================
// ARMAR MENSAJE DE WHATSAPP
// ============================================
function armarMensajeWhatsApp(datos) {
    let mensaje = 'CONTACTO - SUPLI MOTORS\n\n';
    mensaje += `Nombre: ${datos.nombre}\n`;
    mensaje += `Email: ${datos.email}\n`;
    if (datos.telefono) mensaje += `Telefono: ${datos.telefono}\n`;
    if (datos.asunto) mensaje += `Asunto: ${datos.asunto}\n`;
    mensaje += `\nMensaje:\n${datos.mensaje}`;
    return encodeURIComponent(mensaje);
}

// ============================================
// MOSTRAR ESTADO
// ============================================
function mostrarEstado(tipo, mensaje) {
    const status = document.getElementById('contacto-status');
    if (!status) return;

    status.className = `contacto-status ${tipo}`;
    status.textContent = mensaje;

    if (tipo === 'success') {
        setTimeout(() => {
            status.className = 'contacto-status';
            status.textContent = '';
        }, 5000);
    }
}

// ============================================
// VALIDAR DATOS
// ============================================
function validarDatos(datos) {
    if (!datos.nombre || datos.nombre.trim().length < 2) {
        return 'Por favor ingresa tu nombre';
    }
    if (!datos.email || !datos.email.includes('@')) {
        return 'Por favor ingresa un email valido';
    }
    if (!datos.mensaje || datos.mensaje.trim().length < 10) {
        return 'El mensaje debe tener al menos 10 caracteres';
    }
    return null;
}

// ============================================
// OBTENER DATOS DEL FORMULARIO
// ============================================
function obtenerDatosFormulario() {
    return {
        nombre: document.getElementById('contacto-nombre').value.trim(),
        email: document.getElementById('contacto-email').value.trim(),
        telefono: document.getElementById('contacto-telefono').value.trim(),
        asunto: document.getElementById('contacto-asunto').value.trim(),
        mensaje: document.getElementById('contacto-mensaje').value.trim()
    };
}

// ============================================
// LIMPIAR FORMULARIO
// ============================================
function limpiarFormulario() {
    document.getElementById('contacto-nombre').value = '';
    document.getElementById('contacto-email').value = '';
    document.getElementById('contacto-telefono').value = '';
    document.getElementById('contacto-asunto').value = '';
    document.getElementById('contacto-mensaje').value = '';
}

// ============================================
// MANEJAR ENVIO
// ============================================
async function manejarEnvio(e, abrirWhatsApp) {
    if (e) e.preventDefault();

    const datos = obtenerDatosFormulario();
    const errorValidacion = validarDatos(datos);

    if (errorValidacion) {
        mostrarEstado('error', errorValidacion);
        return;
    }

    const btnSubmit = document.querySelector('#contacto-form button[type="submit"]');
    const btnWhatsApp = document.getElementById('contacto-whatsapp');

    const btnActivo = abrirWhatsApp ? btnWhatsApp : btnSubmit;
    const textoOriginal = btnActivo.textContent;

    btnSubmit.disabled = true;
    btnWhatsApp.disabled = true;
    btnActivo.textContent = 'Enviando...';

    try {
        const resultado = await enviarMensajeSupabase(datos);

        if (!resultado.ok) {
            mostrarEstado('error', 'Error al enviar. Intenta de nuevo.');
            return;
        }

        // Abrir WhatsApp si corresponde
        if (abrirWhatsApp) {
            const mensaje = armarMensajeWhatsApp(datos);
            window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${mensaje}`, '_blank');
        }

        mostrarEstado('success', 'Mensaje enviado correctamente. Te responderemos pronto.');
        limpiarFormulario();

    } catch (err) {
        console.error('Error:', err);
        mostrarEstado('error', 'Error inesperado. Intenta de nuevo.');
    } finally {
        btnSubmit.disabled = false;
        btnWhatsApp.disabled = false;
        btnSubmit.textContent = 'Enviar mensaje';
        btnWhatsApp.textContent = 'Enviar por WhatsApp';
    }
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
// INICIALIZAR
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contacto-form');
    const btnWhatsApp = document.getElementById('contacto-whatsapp');

    if (form) {
        form.addEventListener('submit', (e) => manejarEnvio(e, false));
    }

    if (btnWhatsApp) {
        btnWhatsApp.addEventListener('click', (e) => manejarEnvio(e, true));
    }

    inicializarUserDropdown();

    const btnNavSearch = document.getElementById('btn-nav-search');
    if (btnNavSearch) {
        btnNavSearch.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
});