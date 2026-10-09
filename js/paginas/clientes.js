// ============================================
// Panel de administracion: clientes
// Los clientes viven en la tabla `clientes` de Supabase (los crea la Edge
// Function admin-create-user junto con el usuario de auth). Antes esta pantalla
// mantenia una lista paralela en el localStorage del navegador, asi que cada
// equipo veia clientes distintos y se perdian al limpiar el navegador.
// ============================================

import { sb } from "../servicios/supabase-client.js";
import { abrirEdicionUsuario } from "./usuarios.js";

// Cache en memoria de la ultima consulta
export let clientes = [];

// ============================================
// CARGA
// ============================================
export async function cargarClientes() {
    const { data, error } = await sb
        .from("clientes")
        .select("id, cedula, nombre, telefono, email, direccion, activo, created_at")
        .order("nombre");

    if (error) {
        console.error("Error al cargar clientes:", error);
        return { ok: false, error: error.message, data: [] };
    }

    clientes = (data || []).filter((c) => c.activo !== false);
    await completarResumenDeCompras();

    return { ok: true, data: clientes };
}

// Agrega a cada cliente cuantas compras tiene y cuanto gasto.
// Se calcula desde la tabla `ventas`. Si la migracion todavia no se aplico,
// cae al historial guardado en el navegador para no dejar la columna vacia.
async function completarResumenDeCompras() {
    const { data, error } = await sb.from("ventas").select("cliente_id, total");

    const porCliente = new Map();

    if (!error && data) {
        for (const venta of data) {
            const actual = porCliente.get(venta.cliente_id) || { compras: 0, total: 0 };
            actual.compras += 1;
            actual.total += Number(venta.total || 0);
            porCliente.set(venta.cliente_id, actual);
        }
    } else {
        const historial = JSON.parse(localStorage.getItem("supli_motors_historial")) || [];
        for (const cliente of clientes) {
            const propias = historial.filter((h) => h.cedula === cliente.cedula);
            porCliente.set(cliente.id, {
                compras: propias.length,
                total: propias.reduce((suma, h) => suma + Number(h.total || 0), 0)
            });
        }
    }

    for (const cliente of clientes) {
        const resumen = porCliente.get(cliente.id) || { compras: 0, total: 0 };
        cliente.compras = resumen.compras;
        cliente.totalGastado = resumen.total;
    }
}

// ============================================
// RENDER
// Se construye con DOM y textContent: los datos vienen de la base y no se
// confian. Antes se usaba innerHTML con los datos interpolados y onclick inline.
// ============================================
export function renderizarClientes(filtro = "") {
    const tbody = document.getElementById("cuerpo-clientes");
    if (!tbody) return;

    const termino = String(filtro || "").trim().toLowerCase();
    const visibles = termino
        ? clientes.filter(
              (c) =>
                  String(c.cedula || "").toLowerCase().includes(termino) ||
                  String(c.nombre || "").toLowerCase().includes(termino)
          )
        : clientes;

    tbody.innerHTML = "";

    if (visibles.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.style.textAlign = "center";
        td.style.padding = "30px";
        td.style.color = "#94a3b8";
        td.textContent = clientes.length === 0 ? "No hay clientes registrados" : "Sin resultados";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    for (const cliente of visibles) {
        const tr = document.createElement("tr");

        const celdas = [
            cliente.cedula || "-",
            cliente.nombre || "-",
            cliente.telefono || "-",
            String(cliente.compras || 0),
            `$${Number(cliente.totalGastado || 0).toFixed(2)}`
        ];

        celdas.forEach((valor, indice) => {
            const td = document.createElement("td");
            if (indice === 1) {
                const fuerte = document.createElement("strong");
                fuerte.textContent = valor;
                td.appendChild(fuerte);
            } else {
                td.textContent = valor;
            }
            tr.appendChild(td);
        });

        const acciones = document.createElement("td");
        acciones.appendChild(
            crearBotonAccion("Ver", "btn-ver-cliente", () => verHistorialCliente(cliente.id))
        );
        acciones.appendChild(
            crearBotonAccion("Editar", "btn-editar-cliente", () => editarCliente(cliente.id))
        );
        acciones.appendChild(
            crearBotonAccion("Eliminar", "btn-eliminar-admin", () => eliminarCliente(cliente.id))
        );
        tr.appendChild(acciones);

        tbody.appendChild(tr);
    }
}

function crearBotonAccion(texto, clase, alHacerClic) {
    const boton = document.createElement("button");
    boton.className = `btn-accion-cliente ${clase}`;
    boton.textContent = texto;
    boton.addEventListener("click", alHacerClic);
    return boton;
}

// ============================================
// HISTORIAL DE COMPRAS
// ============================================
export async function verHistorialCliente(id) {
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) return;

    let compras = [];

    // Con la migracion aplicada el detalle sale de `ventas` + `venta_items`
    const { data, error } = await sb
        .from("ventas")
        .select("numero, created_at, total, venta_items (nombre, cantidad)")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false });

    if (!error && data) {
        compras = data;
    } else {
        const historial = JSON.parse(localStorage.getItem("supli_motors_historial")) || [];
        compras = historial
            .filter((h) => h.cedula === cliente.cedula)
            .map((h) => ({ created_at: h.fecha, total: h.total, venta_items: h.carrito || [] }));
    }

    let mensaje = `HISTORIAL DE COMPRAS - ${cliente.nombre}\n`;
    mensaje += `Cedula: ${cliente.cedula}\n`;
    mensaje += `Total compras: ${cliente.compras || 0}\n`;
    mensaje += `Total gastado: $${Number(cliente.totalGastado || 0).toFixed(2)}\n\n`;

    if (compras.length === 0) {
        mensaje += "No tiene compras registradas";
    } else {
        compras.forEach((compra, i) => {
            mensaje += `--- Compra ${i + 1} ---\n`;
            mensaje += `Fecha: ${compra.created_at || "N/A"}\n`;
            mensaje += `Total: $${compra.total || 0}\n`;
            mensaje += `Productos: ${compra.venta_items ? compra.venta_items.length : 0}\n\n`;
        });
    }

    alert(mensaje);
}

// ============================================
// EDITAR
// Reutiliza el modal de edicion del panel de usuarios, que ya sabe actualizar
// el email real en `perfiles` y el telefono/direccion en `clientes`.
// ============================================
export function editarCliente(id) {
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) return;

    abrirEdicionUsuario(
        {
            id: cliente.id,
            nombre: cliente.nombre,
            rol: "cliente",
            email: cliente.email || null
        },
        cliente
    );
}

// ============================================
// BAJA
// Es una baja logica: se conserva el historial de compras del cliente.
// ============================================
export async function eliminarCliente(id) {
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) return;

    if (
        !confirm(
            `Desactivar al cliente "${cliente.nombre}"?\n\n` +
                "Se conserva su historial de compras, pero deja de aparecer en la lista y no podra iniciar sesion."
        )
    ) {
        return;
    }

    const { error } = await sb.from("clientes").update({ activo: false }).eq("id", id);
    if (error) {
        alert("Error al desactivar: " + error.message);
        return;
    }

    const { error: errorPerfil } = await sb
        .from("perfiles")
        .update({ activo: false })
        .eq("id", id);
    if (errorPerfil) {
        console.warn("El cliente se desactivo pero su perfil no:", errorPerfil);
    }

    clientes = clientes.filter((c) => c.id !== id);
    renderizarClientes();
    alert("Cliente desactivado");
}

// ============================================
// INICIALIZACION
// ============================================
export async function inicializarClientes() {
    const buscador = document.getElementById("buscador-cliente");
    const btnBuscar = document.getElementById("btn-buscar-cliente");
    const btnNuevo = document.getElementById("btn-nuevo-cliente");

    if (buscador) {
        buscador.addEventListener("input", (e) => renderizarClientes(e.target.value));
    }
    if (btnBuscar) {
        btnBuscar.addEventListener("click", () => {
            renderizarClientes(buscador ? buscador.value : "");
        });
    }

    // El alta de un cliente crea tambien su usuario de acceso, y eso solo puede
    // hacerlo la Edge Function admin-create-user desde la pestana de usuarios.
    // Antes este boton guardaba el cliente solo en el navegador, sin usuario.
    if (btnNuevo) {
        btnNuevo.addEventListener("click", () => {
            const pestanaUsuarios = document.querySelector('.admin-tab[data-tab="usuarios"]');
            if (pestanaUsuarios) pestanaUsuarios.click();
        });
    }

    await cargarClientes();
    renderizarClientes();
}
