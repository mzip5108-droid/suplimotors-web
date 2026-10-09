// ============================================
// Panel de administracion: reportes de ventas
// ============================================

import { VentaService } from "../servicios/venta-service.js";
import { clientes } from "./clientes.js";

// ============================================
// FUNCIONES DE REPORTES
// ============================================
export async function actualizarReportes() {
    const periodo = document.getElementById('reporte-periodo').value;

    // Las ventas se leen de Supabase; si la migracion no esta aplicada se usa el
    // historial del navegador (VentaService.historial ya resuelve el respaldo).
    const resultadoHistorial = await VentaService.historial();
    const historial = resultadoHistorial.data;
    if (resultadoHistorial.origen === "local") {
        console.warn("Reportes calculados con el historial del navegador: falta aplicar la migracion de ventas.");
    }
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
        if (!c.created_at) return false;
        return new Date(c.created_at) >= fechaInicio;
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
        // Construido con DOM y textContent: el nombre del producto viene de la
        // base (y antes de un Excel) y no se interpola en HTML.
        const izquierda = document.createElement('div');
        const titulo = document.createElement('span');
        titulo.style.cssText = 'font-weight:600; color:#0f172a;';
        titulo.textContent = `${index + 1}. ${nombre}`;
        izquierda.appendChild(titulo);

        const derecha = document.createElement('div');
        const etiquetaCantidad = document.createElement('span');
        etiquetaCantidad.style.color = '#64748b';
        etiquetaCantidad.textContent = 'Cantidad: ';
        const valorCantidad = document.createElement('span');
        valorCantidad.style.cssText = 'font-weight:600; color:#1a56db;';
        valorCantidad.textContent = String(data.cantidad);
        const etiquetaTotal = document.createElement('span');
        etiquetaTotal.style.cssText = 'color:#64748b; margin-left:15px;';
        etiquetaTotal.textContent = 'Total: ';
        const valorTotal = document.createElement('span');
        valorTotal.style.cssText = 'font-weight:600; color:#1a56db;';
        valorTotal.textContent = `$${data.total.toFixed(2)}`;
        derecha.append(etiquetaCantidad, valorCantidad, etiquetaTotal, valorTotal);

        div.append(izquierda, derecha);
        container.appendChild(div);
    });
}
