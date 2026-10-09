// ============================================
// Panel de administracion: gestion de usuarios y perfiles
// ============================================

import { escapeAttr, escapeHtml } from "../lib/util.js";
import { perfilActual } from "./catalogo.js";
import { AuthService } from "../servicios/auth-service.js";
import { sb } from "../servicios/supabase-client.js";

// ============================================
// GESTIÓN DE USUARIOS (PANEL ADMIN)
// ============================================
export let usuariosCache = [];

export let usuariosFiltroActual = 'todos';

export async function cargarUsuarios() {
    const tbody = document.getElementById('cuerpo-usuarios');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">Cargando usuarios...</td></tr>';

    try {
        const { data, error } = await sb
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

export function renderizarUsuarios() {
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

export async function toggleActivoUsuario(id, estaActivo) {
    const accion = estaActivo ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} este usuario?`)) return;

    try {
        const { error } = await sb
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

export function abrirModalNuevoUsuario() {
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

export function cerrarModalNuevoUsuario() {
    const modal = document.getElementById('modal-nuevo-usuario');
    if (modal) modal.style.display = 'none';
}

export function generarPasswordRandom() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 10; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('nuevo-usuario-password').value = pass;
}

export async function guardarNuevoUsuario() {
    const tipo = document.getElementById('nuevo-usuario-tipo').value;
    const usuario = document.getElementById('nuevo-usuario-nombre-usuario').value.trim();
    const nombreCompleto = document.getElementById('nuevo-usuario-nombre-completo').value.trim();
    const password = document.getElementById('nuevo-usuario-password').value;
    const cedula = document.getElementById('nuevo-usuario-cedula').value.trim();
    const telefono = document.getElementById('nuevo-usuario-telefono').value.trim();
    const emailReal = document.getElementById('nuevo-usuario-email-real').value.trim();

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

export function mostrarMensajeUsuario(tipo, texto) {
    const msg = document.getElementById('mensaje-usuario');
    if (!msg) return;
    msg.className = `contacto-status ${tipo}`;
    msg.textContent = texto;
    msg.style.display = 'block';
}

export function inicializarUsuarios() {
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
export async function verUsuario(id) {
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
const { data: perfil, error: perfilError } = await sb
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
            const { data: clienteData } = await sb
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

export function cerrarModalVerUsuario() {
    const modal = document.getElementById('modal-ver-usuario');
    if (modal) modal.style.display = 'none';
}

// ============================================
// EDITAR DATOS DE USUARIO (email real, teléfono)
// ============================================
export function abrirEdicionUsuario(perfil, cliente) {
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
            <input type="email" id="edit-email-real" value="${escapeAttr(emailReal)}" placeholder="cliente@ejemplo.com">
            <small style="color:#94a3b8; font-size:0.75rem; margin-top:4px;">
                Email de contacto (no cambia el usuario de acceso)
            </small>
        </div>

        ${perfil.rol === 'cliente' ? `
            <div class="editar-usuario-campo">
                <label>Teléfono</label>
                <input type="tel" id="edit-telefono" value="${escapeAttr(telefono)}" placeholder="Ej: 0412-1234567">
            </div>

            <div class="editar-usuario-campo">
                <label>Dirección</label>
                <input type="text" id="edit-direccion" value="${escapeAttr(direccion)}" placeholder="Dirección completa">
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

export async function guardarEdicionUsuario(perfil, cliente) {
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
            const { error: errorPerfil } = await sb
                .from('perfiles')
                .update({ email: emailReal || perfil.email })
                .eq('id', perfil.id);

            if (errorPerfil) {
                console.warn('Error al actualizar email en perfiles:', errorPerfil);
            }
        }

        // 2. Actualizar datos en la tabla clientes (si es cliente)
        if (perfil.rol === 'cliente') {
            const { error: errorCliente } = await sb
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
