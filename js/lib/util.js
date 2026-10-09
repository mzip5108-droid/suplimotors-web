// ============================================
// Utilidades compartidas: normalizacion de texto y escapado seguro de HTML
// ============================================

// ============================================
// NORMALIZAR TEXTO (quita tildes, minúsculas, trim)
// ============================================
export function normalizarTexto(texto) {
    if (!texto) return '';
    return String(texto)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

// Funcion simple para escapar HTML
export function escapeHtml(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}

// Igual que escapeHtml pero ademas neutraliza las comillas, para poder
// interpolar el valor dentro de un atributo HTML entrecomillado.
export function escapeAttr(texto) {
    return escapeHtml(texto).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
