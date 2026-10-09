// ============================================
// Categorias: listado, cache y alta
// ============================================

import { sb } from "./supabase-client.js";

// ============================================
// CATEGORY SERVICE - Manejo de categorías en Supabase
// ============================================

export const CategoryService = {

    // Cache local (para no consultar Supabase siempre)
    _categorias: [],

    // ============================================
    // LISTAR TODAS LAS CATEGORÍAS ACTIVAS
    // ============================================
    async listar() {
        try {
            const { data, error } = await sb
                .from("categorias")
                .select("id, nombre, icono")
                .eq("activa", true)
                .order("nombre");

            if (error) {
                console.error("Error al listar categorías:", error);
                return { ok: false, error: error.message, data: [] };
            }

            this._categorias = data;
            return { ok: true, data: data };

        } catch (err) {
            console.error("Error inesperado al listar categorías:", err);
            return { ok: false, error: err.message, data: [] };
        }
    },

    // ============================================
    // OBTENER CATEGORÍA POR ID (del cache)
    // ============================================
    obtenerPorId(id) {
        return this._categorias.find(c => c.id === id) || null;
    },

    // ============================================
    // OBTENER CATEGORÍA POR NOMBRE (del cache)
    // ============================================
    obtenerPorNombre(nombre) {
        if (!nombre) return null;
        const lower = nombre.toLowerCase().trim();
        return this._categorias.find(c => c.nombre.toLowerCase() === lower) || null;
    },

    // ============================================
    // CREAR CATEGORÍA
    // ============================================
    async crear(nombre, icono = "") {
        try {
            // Verificar si ya existe
            const existente = await sb
                .from("categorias")
                .select("id, nombre, icono, activa")
                .ilike("nombre", nombre.trim())
                .maybeSingle();

            if (existente.data) {
                // Si existia dada de baja se reactiva en lugar de devolverla
                // inactiva: si no, sus productos quedarian fuera del catalogo
                // y del filtro por categoria.
                if (existente.data.activa === false) {
                    const { data: reactivada, error: errorReactivar } = await sb
                        .from("categorias")
                        .update({ activa: true })
                        .eq("id", existente.data.id)
                        .select()
                        .single();

                    if (errorReactivar) {
                        return { ok: false, error: errorReactivar.message };
                    }

                    this._categorias.push(reactivada);
                    return { ok: true, data: reactivada, reactivada: true };
                }

                return { ok: true, data: existente.data, yaExistia: true };
            }

            const { data, error } = await sb
                .from("categorias")
                .insert({ nombre: nombre.trim(), icono: icono, activa: true })
                .select()
                .single();

            if (error) {
                console.error("Error al crear categoría:", error);
                return { ok: false, error: error.message };
            }

            // Actualizar cache
            this._categorias.push(data);
            return { ok: true, data: data, yaExistia: false };

        } catch (err) {
            console.error("Error inesperado al crear categoría:", err);
            return { ok: false, error: err.message };
        }
    },

    // ============================================
    // OBTENER O CREAR (combinado)
    // ============================================
    async obtenerOCrear(nombre, icono = "") {
        if (!nombre) return { ok: false, error: "El nombre es obligatorio" };

        // Buscar en cache primero
        const existente = this.obtenerPorNombre(nombre);
        if (existente) {
            return { ok: true, data: existente, yaExistia: true };
        }

        // No está en cache, crear en Supabase
        return await this.crear(nombre, icono);
    },

    // ============================================
    // OBTENER CACHE LOCAL
    // ============================================
    getCache() {
        return this._categorias;
    }
};
