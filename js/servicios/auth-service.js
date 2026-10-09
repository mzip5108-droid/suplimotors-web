// ============================================
// Autenticacion: login, sesion, roles y alta de usuarios
// ============================================

import { sb } from "./supabase-client.js";

// ============================================
// AUTH SERVICE - Manejo de autenticación
// ============================================

const DOMINIO_CLIENTES = "@suplimotors.local";

export const AuthService = {

    // ============================================
    // LOGIN
    // ============================================
    async login(usuarioOEmail, password) {
        try {
            // Detectar si es email o usuario
            let email;
            if (usuarioOEmail.includes("@")) {
                // Es un email (admin o superusuario)
                email = usuarioOEmail.trim().toLowerCase();
            } else {
                // Es un nombre de usuario (cliente) → añadir dominio falso
                email = usuarioOEmail.trim().toLowerCase() + DOMINIO_CLIENTES;
            }

            // Llamar a Supabase Auth
            const { data, error } = await sb.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error("Error en login:", error);
                return { ok: false, error: error.message };
            }

            // Login exitoso → obtener perfil
            const perfil = await this.getPerfil(data.user.id);
            if (!perfil) {
                await this.logout();
                return { ok: false, error: "No se encontró el perfil del usuario" };
            }

            // Verificar que el usuario esté activo
            if (!perfil.activo) {
                await this.logout();
                return { ok: false, error: "Tu cuenta está desactivada. Contacta al administrador." };
            }

            // Actualizar último login
            await sb
                .from("perfiles")
                .update({ ultimo_login: new Date().toISOString() })
                .eq("id", data.user.id);

            return { ok: true, perfil: perfil };

        } catch (err) {
            console.error("Error inesperado en login:", err);
            return { ok: false, error: "Error inesperado. Intenta de nuevo." };
        }
    },

    // ============================================
    // LOGOUT
    // ============================================
    async logout() {
        try {
            await sb.auth.signOut();
            return { ok: true };
        } catch (err) {
            console.error("Error en logout:", err);
            return { ok: false, error: err.message };
        }
    },

    // ============================================
    // OBTENER SESIÓN ACTUAL
    // ============================================
    async getSesion() {
        const { data, error } = await sb.auth.getSession();
        if (error) {
            console.error("Error al obtener sesión:", error);
            return null;
        }
        return data.session;
    },

    // ============================================
    // OBTENER PERFIL DEL USUARIO ACTUAL
    // ============================================
    async getPerfil(userId = null) {
        try {
            if (!userId) {
                const sesion = await this.getSesion();
                if (!sesion) return null;
                userId = sesion.user.id;
            }

            const { data, error } = await sb
                .from("perfiles")
                .select("*")
                .eq("id", userId)
                .single();

            if (error) {
                console.error("Error al obtener perfil:", error);
                return null;
            }

            return data;
        } catch (err) {
            console.error("Error inesperado al obtener perfil:", err);
            return null;
        }
    },

    // ============================================
    // VERIFICAR ROL
    // ============================================
    async tieneRol(rolesPermitidos) {
        const perfil = await this.getPerfil();
        if (!perfil) return false;

        // Si le pasas un string, lo convertimos a array
        if (typeof rolesPermitidos === "string") {
            rolesPermitidos = [rolesPermitidos];
        }

        return rolesPermitidos.includes(perfil.rol);
    },

    // ============================================
    // VERIFICAR SI ES ADMIN O SUPER
    // ============================================
    async esAdmin() {
        return await this.tieneRol(["admin", "superusuario"]);
    },

    // ============================================
    // VERIFICAR SI ES SUPERUSUARIO
    // ============================================
    async esSuperusuario() {
        return await this.tieneRol("superusuario");
    },

    // ============================================
    // CREAR USUARIO (admin/super)
    // ============================================
    async crearUsuario({ tipo, emailOUsuario, password, nombre, cedula, telefono }) {
        try {
            // Solo superusuario puede crear admins
            if (tipo === "admin") {
                const esSuper = await this.esSuperusuario();
                if (!esSuper) {
                    return { ok: false, error: "Solo el superusuario puede crear administradores." };
                }
            }

            // Solo admin o super pueden crear clientes
            if (tipo === "cliente") {
                const esAdm = await this.esAdmin();
                if (!esAdm) {
                    return { ok: false, error: "Solo un administrador puede crear clientes." };
                }
            }

            // Construir email
            let email;
            if (emailOUsuario.includes("@")) {
                email = emailOUsuario.trim().toLowerCase();
            } else {
                email = emailOUsuario.trim().toLowerCase() + DOMINIO_CLIENTES;
            }

            // Crear usuario en Supabase Auth
            // ⚠️ IMPORTANTE: esto debe hacerse con signUp pero no cierra la sesión del admin actual
            // Usamos signUp normal y luego cerramos la sesión del nuevo usuario
            const { data, error } = await sb.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        rol: tipo,
                        nombre: nombre
                    }
                }
            });

            if (error) {
                console.error("Error al crear usuario:", error);
                return { ok: false, error: error.message };
            }

            if (!data.user) {
                return { ok: false, error: "No se pudo crear el usuario." };
            }

            // Si es cliente, crear también su registro en la tabla clientes
            if (tipo === "cliente" && cedula) {
                const { error: errorCliente } = await sb
                    .from("clientes")
                    .insert({
                        id: data.user.id,
                        cedula: cedula,
                        nombre: nombre,
                        telefono: telefono || null,
                        email: emailOUsuario.includes("@") ? emailOUsuario : null,
                        activo: true
                    });

                if (errorCliente) {
                    console.error("Error al crear cliente:", errorCliente);
                    // No es crítico, el usuario ya se creó
                }
            }

            return { ok: true, user: data.user, email: email };

        } catch (err) {
            console.error("Error inesperado al crear usuario:", err);
            return { ok: false, error: "Error inesperado. Intenta de nuevo." };
        }
    },

    // ============================================
    // CAMBIAR CONTRASEÑA
    // ============================================
    async cambiarPassword(nuevaPassword) {
        try {
            const { error } = await sb.auth.updateUser({
                password: nuevaPassword
            });

            if (error) {
                return { ok: false, error: error.message };
            }

            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    },
   // ============================================
    // CREAR USUARIO CON EDGE FUNCTION (admin.createUser)
    // ============================================
    async crearUsuarioAdmin({ tipo, emailOUsuario, password, nombre, cedula, telefono, emailReal }) {
        try {
            // Construir email
            let email;
            if (emailOUsuario.includes("@")) {
                email = emailOUsuario.trim().toLowerCase();
            } else {
                email = emailOUsuario.trim().toLowerCase() + DOMINIO_CLIENTES;
            }

            // Obtener el token de la sesión actual
            const { data: { session } } = await sb.auth.getSession();
            
            if (!session) {
                return { ok: false, error: "No hay sesión activa" };
            }

            // Llamar a la Edge Function
            const { data, error } = await sb.functions.invoke('admin-create-user', {
                body: {
                    email: email,
                    password: password,
                    nombre: nombre,
                    rol: tipo,
                    cedula: cedula || null,
                    telefono: telefono || null,
                    emailReal: emailReal || null
                }
            });

            if (error) {
                console.error('Error al llamar Edge Function:', error);
                return { ok: false, error: error.message || 'Error al crear el usuario' };
            }

            if (!data || !data.ok) {
                return { ok: false, error: data?.error || 'Error al crear usuario' };
            }

            return { ok: true, user: data.user };

        } catch (err) {
            console.error('Error inesperado:', err);
            return { ok: false, error: err.message };
        }
    }
};
