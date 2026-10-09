// ============================================
// Sesion: login, logout, permisos por rol y recuperacion de contrasena
// ============================================

import { recargarDatosDeLaSesion } from "./datos.js";
import { perfilActual, setCarrito, setPerfilActual } from "./estado.js";
import { AuthService } from "../servicios/auth-service.js";
import { sb } from "../servicios/supabase-client.js";

export async function verificarSesion() {
    try {
        const sesion = await AuthService.getSesion();
        
        if (sesion) {
            setPerfilActual(await AuthService.getPerfil());
            
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
        setPerfilActual(resultado.perfil);

        // Desbloquear el scroll y ocultar el modal de login
        document.body.style.overflow = '';
        document.getElementById('modal-login').style.display = 'none';
        document.getElementById('btn-logout').style.display = 'block';
        document.getElementById('btn-login').style.display = 'none';

        // Limpiar campos
        input.value = '';
        passwordInput.value = '';

        // Permisos del rol y recarga de datos con la sesion ya activa
        aplicarPermisosPorRol(perfilActual);
        await recargarDatosDeLaSesion();

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
    setCarrito([]);
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
        const { error } = await sb.auth.resetPasswordForEmail(email, {
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
