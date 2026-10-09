// ============================================
// Panel de administracion: bandeja de mensajes de contacto
// ============================================

import { escapeHtml } from "../lib/util.js";
import { sb } from "../servicios/supabase-client.js";

// ============================================
// MENSAJES DE CONTACTO (PANEL ADMIN)
// ============================================
export let mensajesCache = [];

export let mensajesFiltroActual = 'todos';

export async function cargarMensajes() {
    const lista = document.getElementById('mensajes-lista');
    if (!lista) return;
    
    lista.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">Cargando mensajes...</p>';
    
    try {
        const { data, error } = await sb
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

export function renderizarMensajes() {
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

export async function marcarMensajeComoLeido(id) {
    try {
        const { error } = await sb
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

export async function eliminarMensaje(id) {
    if (!confirm('¿Eliminar este mensaje permanentemente?')) return;
    
    try {
        const { error } = await sb
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

export function actualizarBadgeMensajes() {
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

export function inicializarMensajes() {
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
