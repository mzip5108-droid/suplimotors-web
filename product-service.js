// ============================================
// PRODUCT SERVICE - Manejo de productos en Supabase
// ============================================

const ProductService = {

    // LISTAR PRODUCTOS (con categoría y marca) — CON PAGINACIÓN
    async listar(soloActivos = true) {
        try {
            const PASO = 1000;
            let desde = 0;
            let todos = [];

            while (true) {
                let query = window.sb
                    .from("productos")
                    .select(`
                        id,
                        codigo,
                        nombre,
                        descripcion,
                        precio_base,
                        imagen_url,
                        activo,
                        destacado,
                        descuento,
                        created_at,
                        categoria_id,
                        marca_id,
                        categorias:categoria_id (id, nombre, icono),
                        marcas:marca_id (id, nombre),
                        variantes_producto (id, sku, atributos, precio, stock, stock_minimo, activo)
                    `)
                    .range(desde, desde + PASO - 1)
                    .order("created_at", { ascending: false })
                    .order("id", { ascending: false });

                if (soloActivos) {
                    query = query.eq("activo", true);
                }

                const { data, error } = await query;

                if (error) {
                    console.error("Error al listar productos:", error);
                    return { ok: false, error: error.message, data: [] };
                }

                if (!data || data.length === 0) break;

                todos = todos.concat(data);
                console.log(`📦 Productos cargados: ${todos.length}`);

                if (data.length < PASO) break;
                desde += PASO;
            }

            const productos = todos.map(p => this._adaptarProducto(p));

            return { ok: true, data: productos };

        } catch (err) {
            console.error("Error inesperado al listar productos:", err);
            return { ok: false, error: err.message, data: [] };
        }
    },

    // ADAPTAR PRODUCTO (Supabase → Frontend)
    _adaptarProducto(p) {
        const variantesActivas = (p.variantes_producto || []).filter(v => v.activo !== false);
        const stockTotal = variantesActivas.reduce((sum, v) => sum + (v.stock || 0), 0);

        // Precio de catalogo: el menor de las variantes con precio valido.
        // Antes se tomaba la primera variante que tuviera precio, lo que hacia
        // que el precio mostrado dependiera del orden que devolviera Postgres.
        const preciosValidos = variantesActivas
            .map(v => parseFloat(v.precio))
            .filter(precio => Number.isFinite(precio) && precio > 0);
        const precio = preciosValidos.length > 0
            ? Math.min(...preciosValidos)
            : parseFloat(p.precio_base || 0);

        return {
            id: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio: Number.isFinite(precio) ? precio : 0,
            precio_base: parseFloat(p.precio_base || 0),
            stock: stockTotal,
            categoria: p.categorias ? p.categorias.id : null,
            categoria_nombre: p.categorias ? p.categorias.nombre : "Sin categoría",
            categoria_icono: p.categorias ? p.categorias.icono : "",
            marca: p.marcas ? p.marcas.nombre : null,
            imagen: p.imagen_url,
            imagen_url: p.imagen_url,
            activo: p.activo,
            destacado: p.destacado,
            descuento: parseFloat(p.descuento || 0),
            created_at: p.created_at,
            variantes: variantesActivas,
            categoria_id: p.categoria_id,
            marca_id: p.marca_id || (p.marcas ? p.marcas.id : null)
        };
    },

    // OBTENER UN PRODUCTO POR ID
    async obtener(id) {
        try {
            const { data, error } = await window.sb
                .from("productos")
                .select(`
                    *,
                    categorias:categoria_id (id, nombre, icono),
                    marcas:marca_id (id, nombre),
                    variantes_producto (*)
                `)
                .eq("id", id)
                .single();

            if (error) {
                console.error("Error al obtener producto:", error);
                return { ok: false, error: error.message };
            }

            return { ok: true, data: this._adaptarProducto(data) };

        } catch (err) {
            console.error("Error inesperado:", err);
            return { ok: false, error: err.message };
        }
    }
,
    // ============================================
    // BUSCAR PRODUCTO POR CÓDIGO
    // ============================================
    async _obtenerPorCodigo(codigo) {
        try {
            const { data, error } = await window.sb
                .from("productos")
                .select(`
                    id,
                    codigo,
                    nombre,
                    precio_base,
                    imagen_url,
                    categoria_id,
                    marca_id,
                    variantes_producto (id, sku, precio, stock)
                `)
                .eq("codigo", codigo)
                .maybeSingle();
            
            if (error) {
                console.error("Error al buscar producto por código:", error);
                return null;
            }
            
            return data;
            
        } catch (err) {
            console.error("Error inesperado:", err);
            return null;
        }
    },

    // ============================================
    // CREAR PRODUCTO (con variante automática)
    // ============================================
async crear(datos, archivoImagen = null) {
    try {
        // 1. Validaciones básicas
        const precio = parseFloat(datos.precio);
        if (!datos.codigo || !datos.nombre || !datos.categoria_id) {
            return { ok: false, error: "Faltan campos obligatorios: código, nombre, precio, categoría" };
        }
        if (!Number.isFinite(precio) || precio <= 0) {
            return { ok: false, error: "El precio debe ser un número mayor que cero" };
        }
        // Determinar si va activo o no (default: true)
        const activo = datos.activo !== undefined ? datos.activo : true;
        // Determinar stock (default: 1; si viene inválido se guarda 0, nunca NaN)
        const stockParseado = parseInt(datos.stock !== undefined ? datos.stock : 1, 10);
        const stock = Number.isFinite(stockParseado) ? stockParseado : 0;
        // 2. Determinar la URL de imagen
        let imagenUrl = datos.imagen_url || null;
        if (archivoImagen) {
            const subida = await this._subirImagen(archivoImagen, datos.codigo);
            if (subida.ok) {
                imagenUrl = subida.url;
            } else {
                console.warn("No se pudo subir la imagen:", subida.error);
            }
        }

        // 3. ¿Ya existe un producto con ese código?
        const existente = await this._obtenerPorCodigo(datos.codigo.trim());

        // 4. Si existe → ACTUALIZAR
        if (existente) {
            const updateData = {
                nombre: datos.nombre.trim(),
                descripcion: datos.descripcion ? datos.descripcion.trim() : null,
                precio_base: precio,
                categoria_id: datos.categoria_id,
                marca_id: datos.marca_id || null,
                activo: activo
            };
            
            // Solo actualizar imagen si hay una nueva
            if (imagenUrl) {
                updateData.imagen_url = imagenUrl;
            }

            const { data: productoActualizado, error: errorUpdate } = await window.sb
                .from("productos")
                .update(updateData)
                .eq("id", existente.id)
                .select()
                .single();

            if (errorUpdate) {
                console.error("Error al actualizar producto:", errorUpdate);
                return { ok: false, error: errorUpdate.message };
            }

            // Actualizar la variante (precio y stock). Si el producto no tenia
            // ninguna variante, se crea: antes el stock se perdia en silencio.
            const variantes = existente.variantes_producto || [];
            if (variantes.length > 0) {
                const { error: errorVarUpdate } = await window.sb
                    .from("variantes_producto")
                    .update({
                        precio: precio,
                        stock: stock
                    })
                    .eq("id", variantes[0].id);

                if (errorVarUpdate) {
                    console.warn("Error al actualizar variante:", errorVarUpdate);
                }
            } else {
                const { error: errorVarInsert } = await window.sb
                    .from("variantes_producto")
                    .insert({
                        producto_id: existente.id,
                        sku: datos.codigo.trim(),
                        atributos: {},
                        precio: precio,
                        stock: stock,
                        stock_minimo: 5,
                        activo: true
                    });

                if (errorVarInsert) {
                    console.warn("Error al crear la variante faltante:", errorVarInsert);
                }
            }

            return { 
                ok: true, 
                actualizado: true,
                data: {
                    producto: productoActualizado,
                    variante: variantes[0] || null
                }
            };
        }

        // 5. Si NO existe → CREAR producto nuevo
        const productoData = {
            codigo: datos.codigo.trim(),
            nombre: datos.nombre.trim(),
            descripcion: datos.descripcion ? datos.descripcion.trim() : null,
            precio_base: precio,
            categoria_id: datos.categoria_id,
            marca_id: datos.marca_id || null,
            imagen_url: imagenUrl,
            activo: activo,
            destacado: false,
            descuento: 0
        };

        const { data: producto, error: errorProducto } = await window.sb
            .from("productos")
            .insert(productoData)
            .select()
            .single();

        if (errorProducto) {
            console.error("Error al crear producto:", errorProducto);
            return { ok: false, error: errorProducto.message };
        }

        // 6. Crear la variante automática
        const varianteData = {
            producto_id: producto.id,
            sku: datos.codigo.trim(),
            atributos: {},
            precio: precio,
            stock: stock,
            stock_minimo: 5,
            activo: true
        };

        const { data: variante, error: errorVariante } = await window.sb
            .from("variantes_producto")
            .insert(varianteData)
            .select()
            .single();

        if (errorVariante) {
            console.error("Error al crear variante:", errorVariante);
            // El producto se creó, pero la variante falló → borrar producto
            await window.sb.from("productos").delete().eq("id", producto.id);
            return { ok: false, error: "Error al crear la variante: " + errorVariante.message };
        }

        return { 
            ok: true, 
            data: {
                producto: producto,
                variante: variante
            }
        };

    } catch (err) {
        console.error("Error inesperado al crear producto:", err);
        return { ok: false, error: err.message };
    }
},

    // ============================================
    // SUBIR IMAGEN A STORAGE
    // ============================================
    async _subirImagen(archivo, codigoProducto) {
        try {
            // Validar que sea imagen
            if (!archivo.type.startsWith("image/")) {
                return { ok: false, error: "El archivo debe ser una imagen" };
            }

            // Validar tamaño (máximo 2 MB)
            if (archivo.size > 2 * 1024 * 1024) {
                return { ok: false, error: "La imagen no puede pesar más de 2 MB" };
            }

            // Generar nombre único
            const extension = archivo.name.split(".").pop().toLowerCase();
            const timestamp = Date.now();
            const nombreArchivo = `${codigoProducto}-${timestamp}.${extension}`;

            // Subir a Supabase Storage
            const { data, error } = await window.sb.storage
                .from("productos")
                .upload(nombreArchivo, archivo, {
                    cacheControl: "3600",
                    upsert: false
                });

            if (error) {
                console.error("Error al subir imagen:", error);
                return { ok: false, error: error.message };
            }

            // Obtener URL pública
            const { data: urlData } = window.sb.storage
                .from("productos")
                .getPublicUrl(data.path);

            return { ok: true, url: urlData.publicUrl };

        } catch (err) {
            console.error("Error inesperado al subir imagen:", err);
            return { ok: false, error: err.message };
        }
    }
};
window.ProductService = ProductService;

console.log("✅ ProductService cargado");