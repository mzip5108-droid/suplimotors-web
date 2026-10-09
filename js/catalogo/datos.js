// ============================================
// Carga del catalogo desde Supabase y overlay de progreso
// ============================================

import { actualizarSelectCategorias, actualizarSelectMarcas } from "./admin.js";
import { productos, setProductos } from "./estado.js";
import { actualizarEstadisticasInventario, actualizarFiltroMarcas, agregarAnimacionesTarjetas, renderizarCategorias, renderizarProductosConPaginacion } from "./render.js";
import { BrandService } from "../servicios/brand-service.js";
import { CategoryService } from "../servicios/category-service.js";
import { ProductService } from "../servicios/product-service.js";
import { cargarClientes, renderizarClientes } from "../paginas/clientes.js";

// ============================================
// CARGAR PRODUCTOS DESDE SUPABASE
// ============================================
export async function cargarProductosDesdeSupabase() {
    try {
        //  Mostrar progreso: 10%
        actualizarProgresoCarga(10);

        const resultado = await ProductService.listar(true);

        //  Mostrar progreso: 80%
        actualizarProgresoCarga(80);
        
        if (!resultado.ok) {
            console.error("Error al cargar productos:", resultado.error);
            setProductos([]);
            return;
        }
        
        setProductos(resultado.data);
        console.log(`✅ ${productos.length} productos cargados desde Supabase`);

        //  Mostrar progreso: 100%
        actualizarProgresoCarga(100);
        
    } catch (err) {
        console.error("Error inesperado al cargar productos:", err);
        setProductos([]);
    }
}

// Helper: actualizar barra de progreso
export function actualizarProgresoCarga(porcentaje) {
    const barra = document.getElementById('overlay-progreso');
    const texto = document.getElementById('overlay-porcentaje');
    if (barra) barra.style.width = porcentaje + '%';
    if (texto) texto.textContent = porcentaje + '%';
}

export function ocultarOverlayCarga() {
    const overlay = document.getElementById('overlay-cargando');
    if (!overlay) return;
    
    // 1. Desvanecer el overlay (agrega clase)
    overlay.classList.add('oculto');
    
    // 2. Reactivar scroll
    document.body.style.overflow = '';
    
    // 3. Animar las tarjetas después de que empiece la transición
    setTimeout(() => {
        agregarAnimacionesTarjetas();
    }, 300);
    
    // 4. Remover el overlay después de la transición COMPLETA (1.5s)
    setTimeout(() => {
        if (overlay.parentElement) overlay.remove();
    }, 1500);
}

// ============================================
// CARGAR CATEGORÍAS DESDE SUPABASE
// ============================================
export async function cargarCategoriasDesdeSupabase() {
    try {
        const resultado = await CategoryService.listar();
        
        if (!resultado.ok) {
            console.error("Error al cargar categorías:", resultado.error);
            return;
        }
        
        console.log(`✅ ${resultado.data.length} categorías cargadas desde Supabase`);
        
    } catch (err) {
        console.error("Error inesperado al cargar categorías:", err);
    }
}

// ============================================
// CARGAR MARCAS DESDE SUPABASE
// ============================================
export async function cargarMarcasDesdeSupabase() {
    try {
        const resultado = await BrandService.listar();
        
        if (!resultado.ok) {
            console.error("Error al cargar marcas:", resultado.error);
            return;
        }
        
        console.log(`✅ ${resultado.data.length} marcas cargadas desde Supabase`);
        
    } catch (err) {
        console.error("Error inesperado al cargar marcas:", err);
    }
}

// ============================================
// LEER PARAMETRO ?categoria=ID DE LA URL
// ============================================
// ============================================
// RECARGA DE DATOS TRAS INICIAR SESION
// Con RLS activo la carga previa al login se hizo como usuario anonimo y volvio
// vacia, asi que al autenticarse hay que volver a pedir catalogo, marcas,
// categorias y clientes. No se reinicializan los listeners para no duplicarlos.
// ============================================
export async function recargarDatosDeLaSesion() {
    await cargarCategoriasDesdeSupabase();
    await cargarMarcasDesdeSupabase();
    await cargarProductosDesdeSupabase();

    renderizarCategorias();
    actualizarSelectCategorias();
    actualizarSelectMarcas();
    actualizarFiltroMarcas();
    actualizarEstadisticasInventario();

    await cargarClientes();
    renderizarClientes();

    renderizarProductosConPaginacion();
}
