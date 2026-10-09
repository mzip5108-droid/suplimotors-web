// ============================================
// Marcas: listado, cache, alta y reactivacion
// ============================================

import { sb } from "./supabase-client.js";

// ============================================
// BRAND SERVICE - Manejo de marcas en Supabase
// ============================================

export const BrandService = {

    // Cache local
    _marcas: [],

    // ============================================
    // LISTAR TODAS LAS MARCAS ACTIVAS
    // ============================================
    async listar() {
        try {
            const { data, error } = await sb
                .from("marcas")
                .select("id, nombre")
                .eq("activa", true)
                .order("nombre");

            if (error) {
                console.error("Error al listar marcas:", error);
                return { ok: false, error: error.message, data: [] };
            }

            this._marcas = data;
            return { ok: true, data: data };

        } catch (err) {
            console.error("Error inesperado al listar marcas:", err);
            return { ok: false, error: err.message, data: [] };
        }
    },

    // ============================================
    // OBTENER MARCA POR ID (del cache)
    // ============================================
    obtenerPorId(id) {
        return this._marcas.find(m => m.id === id) || null;
    },

    // ============================================
    // OBTENER MARCA POR NOMBRE (del cache)
    // ============================================
    obtenerPorNombre(nombre) {
        if (!nombre) return null;
        const lower = nombre.toLowerCase().trim();
        return this._marcas.find(m => m.nombre.toLowerCase() === lower) || null;
    },

    // ============================================
    // CREAR MARCA
    // ============================================
    async crear(nombre) {
        try {
            // Verificar si ya existe
            const existente = await sb
                .from("marcas")
                .select("id, nombre, activa")
                .ilike("nombre", nombre.trim())
                .maybeSingle();

            if (existente.data) {
                // Si existe pero está inactiva, reactivarla
                if (existente.data.activa === false) {
                    const { data: reactivada, error: errorReactivar } = await sb
                        .from("marcas")
                        .update({ activa: true })
                        .eq("id", existente.data.id)
                        .select()
                        .single();
                    
                    if (errorReactivar) {
                        return { ok: false, error: errorReactivar.message };
                    }
                    
                    // Actualizar cache
                    this._marcas.push(reactivada);
                    return { ok: true, data: reactivada, reactivada: true };
                }
                
                return { ok: true, data: existente.data, yaExistia: true };
            }

            const { data, error } = await sb
                .from("marcas")
                .insert({ nombre: nombre.trim(), activa: true })
                .select()
                .single();

            if (error) {
                console.error("Error al crear marca:", error);
                return { ok: false, error: error.message };
            }

            this._marcas.push(data);
            return { ok: true, data: data, yaExistia: false };

        } catch (err) {
            console.error("Error inesperado al crear marca:", err);
            return { ok: false, error: err.message };
        }
    },

    // ============================================
    // OBTENER O CREAR (combinado)
    // ============================================
    async obtenerOCrear(nombre) {
        if (!nombre) return { ok: false, error: "El nombre es obligatorio" };

        // Buscar en cache primero
        const existente = this.obtenerPorNombre(nombre);
        if (existente) {
            return { ok: true, data: existente, yaExistia: true };
        }

        // No está en cache, crear en Supabase
        return await this.crear(nombre);
    },

    // ============================================
    // OBTENER CACHE LOCAL
    // ============================================
    getCache() {
        return this._marcas;
    }
};
