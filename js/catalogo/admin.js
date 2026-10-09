// ============================================
// Panel de administracion: productos, categorias, marcas y Excel
// ============================================

import { cargarProductosDesdeSupabase } from "./datos.js";
import { perfilActual, productos, setProductos } from "./estado.js";
import { actualizarEstadisticasInventario, actualizarFiltroMarcas, renderizarCategorias, renderizarProductos, renderizarProductosConPaginacion } from "./render.js";
import { BrandService } from "../servicios/brand-service.js";
import { CategoryService } from "../servicios/category-service.js";
import { ProductService } from "../servicios/product-service.js";
import { sb } from "../servicios/supabase-client.js";
import { cargarClientes, renderizarClientes } from "../paginas/clientes.js";
import { llenarSelectCategoriaImportar } from "../paginas/importador-excel.js";
import { cargarMensajes } from "../paginas/mensajes.js";
import { cargarUsuarios } from "../paginas/usuarios.js";

// ============================================
// RENDERIZAR LISTA DE MARCAS (PANEL ADMIN)
// ============================================
export function renderizarListaMarcasAdmin() {
    const container = document.getElementById('lista-marcas');
    if (!container) return;
    
    const marcas = BrandService.getCache();
    container.innerHTML = '';
    
    if (marcas.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; font-size:0.875rem;">No hay marcas registradas</p>';
        return;
    }
    
    marcas.forEach(marca => {
        const div = document.createElement('div');
        div.className = 'categoria-item';
        div.innerHTML = `
            ${marca.nombre}
            <button data-id="${marca.id}" class="btn-eliminar-marca">X</button>
        `;
        container.appendChild(div);
    });
    
    // Event listeners para eliminar
    container.querySelectorAll('.btn-eliminar-marca').forEach(btn => {
        btn.addEventListener('click', () => {
            eliminarMarca(btn.dataset.id);
        });
    });
}

// ============================================
// AGREGAR MARCA
// ============================================
export async function agregarMarca() {
    const input = document.getElementById('nueva-marca-nombre');
    if (!input) return;
    
    const nombre = input.value.trim();
    
    if (!nombre) {
        alert('Ingresa el nombre de la marca');
        return;
    }
    
    const resultado = await BrandService.crear(nombre);
    
    if (!resultado.ok) {
        alert('Error al crear la marca: ' + resultado.error);
        return;
    }
    
     if (resultado.reactivada) {
        alert('Marca reactivada correctamente');
    } else if (resultado.yaExistia) {
        alert('Esa marca ya existe y está activa');
    } else {
        alert('Marca agregada correctamente');
    }
    
    
    input.value = '';
    renderizarListaMarcasAdmin();
    actualizarSelectMarcas();
}

// ============================================
// ACTUALIZAR SELECT DE CATEGORÍAS EN EL FORMULARIO
// ============================================
export function actualizarSelectCategorias() {
    const select = document.getElementById('nueva-categoria');
    if (!select) return;
    
    const categorias = CategoryService.getCache();
    const valorActual = select.value;
    
    select.innerHTML = '<option value="">Seleccionar categoria</option>';
    
    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = `${cat.icono ? cat.icono + ' ' : ''}${cat.nombre}`;
        select.appendChild(option);
    });
    
    // Restaurar valor anterior si existía
    if (valorActual && categorias.some(c => c.id === valorActual)) {
        select.value = valorActual;
    }
}

// ============================================
// ELIMINAR MARCA
// ============================================
export async function eliminarMarca(id) {
    if (!confirm('¿Eliminar esta marca? Los productos que la tengan quedarán sin marca.')) {
        return;
    }
    
    try {
        const { error } = await sb
            .from('marcas')
            .update({ activa: false })
            .eq('id', id);
        
        if (error) {
            alert('Error al eliminar: ' + error.message);
            return;
        }
        
        alert('Marca eliminada');
        
        // Recargar cache
        await BrandService.listar();
        
        renderizarListaMarcasAdmin();
        actualizarSelectMarcas();
        
    } catch (err) {
        console.error(err);
        alert('Error inesperado');
    }
}

// ============================================
// ACTUALIZAR SELECT DE MARCAS EN EL FORMULARIO
// ============================================
export function actualizarSelectMarcas() {
    const select = document.getElementById('nueva-marca');
    if (!select) return;
    
    const marcas = BrandService.getCache();
    const valorActual = select.value;
    
    select.innerHTML = '<option value="">Seleccionar marca</option>';
    
    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca.id;
        option.textContent = marca.nombre;
        select.appendChild(option);
    });
    
    // Restaurar valor anterior si existía
    if (valorActual && marcas.some(m => m.id === valorActual)) {
        select.value = valorActual;
    }
}

export async function eliminarProducto(id) {
    // ✅ Solo superusuario puede eliminar
    if (!perfilActual || perfilActual.rol !== 'superusuario') {
        alert('Solo el superusuario puede eliminar productos permanentemente.');
        return;
    }

    if (!confirm('¿ELIMINAR este producto permanentemente?\n\nEsta acción NO se puede deshacer.\n\nSi solo querés ocultarlo del catálogo, usá "Privatizar".')) {
        return;
    }

    try {
        // 1. Borrar variantes primero
        const { error: errorVariantes } = await sb
            .from('variantes_producto')
            .delete()
            .eq('producto_id', id);

        if (errorVariantes) {
            console.warn('Error al borrar variantes:', errorVariantes);
        }

        // 2. Borrar el producto
        const { error } = await sb
            .from('productos')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Error al eliminar: ' + error.message);
            return;
        }

        // 3. Remover del array local
        setProductos(productos.filter(p => p.id !== id));

        // 4. Re-renderizar
        renderizarProductosConPaginacion();
        actualizarEstadisticasInventario();
        actualizarFiltroMarcas();

        alert('Producto eliminado permanentemente.');

    } catch (err) {
        console.error('Error al eliminar:', err);
        alert('Error inesperado al eliminar');
    }
}

export async function eliminarCategoria(id) {
    if (!confirm('¿Eliminar esta categoría? Los productos que la tengan quedarán sin categoría.')) {
        return;
    }
    
    try {
        const { error } = await sb
            .from('categorias')
            .update({ activa: false })
            .eq('id', id);
        
        if (error) {
            alert('Error al eliminar: ' + error.message);
            return;
        }
        
        alert('Categoría eliminada');
        
        // Recargar cache
        await CategoryService.listar();
        
        // Actualizar TODO
        renderizarListaCategoriasAdmin();
        actualizarSelectCategorias();
        llenarSelectCategoriaImportar();
        renderizarCategorias();
        
    } catch (err) {
        console.error(err);
        alert('Error inesperado');
    }
}

// ============================================
// ACTIVAR UNA PESTANA DEL PANEL DE ADMINISTRACION
// Se usa tanto al hacer clic en una pestana como desde el boton
// "Importar desde Excel" de la pestana de inventario.
// ============================================
export function activarPestanaAdmin(tabId) {
    document.querySelectorAll('.admin-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const panel = document.getElementById(`tab-${tabId}`);
    if (!panel) return;
    panel.classList.add('active');

    // Cargar datos al abrir la pestana
    if (tabId === 'mensajes') {
        cargarMensajes();
    }
    if (tabId === 'usuarios') {
        cargarUsuarios();
    }
    if (tabId === 'clientes') {
        // Ojo: pasar la funcion directo a .then haria que reciba la respuesta
        // como primer argumento, y se usaria como filtro de busqueda.
        cargarClientes().then(() => renderizarClientes());
    }
}

export function inicializarAdmin() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            activarPestanaAdmin(tab.dataset.tab);
        });
    });
    
    const btnAdmin = document.getElementById("btn-modo-admin");
    const panelAdmin = document.getElementById("panel-admin");
    if (btnAdmin && panelAdmin) {
        btnAdmin.onclick = function() {
            const isVisible = panelAdmin.style.display === "block";
            panelAdmin.style.display = isVisible ? "none" : "block";
            this.innerHTML = isVisible ? "Modo Admin" : "Salir Admin";
            if (!isVisible) {
                actualizarEstadisticasInventario();
                renderizarListaCategoriasAdmin();
                renderizarListaMarcasAdmin();
                actualizarSelectCategorias();
                actualizarSelectMarcas();
                cargarMensajes();
            }
            renderizarProductos();
        };
    }
    
    const btnAgregar = document.getElementById("btn-agregar-producto");
if (btnAgregar) {
    btnAgregar.onclick = async function() {
        const nombre = document.getElementById("nuevo-nombre").value.trim();
        const precio = parseFloat(document.getElementById("nuevo-precio").value);
        const codigo = document.getElementById("nuevo-codigo").value.trim();
        const categoria_id = document.getElementById("nueva-categoria").value;
        const marca_id = document.getElementById("nueva-marca").value;
        const stock = parseInt(document.getElementById("nuevo-stock").value) || 1;
        const descripcion = document.getElementById("nueva-descripcion").value.trim();
        const file = document.getElementById("nueva-imagen").files[0];
        
        // Validaciones
        if (!nombre || !codigo || isNaN(precio) || !categoria_id) {
            alert("Por favor completa: nombre, precio, código y categoría");
            return;
        }
        
        // Deshabilitar botón mientras se procesa
        btnAgregar.disabled = true;
        btnAgregar.textContent = "Guardando...";
        
        try {
            // Llamar al ProductService
            const resultado = await ProductService.crear({
                codigo: codigo,
                nombre: nombre,
                precio: precio,
                categoria_id: categoria_id,
                marca_id: marca_id || null,
                stock: stock,
                descripcion: descripcion
            }, file);
            
            if (!resultado.ok) {
                alert("Error al crear producto: " + resultado.error);
                return;
            }
            
            alert("Producto agregado correctamente");
            
            // Limpiar formulario
            limpiarFormularioAdmin();
            
            // Recargar productos desde Supabase
            await cargarProductosDesdeSupabase();
            
            // Re-renderizar
            renderizarProductosConPaginacion();
            actualizarEstadisticasInventario();
            
        } catch (err) {
            console.error("Error inesperado:", err);
            alert("Error inesperado al crear producto");
        } finally {
            btnAgregar.disabled = false;
            btnAgregar.textContent = "Agregar al Catálogo";
        }
    };
}
    
    const btnAgregarCategoria = document.getElementById("btn-agregar-categoria");
if (btnAgregarCategoria) {
    btnAgregarCategoria.onclick = async () => {
        const nombre = document.getElementById("nueva-categoria-nombre").value.trim();
        
        if (!nombre) {
            alert("Ingresa el nombre de la categoría");
            return;
        }
        
        // Guardar en Supabase
        const resultado = await CategoryService.crear(nombre, "");
        
        if (!resultado.ok) {
            alert("Error al crear categoría: " + resultado.error);
            return;
        }
        
        if (resultado.yaExistia) {
            alert("Esa categoría ya existe y está activa");
        } else if (resultado.reactivada) {
            alert("Categoría reactivada correctamente");
        } else {
            alert("Categoría agregada correctamente");
        }
        
        document.getElementById("nueva-categoria-nombre").value = '';
        
        // Actualizar TODO (lista + selects + catálogo público)
        renderizarListaCategoriasAdmin();
        renderizarCategorias();
        actualizarSelectCategorias();
        llenarSelectCategoriaImportar();
    };
}

        // Event listener para agregar marca
    const btnAgregarMarca = document.getElementById("btn-agregar-marca");
    if (btnAgregarMarca) {
        btnAgregarMarca.onclick = agregarMarca;
    }
}

export function limpiarFormularioAdmin() {
    document.getElementById("nuevo-nombre").value = '';
    document.getElementById("nuevo-precio").value = '';
    document.getElementById("nuevo-codigo").value = '';
    document.getElementById("nueva-categoria").value = '';
    document.getElementById("nueva-marca").value = '';
    document.getElementById("nuevo-stock").value = '10';
    document.getElementById("nueva-descripcion").value = '';
    document.getElementById("nueva-imagen").value = '';
}

export function exportarInventarioExcel() {
    if (productos.length === 0) {
        alert("No hay productos para exportar");
        return;
    }

    const datosExcel = productos.map(p => ({
        'Codigo': p.codigo || '',
        'Nombre': p.nombre || '',
        'Precio': p.precio || 0,
        'Categoria': p.categoria || '',
        'Marca': p.marca || '',
        'Stock': p.stock || 0,
        'Descripcion': p.descripcion || '',
        'ID': p.id || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datosExcel);

    const colWidths = [
        { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 20 },
        { wch: 15 }, { wch: 10 }, { wch: 40 }, { wch: 20 }
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

    const nombreArchivo = `inventario_supli_motors_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
    
    alert("Inventario exportado correctamente a Excel");
}

export function inicializarExcel() {
    const btnExportar = document.getElementById('btn-exportar-excel');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarInventarioExcel);
    }

    // El boton "Importar desde Excel" lleva a la pestana del importador real,
    // que escribe en Supabase. Antes abria un importador heredado que solo
    // tocaba el localStorage del navegador y se perdia al recargar.
    const btnImportar = document.getElementById('btn-importar-excel');
    if (btnImportar) {
        btnImportar.addEventListener('click', () => activarPestanaAdmin('importar'));
    }
}

// Renderizar lista de categorías en el panel admin
export function renderizarListaCategoriasAdmin() {
    const container = document.getElementById('lista-categorias');
    if (!container) return;

    const categoriasSupabase = CategoryService.getCache();
    container.innerHTML = '';

    if (categoriasSupabase.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; font-size:0.875rem;">No hay categorías registradas</p>';
        return;
    }

    categoriasSupabase.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'categoria-item';
        div.innerHTML = `
            ${cat.nombre}
            <button data-id="${cat.id}" class="btn-eliminar-categoria">X</button>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll('.btn-eliminar-categoria').forEach(btn => {
        btn.addEventListener('click', () => {
            eliminarCategoria(btn.dataset.id);
        });
    });
}

// PRIVATIZAR PRODUCTO (ocultar del catálogo público)
// ============================================
export async function privatizarProducto(id) {
    if (!confirm('¿Ocultar este producto del catálogo público?\n\nLos clientes no lo verán. Podés volver a mostrarlo desde el panel admin.')) {
        return;
    }

    try {
        // 1. Actualizar en Supabase: activo = false
        const { error } = await sb
            .from('productos')
            .update({ activo: false })
            .eq('id', id);

        if (error) {
            alert('Error al privatizar: ' + error.message);
            return;
        }

        // 2. Remover del array local para que desaparezca visualmente
        setProductos(productos.filter(p => p.id !== id));

        // 3. Re-renderizar
        renderizarProductosConPaginacion();
        actualizarEstadisticasInventario();

        alert('Producto ocultado del catálogo.');

    } catch (err) {
        console.error('Error al privatizar:', err);
        alert('Error inesperado al privatizar');
    }
}

