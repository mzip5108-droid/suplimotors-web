// ============================================
// TEST: Extraer texto de un PDF
// ============================================

async function probarExtraerTextoPDF(archivo) {
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
window.probarExtraerTextoPDF = probarExtraerTextoPDF;

console.log("✅ test-pdf.js cargado");