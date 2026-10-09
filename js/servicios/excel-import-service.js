// ============================================
// Importacion de Excel: lectura, deteccion de columnas y volcado
// ============================================

import { sb } from "./supabase-client.js";
import { BrandService } from "./brand-service.js";
import { CategoryService } from "./category-service.js";
import { ProductService } from "./product-service.js";

// ============================================
// EXCEL IMPORT SERVICE v2.0
// - Con soporte para Marca y Categoria
// - Crea marcas/categorías automáticamente
// - UPSERT por código
// ============================================

export const ExcelImportService = {

    _productosDetectados: [],

   // ============================================
// LEER EXCEL Y EXTRAER PRODUCTOS (TODAS LAS HOJAS)
// ============================================
async leerExcel(archivo) {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });

                const hojas = [];
                let totalProductos = 0;

                // Mapeo de nombre de hoja -> estado
                const mapaEstados = {
                    'Productos': 'activo',
                    'Agotados': 'agotado',
                    'Negativos': 'negativo',
                    'INHABILITADOS': 'inhabilitado'
                };

                workbook.SheetNames.forEach((nombreHoja) => {
                    const sheet = workbook.Sheets[nombreHoja];
                    const filas = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    if (filas.length < 2) return;

                    // Detectar columnas
                    const encabezados = filas[0];
                    const columnas = this._detectarColumnas(encabezados);

                    if (columnas.codigo === null || columnas.nombre === null || columnas.precio === null) {
                        console.warn(`Hoja "${nombreHoja}" no tiene las columnas requeridas. Ignorando.`);
                        return;
                    }

                    // Detectar estado de la hoja
                    const estadoHoja = mapaEstados[nombreHoja] || 'activo';

                    // Procesar filas
                    const productos = [];
                    for (let i = 1; i < filas.length; i++) {
                        const fila = filas[i];
                        if (!fila || fila.length === 0) continue;

                        const codigo = columnas.codigo !== null ? String(fila[columnas.codigo] || "").trim() : "";
                        const nombre = columnas.nombre !== null ? String(fila[columnas.nombre] || "").trim() : "";
                        const precioRaw = columnas.precio !== null ? fila[columnas.precio] : null;
                        const precio = parseFloat(precioRaw) || 0;
                        const cantidadRaw = columnas.cantidad !== null ? fila[columnas.cantidad] : null;
                        const cantidad = parseInt(cantidadRaw) || 0;
                        const marca = columnas.marca !== null ? String(fila[columnas.marca] || "").trim() : "Sin marca";
                        const categoria = columnas.categoria !== null ? String(fila[columnas.categoria] || "").trim() : "Otros";

                        if (!codigo && !nombre) continue;

                        const problemas = [];
                        if (!codigo) problemas.push("Sin código");
                        if (!nombre) problemas.push("Sin nombre");
                        if (precio <= 0) problemas.push("Precio inválido");

                        productos.push({
                            fila: i + 1,
                            hoja: nombreHoja,
                            estadoHoja: estadoHoja,
                            codigo: codigo,
                            nombre: nombre,
                            precio: precio,
                            cantidad: cantidad,
                            marca: marca || "Sin marca",
                            categoria: categoria || "Otros",
                            problemas: problemas,
                            estado: problemas.length === 0 ? "ok" : "revisar"
                        });
                    }

                    if (productos.length === 0) return;

                    hojas.push({
                        nombre: nombreHoja,
                        estado: estadoHoja,
                        productos: productos,
                        total: productos.length
                    });

                    totalProductos += productos.length;
                });

                if (hojas.length === 0) {
                    resolve({ ok: false, error: "No se encontraron productos en ninguna hoja del Excel" });
                    return;
                }

                resolve({
                    ok: true,
                    hojas: hojas,
                    total: totalProductos
                });

            } catch (err) {
                console.error("Error al leer Excel:", err);
                resolve({ ok: false, error: "Error al leer el archivo: " + err.message });
            }
        };

        reader.onerror = () => resolve({ ok: false, error: "Error al leer el archivo" });
        reader.readAsArrayBuffer(archivo);
    });
},

    // ============================================
    // DETECTAR COLUMNAS
    // Puntua cada encabezado segun lo especifico que sea para cada campo, de modo
    // que "Codigo" gane a "Codigo de barras". Antes se usaba una cadena de
    // else-if y ganaba la ultima columna que coincidiera, que solia ser la
    // equivocada.
    // ============================================
_detectarColumnas(encabezados) {
    const resultado = { codigo: null, nombre: null, precio: null, cantidad: null, marca: null, categoria: null };
    if (!Array.isArray(encabezados)) return resultado;

    const campos = {
        codigo: ["codigo", "código", "cod", "sku"],
        cantidad: ["cantidad", "stock", "qty"],
        marca: ["marca"],
        categoria: ["categoria", "categoría"],
        precio: ["precio", "pvp"],
        nombre: ["nombre", "descrip", "producto", "detalle"]
    };

    // Coincidencia exacta = 3, empieza por = 2, contiene = 1
    const puntuar = (encabezado, claves) => {
        let mejor = 0;
        for (const clave of claves) {
            if (encabezado === clave) mejor = Math.max(mejor, 3);
            else if (encabezado.startsWith(clave)) mejor = Math.max(mejor, 2);
            else if (encabezado.includes(clave)) mejor = Math.max(mejor, 1);
        }
        return mejor;
    };

    // Una misma columna no puede asignarse a dos campos
    const usadas = new Set();

    for (const [campo, claves] of Object.entries(campos)) {
        let mejorPuntaje = 0;
        let mejorIndice = null;

        encabezados.forEach((enc, indice) => {
            if (!enc || usadas.has(indice)) return;
            const texto = String(enc).toLowerCase().trim();
            if (!texto) return;

            const puntaje = puntuar(texto, claves);
            // A igual puntaje se queda con la columna mas a la izquierda
            if (puntaje > mejorPuntaje) {
                mejorPuntaje = puntaje;
                mejorIndice = indice;
            }
        });

        if (mejorIndice !== null) {
            resultado[campo] = mejorIndice;
            usadas.add(mejorIndice);
        }
    }

    return resultado;
},

_hojasDetectadas: [],

guardarDetectados(hojas) { this._hojasDetectadas = hojas; },
obtenerDetectados() { return this._hojasDetectadas; },

// Helper: devuelve todos los productos planos (con hoja y estadoHoja)
obtenerTodosLosProductos() {
    const todos = [];
    this._hojasDetectadas.forEach(hoja => {
        hoja.productos.forEach(p => todos.push(p));
    });
    return todos;
},

    // ============================================
    // SUBIR IMAGEN A STORAGE
    // ============================================
    async subirImagenComun(archivo, nombreReferencia = "import") {
        try {
            if (!archivo.type.startsWith("image/")) {
                return { ok: false, error: "El archivo debe ser una imagen" };
            }
            if (archivo.size > 2 * 1024 * 1024) {
                return { ok: false, error: "La imagen no puede pesar más de 2 MB" };
            }
            
            const extension = archivo.name.split(".").pop().toLowerCase();
            const timestamp = Date.now();
            const nombreArchivo = `${nombreReferencia}-${timestamp}.${extension}`;
            
            const { data, error } = await sb.storage
                .from("productos")
                .upload(nombreArchivo, archivo, { cacheControl: "3600", upsert: false });
            
            if (error) {
                console.error("Error al subir imagen:", error);
                return { ok: false, error: error.message };
            }
            
            const { data: urlData } = sb.storage
                .from("productos")
                .getPublicUrl(data.path);
            
            return { ok: true, url: urlData.publicUrl };
            
        } catch (err) {
            console.error("Error inesperado al subir imagen:", err);
            return { ok: false, error: err.message };
        }
    },

    // ============================================
    // OBTENER O CREAR MARCA
    // Delega en BrandService, que ademas reactiva una marca que estuviera dada
    // de baja. Antes se insertaba directamente y, si la marca existia inactiva,
    // se intentaba crear un duplicado (violando el indice unico).
    // ============================================
async _obtenerOCrearMarca(nombre) {
    const nombreLimpio = !nombre || !String(nombre).trim() ? "Sin marca" : String(nombre).trim();

    const resultado = await BrandService.obtenerOCrear(nombreLimpio);

    if (!resultado.ok || !resultado.data) {
        console.warn("No se pudo obtener ni crear la marca:", nombreLimpio, resultado.error);
        return null;
    }

    return resultado.data.id;
},
    // ============================================
    // OBTENER O CREAR CATEGORÍA
    // Igual que las marcas: usa CategoryService, que reactiva la categoria si
    // estaba dada de baja.
    // ============================================
async _obtenerOCrearCategoria(nombre) {
    const limpio = String(nombre || "").trim();
    const nombreLimpio = !limpio || limpio === "Otros" ? "Sin categoría" : limpio;

    const resultado = await CategoryService.obtenerOCrear(nombreLimpio);

    if (!resultado.ok || !resultado.data) {
        console.warn("No se pudo obtener ni crear la categoría:", nombreLimpio, resultado.error);
        return null;
    }

    return resultado.data.id;
},

    // ============================================
    // IMPORTAR TODOS (con UPSERT + marcas/categorías)
    // ============================================
async importarATodos(marcaIdFallback = null, categoriaIdFallback = null, imagenUrl = null, onProgress = null) {
    const resultados = {
        exitosos: 0,
        actualizados: 0,
        fallidos: 0,
        errores: []
    };

    const cacheMarcas = {};
    const cacheCategorias = {};

    // Obtener todos los productos de todas las hojas
    const todosLosProductos = this.obtenerTodosLosProductos();
    const total = todosLosProductos.length;

    for (let i = 0; i < todosLosProductos.length; i++) {
        const p = todosLosProductos[i];

        if (typeof onProgress === 'function') {
            onProgress({
                actual: i + 1,
                total: total,
                producto: p
            });
        }

        try {
            // Validar datos completos
            if (!p.codigo || !p.nombre || p.precio <= 0) {
                const faltantes = [];
                if (!p.codigo) faltantes.push("código");
                if (!p.nombre) faltantes.push("nombre");
                if (p.precio <= 0) faltantes.push("precio");
                
                resultados.fallidos++;
                resultados.errores.push(`Hoja "${p.hoja}" Fila ${p.fila}: Falta ${faltantes.join(", ")}`);
                continue;
            }

            // 1. Obtener/crear MARCA
            let marcaId = marcaIdFallback;
            if (p.marca && p.marca !== "Sin marca") {
                if (cacheMarcas[p.marca]) {
                    marcaId = cacheMarcas[p.marca];
                } else {
                    const nuevoId = await this._obtenerOCrearMarca(p.marca);
                    if (nuevoId) {
                        cacheMarcas[p.marca] = nuevoId;
                        marcaId = nuevoId;
                    }
                }
            }

            // 2. Obtener/crear CATEGORÍA
            let categoriaId = categoriaIdFallback;
            if (p.categoria && p.categoria !== "Otros") {
                if (cacheCategorias[p.categoria]) {
                    categoriaId = cacheCategorias[p.categoria];
                } else {
                    const nuevoId = await this._obtenerOCrearCategoria(p.categoria);
                    if (nuevoId) {
                        cacheCategorias[p.categoria] = nuevoId;
                        categoriaId = nuevoId;
                    }
                }
            }

            // Si no hay categoría, crear/asignar "Sin categoría"
            if (!categoriaId) {
                const idSinCat = await this._obtenerOCrearCategoria("Sin categoría");
                if (idSinCat) {
                    categoriaId = idSinCat;
                } else {
                    resultados.fallidos++;
                    resultados.errores.push(`Hoja "${p.hoja}" Fila ${p.fila} (${p.codigo}): Sin categoría válida`);
                    continue;
                }
            }

            // 3. Determinar si el producto va a estar activo
            const activo = p.estadoHoja === 'activo';

            // 4. Crear/actualizar el producto
            const resultado = await ProductService.crear({
                codigo: p.codigo,
                nombre: p.nombre,
                precio: p.precio,
                categoria_id: categoriaId,
                marca_id: marcaId,
                stock: p.cantidad,
                descripcion: "",
                imagen_url: imagenUrl,
                activo: activo
            }, null);

            if (resultado.ok) {
                if (resultado.actualizado) {
                    resultados.actualizados++;
                } else {
                    resultados.exitosos++;
                }
            } else {
                resultados.fallidos++;
                resultados.errores.push(`Hoja "${p.hoja}" Fila ${p.fila} (${p.codigo}): ${resultado.error}`);
            }

        } catch (err) {
            resultados.fallidos++;
            resultados.errores.push(`Hoja "${p.hoja}" Fila ${p.fila} (${p.codigo}): ${err.message}`);
        }
    }

    return resultados;
}

};
