// ============================================
// Importador de Excel: lectura, previsualizacion y volcado a Supabase
// ============================================
import { BrandService } from "../servicios/brand-service.js";
import { CategoryService } from "../servicios/category-service.js";
import { ExcelImportService } from "../servicios/excel-import-service.js";
import { actualizarEstadisticasInventario, renderizarProductosConPaginacion } from "../catalogo/render.js";
import { actualizarSelectCategorias, actualizarSelectMarcas, renderizarListaCategoriasAdmin, renderizarListaMarcasAdmin } from "../catalogo/admin.js";
import { cargarProductosDesdeSupabase } from "../catalogo/datos.js";

// Botón "+" para crear marca nueva
export async function crearMarcaDesdeImportador() {
    const nombre = prompt("Nombre de la nueva marca:");
    if (!nombre || !nombre.trim()) return;
    
    const resultado = await BrandService.crear(nombre.trim());
    
    if (!resultado.ok) {
        alert("Error al crear marca: " + resultado.error);
        return;
    }
    
    if (resultado.yaExistia) {
        alert("Esa marca ya existía y fue seleccionada");
    } else if (resultado.reactivada) {
        alert("Marca reactivada y seleccionada");
    } else {
        alert("Marca creada correctamente");
    }
    
    // Recargar lista de marcas en el admin
    renderizarListaMarcasAdmin();
    actualizarSelectMarcas();
    
    // Recargar select del importador y seleccionar la nueva
    llenarSelectMarcaImportar();
    const select = document.getElementById('importar-marca');
    if (select && resultado.data) {
        select.value = resultado.data.id;
    }
}

// Botón "+" para crear categoría nueva
export async function crearCategoriaDesdeImportador() {
    const nombre = prompt("Nombre de la nueva categoría:");
    if (!nombre || !nombre.trim()) return;
    
    const resultado = await CategoryService.crear(nombre.trim());
    
    if (!resultado.ok) {
        alert("Error al crear categoría: " + resultado.error);
        return;
    }
    
    if (resultado.yaExistia) {
        alert("Esa categoría ya existía y fue seleccionada");
    } else {
        alert("Categoría creada correctamente");
    }
    
    // Recargar lista de categorías en el admin
    renderizarListaCategoriasAdmin();
    actualizarSelectCategorias();
    
    // Recargar select del importador y seleccionar la nueva
    llenarSelectCategoriaImportar();
    const select = document.getElementById('importar-categoria');
    if (select && resultado.data) {
        select.value = resultado.data.id;
    }
}

// Procesar el Excel subido
export async function procesarExcel() {
    const marcaId = document.getElementById('importar-marca').value;
    const categoriaId = document.getElementById('importar-categoria').value;
    const archivoInput = document.getElementById('importar-archivo');
    const archivo = archivoInput.files[0];

    if (!archivo) {
        alert("Selecciona un archivo Excel");
        return;
    }

    const btn = document.getElementById('btn-procesar-excel');
    btn.disabled = true;
    btn.textContent = "Procesando...";

    try {
        const resultado = await ExcelImportService.leerExcel(archivo);

        if (!resultado.ok) {
            alert("Error: " + resultado.error);
            return;
        }

        ExcelImportService.guardarDetectados(resultado.hojas);
        mostrarPasoImportar(2);
        renderizarResumenHojas(resultado.hojas);
        renderizarTablaImportar(resultado.hojas);

        // Actualizar info
        const marcaNombre = marcaId
            ? (BrandService.getCache().find(m => m.id === marcaId)?.nombre || "?")
            : "(del Excel)";
        const catNombre = categoriaId
            ? (CategoryService.getCache().find(c => c.id === categoriaId)?.nombre || "?")
            : "(del Excel)";

        document.getElementById('importar-info').textContent =
            `Se detectaron ${resultado.total} productos en ${resultado.hojas.length} hojas. Marca: ${marcaNombre} | Categoría: ${catNombre}`;

    } catch (err) {
        console.error("Error al procesar Excel:", err);
        alert("Error inesperado al procesar el Excel");
    } finally {
        btn.disabled = false;
        btn.textContent = "Procesar Excel";
    }
}

// Renderizar resumen de hojas (arriba de la tabla)
export function renderizarResumenHojas(hojas) {
    const info = document.getElementById('importar-info');
    if (!info) return;

    let html = '<div class="resumen-hojas">';
    hojas.forEach(hoja => {
        const clase = 'resumen-hoja-' + hoja.estado;
        html += `<span class="resumen-hoja ${clase}">${hoja.nombre}: ${hoja.total}</span>`;
    });
    html += '</div>';

    info.innerHTML = html;
}

export function renderizarTablaImportar(hojas) {
    const tbody = document.getElementById('cuerpo-importar');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Categorías disponibles para el datalist
    const categoriasDisponibles = CategoryService.getCache();
    const listaCategorias = categoriasDisponibles.map(c =>
        `<option value="${c.nombre}"></option>`
    ).join('');

    const datalistId = 'lista-categorias-importar';
    let datalist = document.getElementById(datalistId);
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = datalistId;
        datalist.innerHTML = listaCategorias;
        document.body.appendChild(datalist);
    } else {
        datalist.innerHTML = listaCategorias;
    }

    // Recorrer todas las hojas
    hojas.forEach((hoja) => {
        // Fila de encabezado de hoja
        const trHoja = document.createElement('tr');
        trHoja.className = 'fila-hoja-titulo';
        trHoja.innerHTML = `
            <td colspan="8" class="hoja-titulo">
                <strong>${hoja.nombre}</strong> (${hoja.total} productos)
                <span class="badge-estado badge-${hoja.estado}">${hoja.estado}</span>
            </td>
        `;
        tbody.appendChild(trHoja);

        // Productos de la hoja
        hoja.productos.forEach((p, indexHoja) => {
            const tr = document.createElement('tr');
            tr.className = p.estado === 'ok' ? '' : 'estado-' + p.estado;

            tr.innerHTML = `
                <td>${indexHoja + 1}</td>
                <td>
                    <input type="text" value="${p.codigo}" data-hoja="${hoja.nombre}" data-index="${indexHoja}" data-campo="codigo">
                </td>
                <td>
                    <input type="text" value="${p.nombre.replace(/"/g, '&quot;')}" data-hoja="${hoja.nombre}" data-index="${indexHoja}" data-campo="nombre">
                </td>
                <td>
                    <input type="number" step="0.01" value="${p.precio}" data-hoja="${hoja.nombre}" data-index="${indexHoja}" data-campo="precio">
                </td>
                <td>
                    <input type="number" value="${p.cantidad}" data-hoja="${hoja.nombre}" data-index="${indexHoja}" data-campo="cantidad">
                </td>
                <td>
                    <input 
                        type="text" 
                        value="${(p.categoria || '').replace(/"/g, '&quot;')}" 
                        data-hoja="${hoja.nombre}" 
                        data-index="${indexHoja}" 
                        data-campo="categoria"
                        list="${datalistId}"
                        placeholder="Categoría"
                    >
                </td>
                <td>
                    <span class="estado-badge estado-${p.estado}">
                        ${p.estado === 'ok' ? 'OK' : 'Revisar'}
                    </span>
                </td>
                <td>
                    <button class="btn-eliminar-fila" data-hoja="${hoja.nombre}" data-index="${indexHoja}">Eliminar</button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    });

    // Event listeners para editar campos
    tbody.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', (e) => {
            const hojaNombre = e.target.dataset.hoja;
            const indexHoja = parseInt(e.target.dataset.index);
            const campo = e.target.dataset.campo;

            // Buscar la hoja correcta
            const hoja = ExcelImportService.obtenerDetectados().find(h => h.nombre === hojaNombre);
            if (!hoja) return;

            const valor = campo === 'precio' ? parseFloat(e.target.value) || 0
                        : campo === 'cantidad' ? parseInt(e.target.value) || 0
                        : e.target.value.trim();

            hoja.productos[indexHoja][campo] = valor;

            // Revalidar
            const p = hoja.productos[indexHoja];
            p.problemas = [];
            if (!p.codigo) p.problemas.push("Sin código");
            if (!p.nombre) p.problemas.push("Sin nombre");
            if (p.precio <= 0) p.problemas.push("Precio inválido");

            const categoriaFallback = document.getElementById('importar-categoria')?.value;
            if ((!p.categoria || p.categoria === 'Otros') && !categoriaFallback) {
                p.problemas.push("Sin categoría");
            }

            p.estado = p.problemas.length === 0 ? "ok" : "revisar";

            const tr = e.target.closest('tr');
            tr.className = p.estado === 'ok' ? '' : 'estado-' + p.estado;
            tr.querySelector('.estado-badge').className = 'estado-badge estado-' + p.estado;
            tr.querySelector('.estado-badge').textContent = p.estado === 'ok' ? 'OK' : 'Revisar';
        });
    });

    // Event listeners para eliminar
    tbody.querySelectorAll('.btn-eliminar-fila').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const hojaNombre = e.target.dataset.hoja;
            const indexHoja = parseInt(e.target.dataset.index);
            eliminarFilaImportar(hojaNombre, indexHoja);
        });
    });
}

// Eliminar una fila de la tabla
export function eliminarFilaImportar(hojaNombre, indexHoja) {
    const hojas = ExcelImportService.obtenerDetectados();
    const hoja = hojas.find(h => h.nombre === hojaNombre);
    if (!hoja) return;

    hoja.productos.splice(indexHoja, 1);
    hoja.total = hoja.productos.length;

    renderizarTablaImportar(hojas);

    // Actualizar info
    const totalProductos = ExcelImportService.obtenerTodosLosProductos().length;
    document.getElementById('importar-info').textContent = 
        `${totalProductos} productos por importar`;
}

// Confirmar importación
export async function confirmarImportacion() {
    const marcaId = document.getElementById('importar-marca').value;
    const categoriaId = document.getElementById('importar-categoria').value;
    const inputImagen = document.getElementById('importar-imagen');
    const archivoImagen = inputImagen ? inputImagen.files[0] : null;

    const totalProductos = ExcelImportService.obtenerTodosLosProductos().length;

    if (!confirm(`¿Importar ${totalProductos} productos a Supabase?`)) return;

    const btn = document.getElementById('btn-confirmar-importar');
    btn.disabled = true;
    btn.textContent = "Preparando...";

    try {
        // 1. Subir imagen común
        let imagenUrl = null;
        if (archivoImagen) {
            btn.textContent = "Subiendo imagen...";
            const subidaImagen = await ExcelImportService.subirImagenComun(
                archivoImagen,
                "import-" + Date.now()
            );

            if (subidaImagen.ok) {
                imagenUrl = subidaImagen.url;
            } else {
                alert("No se pudo subir la imagen: " + subidaImagen.error + "\nLos productos se importarán sin imagen.");
            }
        }

        // 2. Importar
        btn.textContent = "Importando...";
        const resultado = await ExcelImportService.importarATodos(
            marcaId,
            categoriaId,
            imagenUrl,
            (progreso) => {
                btn.textContent = `Importando ${progreso.actual}/${progreso.total}...`;
            }
        );

        mostrarPasoImportar(3);
        renderizarResultadoImportar(resultado);

        await cargarProductosDesdeSupabase();
        renderizarProductosConPaginacion();
        actualizarEstadisticasInventario();

    } catch (err) {
        console.error("Error al importar:", err);
        alert("Error inesperado al importar");
    } finally {
        btn.disabled = false;
        btn.textContent = "Importar a Supabase";
    }
}

// Inicializar el importador (conectar botones)
export function inicializarImportador() {
    // Botón "+" marca
    const btnNuevaMarca = document.getElementById('btn-nueva-marca-importar');
    if (btnNuevaMarca) {
        btnNuevaMarca.onclick = crearMarcaDesdeImportador;
    }
    
    // Botón "+" categoría
    const btnNuevaCategoria = document.getElementById('btn-nueva-categoria-importar');
    if (btnNuevaCategoria) {
        btnNuevaCategoria.onclick = crearCategoriaDesdeImportador;
    }
    
    // Botón procesar Excel
    const btnProcesar = document.getElementById('btn-procesar-excel');
    if (btnProcesar) {
        btnProcesar.onclick = procesarExcel;
    }
    
    // Botón confirmar importación
    const btnConfirmar = document.getElementById('btn-confirmar-importar');
    if (btnConfirmar) {
        btnConfirmar.onclick = confirmarImportacion;
    }
    
    // Botón cancelar
    const btnCancelar = document.getElementById('btn-cancelar-importar');
    if (btnCancelar) {
        btnCancelar.onclick = volverAlPaso1;
    }
    
    // Botón volver (paso 3)
    const btnVolver = document.getElementById('btn-volver-importar');
    if (btnVolver) {
        btnVolver.onclick = volverAlPaso1;
    }
}

// Llenar el select de marcas del importador
export function llenarSelectMarcaImportar() {
    const select = document.getElementById('importar-marca');
    if (!select) return;
    
    const marcas = BrandService.getCache();
    select.innerHTML = '<option value="">Seleccionar marca</option>';
    
    marcas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca.id;
        option.textContent = marca.nombre;
        select.appendChild(option);
    });
}

// Llenar el select de categorías del importador
export function llenarSelectCategoriaImportar() {
    const select = document.getElementById('importar-categoria');
    if (!select) return;
    
    const categorias = CategoryService.getCache();
    select.innerHTML = '<option value="">Seleccionar categoría</option>';
    
    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
}

// Mostrar un paso del importador
export function mostrarPasoImportar(numero) {
    const paso1 = document.getElementById('importar-paso-1');
    const paso2 = document.getElementById('importar-paso-2');
    const paso3 = document.getElementById('importar-paso-3');

    if (paso1) paso1.style.display = numero === 1 ? 'block' : 'none';
    if (paso2) paso2.style.display = numero === 2 ? 'block' : 'none';
    if (paso3) paso3.style.display = numero === 3 ? 'block' : 'none';
}

// Volver al paso 1 del importador
export function volverAlPaso1() {
    mostrarPasoImportar(1);
    const inputArchivo = document.getElementById('importar-archivo');
    if (inputArchivo) inputArchivo.value = '';
    const info = document.getElementById('importar-info');
    if (info) info.textContent = '';
}

// Renderizar resultado de la importación
export function renderizarResultadoImportar(resultado) {
    const container = document.getElementById('importar-resultado');
    if (!container) return;

    let html = `
        <div class="resultado-item">
            <span>Productos importados exitosamente:</span>
            <span class="resultado-exito">${resultado.exitosos}</span>
        </div>
        <div class="resultado-item">
            <span>Productos actualizados:</span>
            <span class="resultado-exito">${resultado.actualizados || 0}</span>
        </div>
        <div class="resultado-item">
            <span>Productos con errores:</span>
            <span class="resultado-error">${resultado.fallidos}</span>
        </div>
    `;

    if (resultado.errores && resultado.errores.length > 0) {
        html += `<div style="margin-top:16px;">
            <strong style="color:#dc2626;">Errores:</strong>
            <ul style="margin-top:8px; padding-left:20px; font-size:0.8rem; color:#64748b;">
        `;
        resultado.errores.slice(0, 10).forEach(err => {
            html += `<li>${err}</li>`;
        });
        if (resultado.errores.length > 10) {
            html += `<li>... y ${resultado.errores.length - 10} errores más</li>`;
        }
        html += `</ul></div>`;
    }

    container.innerHTML = html;
}
