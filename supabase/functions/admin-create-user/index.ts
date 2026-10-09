import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("🔥 ADMIN-CREATE-USER v3 INICIADO");

    // 1. Verificar header de autorización
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log("❌ No auth header");
      return new Response(
        JSON.stringify({ ok: false, error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // 2. Crear cliente con service_role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Verificar el usuario que llama
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.log("❌ Sesión inválida:", authError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Sesión inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log("✅ Usuario que llama:", user.id);

    // 4. Obtener el perfil del usuario que llama
    const { data: perfilData, error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .select('rol, activo')
      .eq('id', user.id)
      .single()

    if (perfilError || !perfilData) {
      console.log("❌ Perfil no encontrado:", perfilError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Perfil no encontrado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log("✅ Perfil:", perfilData);

    if (!perfilData.activo) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Usuario desactivado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Leer el body
    const body = await req.json()
    const { email, password, nombre, rol, cedula, telefono, emailReal } = body

    // 6. Validaciones
    if (!email || !password || !nombre || !rol) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Faltan campos obligatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['cliente', 'admin', 'superusuario'].includes(rol)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Rol inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Verificar permisos
    if (rol === 'admin' && perfilData.rol !== 'superusuario') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Solo el superusuario puede crear administradores' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (rol === 'superusuario') {
      return new Response(
        JSON.stringify({ ok: false, error: 'No se pueden crear superusuarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (rol === 'cliente' && !['admin', 'superusuario'].includes(perfilData.rol)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No tienes permisos para crear clientes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
 // 5.5. Validar cédula duplicada (solo si es cliente y tiene cédula)
    if (rol === 'cliente' && cedula) {
      const { data: cedulaExistente, error: cedulaError } = await supabaseAdmin
        .from('clientes')
        .select('id, nombre, cedula')
        .eq('cedula', cedula.trim())
        .maybeSingle()

      if (cedulaError) {
        console.error('Error al verificar cédula:', cedulaError)
      }

      if (cedulaExistente) {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: `La cédula ${cedula} ya está registrada a nombre de "${cedulaExistente.nombre}"`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    console.log("Intentando crear usuario:", { email, rol, nombre });

    // 8. Crear el usuario
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        nombre: nombre,
        rol: rol
      }
    })

    if (createError) {
      console.error('❌ Error al crear usuario:', JSON.stringify(createError));
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: `[createUser] ${createError.message || JSON.stringify(createError)}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log("✅ Usuario creado:", newUser?.user?.id);

    // 9. Actualizar perfil
    const { error: updatePerfilError } = await supabaseAdmin
      .from('perfiles')
      .update({
        nombre: nombre,
        rol: rol,
        activo: true
      })
      .eq('id', newUser.user.id)

    if (updatePerfilError) {
      console.warn('⚠️ Error al actualizar perfil:', updatePerfilError)
    }

    // 10. Si es cliente, crear fila en la tabla clientes
    if (rol === 'cliente' && cedula) {
      const { error: clienteError } = await supabaseAdmin
        .from('clientes')
        .insert({
          id: newUser.user.id,
          cedula: cedula,
          nombre: nombre,
          telefono: telefono || null,
          email: emailReal || null,
          activo: true
        })

      if (clienteError) {
        console.warn('⚠️ Error al crear cliente:', clienteError)
      }
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('❌ Error inesperado:', err)
    return new Response(
      JSON.stringify({ ok: false, error: 'Error inesperado: ' + err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})