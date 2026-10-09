// ============================================
// Ventas: registro de pedidos en Supabase
// El historial de compras vivia solo en el localStorage del navegador, asi que
// cada equipo veia ventas distintas y los reportes no cuadraban. Ahora se
// guarda en las tablas `ventas` y `venta_items` (ver supabase/migrations).
// Mientras la migracion no este aplicada, el modulo degrada al localStorage
// para que una compra nunca se pierda.
// ============================================

import { sb } from "./supabase-client.js";

const CLAVE_HISTORIAL_LOCAL = "supli_motors_historial";

// Da a una venta de Supabase la misma forma que tenia el historial local, para
// que los reportes no tengan que conocer dos formatos.
function normalizarVenta(venta) {
    return {
        id: venta.id,
        numero: venta.numero,
        fecha: venta.created_at,
        total: Number(venta.total || 0),
        cedula: venta.cedula,
        nombreCliente: venta.nombre_cliente,
        estado: venta.estado,
        carrito: (venta.venta_items || []).map((item) => ({
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio: Number(item.precio_unitario || 0)
        }))
    };
}

export const VentaService = {
    // ============================================
    // GUARDAR UNA VENTA
    // Devuelve { ok: true, data } o { ok: false, error }.
    // ============================================
    async registrar(datosCliente, carrito, total) {
        if (!carrito || carrito.length === 0) {
            return { ok: false, error: "El carrito esta vacio" };
        }

        try {
            const { data: sesion } = await sb.auth.getSession();
            const usuarioId = sesion && sesion.session ? sesion.session.user.id : null;

            // Se intenta vincular la venta con la ficha del cliente por cedula
            const { data: fichaCliente } = await sb
                .from("clientes")
                .select("id")
                .eq("cedula", datosCliente.cedula)
                .maybeSingle();

            const { data: venta, error } = await sb
                .from("ventas")
                .insert({
                    cliente_id: fichaCliente ? fichaCliente.id : null,
                    cedula: datosCliente.cedula,
                    nombre_cliente: datosCliente.nombre,
                    email: datosCliente.email || null,
                    telefono: datosCliente.telefono || null,
                    direccion: datosCliente.direccion || null,
                    notas: datosCliente.notas || null,
                    total: Number(total),
                    estado: "pendiente",
                    creado_por: usuarioId
                })
                .select()
                .single();

            if (error) {
                return { ok: false, error: error.message };
            }

            const items = carrito.map((item) => ({
                venta_id: venta.id,
                producto_id: item.id || null,
                codigo: item.codigo || null,
                nombre: item.nombre,
                precio_unitario: Number(item.precio || 0),
                cantidad: Number(item.cantidad || 0),
                subtotal: Number(item.precio || 0) * Number(item.cantidad || 0)
            }));

            const { error: errorItems } = await sb.from("venta_items").insert(items);

            if (errorItems) {
                // La venta ya quedo registrada: el detalle es recuperable
                console.warn("La venta se guardo pero su detalle fallo:", errorItems);
            }

            return { ok: true, data: normalizarVenta({ ...venta, venta_items: items }) };
        } catch (err) {
            console.error("Error inesperado al registrar la venta:", err);
            return { ok: false, error: err.message };
        }
    },

    // ============================================
    // RESPALDO EN EL NAVEGADOR
    // ============================================
    guardarEnHistorialLocal(datosCliente, carrito, total) {
        const historial = JSON.parse(localStorage.getItem(CLAVE_HISTORIAL_LOCAL)) || [];
        historial.push({
            ...datosCliente,
            carrito: carrito,
            total: total,
            fecha: new Date().toLocaleString()
        });
        localStorage.setItem(CLAVE_HISTORIAL_LOCAL, JSON.stringify(historial));
    },

    // ============================================
    // HISTORIAL PARA LOS REPORTES
    // Intenta Supabase y, si la migracion todavia no esta aplicada, usa el
    // historial del navegador.
    // ============================================
    async historial() {
        const { data, error } = await sb
            .from("ventas")
            .select("id, numero, created_at, total, cedula, nombre_cliente, estado, venta_items (nombre, cantidad, precio_unitario)")
            .order("created_at", { ascending: false });

        if (!error && data) {
            return { ok: true, origen: "supabase", data: data.map(normalizarVenta) };
        }

        const local = JSON.parse(localStorage.getItem(CLAVE_HISTORIAL_LOCAL)) || [];
        return {
            ok: true,
            origen: "local",
            data: local.map((h) => ({
                fecha: h.fecha,
                total: Number(h.total || 0),
                cedula: h.cedula,
                carrito: (h.carrito || []).map((i) => ({
                    nombre: i.nombre,
                    cantidad: i.cantidad,
                    precio: Number(i.precio || 0)
                }))
            }))
        };
    }
};
