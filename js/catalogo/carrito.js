// ============================================
// Carrito de compras, detalle de producto y pedido por WhatsApp
// ============================================

import { cantidadSeleccionada, carrito, guardarCarrito, perfilActual, setActualProd, setCantidadSeleccionada, setCarrito } from "./estado.js";
import { VentaService } from "../servicios/venta-service.js";
import { PLACEHOLDER_IMG, getImagenMarca } from "../lib/imagenes-marcas.js";

export function actualizarCarrito() {
    const lista = document.getElementById("lista-carrito");
    let total = 0;
    let items = 0;
    
    if (lista) {
        lista.innerHTML = "";
        carrito.forEach((item, indice) => {
            const sub = parseFloat(item.precio) * item.cantidad;
            total += sub;
            items += item.cantidad;

            // Se construye con DOM y un listener real: antes era innerHTML con
            // el nombre del producto interpolado (y un onclick inline que
            // obligaba a exponer la funcion en window).
            const fila = document.createElement("li");

            const datos = document.createElement("div");
            const cantidad = document.createElement("strong");
            cantidad.textContent = `${item.cantidad}x`;
            datos.appendChild(cantidad);
            datos.appendChild(document.createTextNode(` ${item.nombre || ""}`));
            datos.appendChild(document.createElement("br"));
            const subtotal = document.createElement("small");
            subtotal.textContent = `$${sub.toFixed(2)}`;
            datos.appendChild(subtotal);
            fila.appendChild(datos);

            const quitar = document.createElement("button");
            quitar.className = "btn-quitar-item";
            quitar.textContent = "X";
            quitar.addEventListener("click", () => quitarDelCarrito(indice));
            fila.appendChild(quitar);

            lista.appendChild(fila);
        });
    }
    
    const totalPago = document.getElementById("total-pago");
    const contador = document.getElementById("contador-productos");
    if (totalPago) totalPago.textContent = total.toFixed(2);
    if (contador) contador.textContent = items;
}

export function quitarDelCarrito(index) {
    carrito.splice(index, 1);
    guardarCarrito();
    actualizarCarrito();
}

export function abrirDetalle(producto) {
    setActualProd(producto);
    setCantidadSeleccionada(1);
    
    const categoriaNombre = producto.categoria_nombre || 'Sin categoría';
    const categoriaIcono = producto.categoria_icono || '';    
    document.getElementById("input-cantidad").value = cantidadSeleccionada;
    document.getElementById("detalle-img").src =
        producto.imagen || getImagenMarca(producto.marca) || PLACEHOLDER_IMG;
    document.getElementById("detalle-nombre").textContent = producto.nombre;
    document.getElementById("detalle-codigo").textContent = `Cod: ${producto.codigo || ""}`;
    document.getElementById("detalle-categoria").textContent = `${categoriaIcono} ${categoriaNombre}`.trim();
    document.getElementById("detalle-desc").textContent = producto.descripcion || "Sin descripcion disponible";
    document.getElementById("detalle-precio").textContent = parseFloat(producto.precio).toFixed(2);
    
    if (document.getElementById("detalle-marca")) {
        document.getElementById("detalle-marca").textContent = producto.marca ? `Marca: ${producto.marca}` : '';
    }
    
    if (document.getElementById("detalle-stock")) {
        const stock = producto.stock || 0;
        const esAdmin = perfilActual && (perfilActual.rol === 'admin' || perfilActual.rol === 'superusuario');
        const stockElem = document.getElementById("detalle-stock");

        if (stockElem) {
            if (esAdmin) {
                stockElem.parentElement.style.display = 'block'; // o 'inline'
                stockElem.innerHTML = stock;
                stockElem.style.color = stock < 5 ? '#dc2626' : '#16a34a';
            } else {
                // Ocultar el párrafo completo de "Stock disponible: X unidades"
                stockElem.parentElement.style.display = 'none';
            }
        }
    }
    
    document.getElementById("modal-detalle").style.display = "block";
}

export function limpiarVenta() {
    setCarrito([]);
    guardarCarrito();
    location.reload();
}

export function generarMensajeWhatsApp(datosCliente, carrito, total) {
    let mensaje = "SUPLI MOTORS - NUEVO PEDIDO\n\n";
    mensaje += "DATOS DEL CLIENTE\n";
    mensaje += `Nombre: ${datosCliente.nombre}\n`;
    mensaje += `Cedula: ${datosCliente.cedula}\n`;
    if (datosCliente.email) mensaje += `Email: ${datosCliente.email}\n`;
    if (datosCliente.telefono) mensaje += `Telefono: ${datosCliente.telefono}\n`;
    if (datosCliente.direccion) mensaje += `Direccion: ${datosCliente.direccion}\n`;
    if (datosCliente.notas) mensaje += `Notas: ${datosCliente.notas}\n`;
    
    mensaje += "\nDETALLE DEL PEDIDO\n";
    
    carrito.forEach((item, index) => {
        const subtotal = parseFloat(item.precio) * item.cantidad;
        mensaje += `${index + 1}. ${item.nombre}\n`;
        mensaje += `   Cantidad: ${item.cantidad}\n`;
        mensaje += `   Precio unitario: $${parseFloat(item.precio).toFixed(2)}\n`;
        mensaje += `   Subtotal: $${subtotal.toFixed(2)}\n\n`;
    });
    
    mensaje += `TOTAL A PAGAR: $${total}\n\n`;
    mensaje += "Gracias por tu compra!";
    
    return encodeURIComponent(mensaje);
}

export function actualizarResumenPedido() {
    const resumenItems = document.getElementById('resumen-items');
    const resumenTotal = document.getElementById('resumen-total');
    let total = 0;
    
    if (resumenItems) {
        resumenItems.innerHTML = '';
        carrito.forEach(item => {
            const subtotal = parseFloat(item.precio) * item.cantidad;
            total += subtotal;
            
            const div = document.createElement('div');
            div.className = 'resumen-item';
            div.innerHTML = `
                <span class="item-nombre">${item.nombre}</span>
                <span class="item-cantidad">${item.cantidad}x</span>
                <span class="item-subtotal">$${subtotal.toFixed(2)}</span>
            `;
            resumenItems.appendChild(div);
        });
    }
    
    if (resumenTotal) {
        resumenTotal.textContent = `$${total.toFixed(2)}`;
    }
    
    return total.toFixed(2);
}

export async function enviarPedidoWhatsApp() {
    const nombre = document.getElementById("nombre-cliente").value.trim();
    const cedula = document.getElementById("cedula-cliente").value.trim();
    const email = document.getElementById("email-cliente").value.trim();
    const telefono = document.getElementById("telefono-cliente").value.trim();
    const direccion = document.getElementById("direccion-cliente").value.trim();
    const notas = document.getElementById("notas-cliente").value.trim();
    
    if(!nombre || !cedula) {
        alert("Por favor ingresa nombre y cedula");
        return false;
    }
    
    if(carrito.length === 0) {
        alert("El carrito esta vacio");
        return false;
    }
    
    const total = actualizarResumenPedido();
    
    const datosCliente = {
        nombre: nombre,
        cedula: cedula,
        email: email,
        telefono: telefono,
        direccion: direccion,
        notas: notas
    };
    
    const numeroWhatsApp = "584141234567";
    
    const mensaje = generarMensajeWhatsApp(datosCliente, carrito, total);
    const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensaje}`;
    
    window.open(urlWhatsApp, '_blank');
    
    // La venta se registra en Supabase (tablas ventas / venta_items). Si la
    // migracion todavia no esta aplicada, queda en el navegador para no perderla.
    const venta = await VentaService.registrar(datosCliente, carrito, total);

    if (!venta.ok) {
        console.warn(
            "La venta no se pudo guardar en Supabase; se guarda en el navegador:",
            venta.error
        );
        VentaService.guardarEnHistorialLocal(datosCliente, carrito, total);
    }
    
    setCarrito([]);
    guardarCarrito();
    actualizarCarrito();
    
    document.getElementById("modal-compra").style.display = "none";
    
    document.getElementById("nombre-cliente").value = '';
    document.getElementById("cedula-cliente").value = '';
    document.getElementById("email-cliente").value = '';
    document.getElementById("telefono-cliente").value = '';
    document.getElementById("direccion-cliente").value = '';
    document.getElementById("notas-cliente").value = '';
    
    alert("Pedido enviado! Seras redirigido a WhatsApp para confirmar.");
    
    return true;
}

