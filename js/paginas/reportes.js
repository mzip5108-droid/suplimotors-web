// ============================================
// Panel de administracion: reportes de ventas
// ============================================

import { clientes } from "./clientes.js";

// ============================================
// FUNCIONES DE REPORTES
// ============================================
export function actualizarReportes() {
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

export function renderizarTopProductos(ventasPorProducto) {
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
