// ============================================
// PROTOTIPO NO INTEGRADO: extraccion de texto de un PDF.
// No lo carga ninguna vista. Se conserva porque exploraba una futura
// importacion de listas de precios en PDF. Si se retoma, exponer esta
// funcion desde la pestana de importar.
// ============================================

// ============================================
// TEST: Extraer texto de un PDF
// ============================================

export async function probarExtraerTextoPDF(archivo) {
    console.log("📄 Procesando:", archivo.name);
    
    try {
        const arrayBuffer = await archivo.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        console.log("📄 Total páginas:", pdf.numPages);
        console.log("============================================");
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const contenido = await page.getTextContent();
            
            // Extraer texto respetando saltos de línea
            let texto = "";
            let ultimaY = null;
            
            contenido.items.forEach(item => {
                const y = item.transform[5]; // coordenada Y
                if (ultimaY !== null && Math.abs(y - ultimaY) > 3) {
                    texto += "\n"; // nueva línea
                }
                texto += item.str;
                ultimaY = y;
            });
            
            console.log(`--- PÁGINA ${i} ---`);
            console.log(texto);
            console.log("");
        }
        
        console.log("============================================");
        console.log("✅ Extracción completa");
        
    } catch (err) {
        console.error("❌ Error al procesar PDF:", err);
    }
}

// Hacer la función accesible globalmente
