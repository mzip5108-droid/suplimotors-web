// ============================================
// Logos de marca y placeholder de imagen por defecto
// ============================================

import { normalizarTexto } from "./util.js";

export const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23f1f5f9'/><text x='100' y='100' font-family='Arial, sans-serif' font-size='16' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>Sin Imagen</text></svg>";

// ============================================
// IMÁGENES POR MARCA (hardcodeadas)
// ============================================
export const IMAGENES_MARCAS = {
    'fraco': 'img/marcas/fraco.jpg',
    'federal mogul': 'img/marcas/federal-mogul.jpg',
    'melling': 'img/marcas/melling.jpg',
    'natsuki': 'img/marcas/natsuki.png',
    'masaki': 'img/marcas/masaki.jpg',
    'grant': 'img/marcas/grant.jpg',
    'cloyes': 'img/marcas/cloyes.jpg',
    'walker': 'img/marcas/walker.jpg',
    'champion': 'img/marcas/champion.jpg',
    'spicer': 'img/marcas/spicer.jpg',
    'moresa': 'img/marcas/moresa.jpg',
    'pc pistons': 'img/marcas/pc-pistons.jpg',
    'top line': 'img/marcas/top-line.jpg',
    'usmn': 'img/marcas/usmn.jpg',
    'asiainc': 'img/marcas/asiainc.jpeg',
    'sap': 'img/marcas/sap.png',
    'sm performance': 'img/marcas/sm-performance.jpg',
    'iridium': 'img/marcas/iridium.jpg',
    // La marca puede venir como "Exact" o "Exactcar": ambas apuntan al mismo logo
    'exact': 'img/marcas/exact.jpg',
    'exactcar': 'img/marcas/exact.jpg',
    'durabond': 'img/marcas/durabond.png',
    'fraven': 'img/marcas/fraven.jpg',
    'original': 'img/marcas/original.jpg',
    'oring': 'img/marcas/oring.jpg',
    'gomas de válvulas': 'img/marcas/gomas-de-valvulas.jpg'
};

// Indice normalizado (sin tildes ni mayusculas) para que la busqueda del logo
// no falle por acentos, mayusculas o espacios sobrantes.
export const INDICE_IMAGENES_MARCAS = Object.fromEntries(
    Object.entries(IMAGENES_MARCAS).map(([clave, url]) => [normalizarTexto(clave), url])
);

// Helper: devuelve la URL de imagen según la marca
export function getImagenMarca(marca) {
    if (!marca) return null;
    return INDICE_IMAGENES_MARCAS[normalizarTexto(marca)] || null;
}
