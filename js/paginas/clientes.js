// ============================================
// Panel de administracion: clientes (pendiente de migrar a Supabase)
// ============================================

// ============================================
// VARIABLES DE CLIENTES Y SISTEMA
// ============================================
export const clientes = JSON.parse(localStorage.getItem("supli_motors_clientes")) || [];

export let clienteEditando = null;

export const guardarClientes = () => localStorage.setItem("supli_motors_clientes", JSON.stringify(clientes));

// ============================================
// FUNCIONES DE CLIENTES
// ============================================
export function renderizarClientes(filtro = '') {
    const tbody = document.getElementById('cuerpo-clientes');
    if (!tbody) return;
    
    let clientesFiltrados = clientes;
    if (filtro) {
        const filtroLower = filtro.toLowerCase();
        clientesFiltrados = clientes.filter(c => 
            c.cedula.includes(filtroLower) ||
            c.nombre.toLowerCase().includes(filtroLower)
        );
    }
    
    tbody.innerHTML = '';
    
    if (clientesFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">No hay clientes registrados</td></tr>`;
        return;
    }
    
    clientesFiltrados.forEach((cliente, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cliente.cedula}</td>
            <td><strong>${cliente.nombre}</strong></td>
            <td>${cliente.telefono || '-'}</td>
            <td>${cliente.compras || 0}</td>
            <td>$${(cliente.totalGastado || 0).toFixed(2)}</td>
            <td>
                <button class="btn-accion-cliente btn-ver-cliente" onclick="verHistorialCliente(${index})">Ver</button>
                <button class="btn-accion-cliente btn-editar-cliente" onclick="editarCliente(${index})">Editar</button>
                <button class="btn-accion-cliente btn-eliminar-admin" onclick="eliminarCliente(${index})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

export function abrirModalCliente(cliente = null) {
    const modal = document.getElementById('modal-cliente');
    const titulo = document.getElementById('modal-cliente-titulo');
    const cedula = document.getElementById('cliente-cedula');
    const nombre = document.getElementById('cliente-nombre');
    const telefono = document.getElementById('cliente-telefono');
    const email = document.getElementById('cliente-email');
    const direccion = document.getElementById('cliente-direccion');
    
    if (cliente) {
        titulo.textContent = 'Editar Cliente';
        cedula.value = cliente.cedula;
        cedula.disabled = true;
        nombre.value = cliente.nombre;
        telefono.value = cliente.telefono || '';
        email.value = cliente.email || '';
        direccion.value = cliente.direccion || '';
        clienteEditando = cliente;
    } else {
        titulo.textContent = 'Nuevo Cliente';
        cedula.value = '';
        cedula.disabled = false;
        nombre.value = '';
        telefono.value = '';
        email.value = '';
        direccion.value = '';
        clienteEditando = null;
    }
    // Mostrar campos de cliente por defecto
    const camposCliente = document.getElementById('campos-cliente');
    if (camposCliente) {
        camposCliente.style.display = 'block';
    }
modal.style.display = 'block';
modal.style.opacity = '1';
modal.style.visibility = 'visible';
}

export function guardarCliente() {
    const cedula = document.getElementById('cliente-cedula').value.trim();
    const nombre = document.getElementById('cliente-nombre').value.trim();
    const telefono = document.getElementById('cliente-telefono').value.trim();
    const email = document.getElementById('cliente-email').value.trim();
    const direccion = document.getElementById('cliente-direccion').value.trim();
    
    if (!cedula || !nombre) {
        alert('La cedula y el nombre son obligatorios');
        return;
    }
    
    if (!clienteEditando && clientes.some(c => c.cedula === cedula)) {
        alert('Ya existe un cliente con esta cedula');
        return;
    }
    
    if (clienteEditando) {
        const index = clientes.findIndex(c => c.cedula === clienteEditando.cedula);
        if (index !== -1) {
            clientes[index] = {
                ...clientes[index],
                nombre: nombre,
                telefono: telefono,
                email: email,
                direccion: direccion
            };
        }
        alert('Cliente actualizado correctamente');
    } else {
        clientes.push({
            cedula: cedula,
            nombre: nombre,
            telefono: telefono,
            email: email,
            direccion: direccion,
            compras: 0,
            totalGastado: 0,
            fechaRegistro: new Date().toISOString()
        });
        alert('Cliente registrado correctamente');
    }
    
    guardarClientes();
    renderizarClientes();
    document.getElementById('modal-cliente').style.display = 'none';
}

export function editarCliente(index) {
    abrirModalCliente(clientes[index]);
}

export function eliminarCliente(index) {
    if (confirm(`Eliminar al cliente "${clientes[index].nombre}"?`)) {
        clientes.splice(index, 1);
        guardarClientes();
        renderizarClientes();
        alert('Cliente eliminado');
    }
}

export function verHistorialCliente(index) {
    const cliente = clientes[index];
    const historial = JSON.parse(localStorage.getItem("supli_motors_historial")) || [];
    const compras = historial.filter(h => h.cedula === cliente.cedula);
    
    let mensaje = `HISTORIAL DE COMPRAS - ${cliente.nombre}\n`;
    mensaje += `Cedula: ${cliente.cedula}\n`;
    mensaje += `Total compras: ${cliente.compras || 0}\n`;
    mensaje += `Total gastado: $${(cliente.totalGastado || 0).toFixed(2)}\n\n`;
    
    if (compras.length === 0) {
        mensaje += 'No tiene compras registradas';
    } else {
        compras.forEach((compra, i) => {
            mensaje += `--- Compra ${i + 1} ---\n`;
            mensaje += `Fecha: ${compra.fecha || 'N/A'}\n`;
            mensaje += `Total: $${compra.total || 0}\n`;
            mensaje += `Productos: ${compra.carrito ? compra.carrito.length : 0}\n\n`;
        });
    }
    
    alert(mensaje);
}

// ============================================
// Puente para los handlers declarados en las plantillas HTML de la tabla
// (onclick="..."), que se evaluan en el ambito global y no ven los modulos.
// Al migrar esta tabla a addEventListener se puede eliminar.
// ============================================
window.verHistorialCliente = verHistorialCliente;
window.editarCliente = editarCliente;
window.eliminarCliente = eliminarCliente;

