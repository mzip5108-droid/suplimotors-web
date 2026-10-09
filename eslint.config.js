import js from "@eslint/js";
import globals from "globals";

/**
 * El proyecto carga los scripts con <script src> clasicos (sin bundler), asi que
 * parte de los nombres viven en window. Estas listas se iran vaciando a medida
 * que los modulos ES reemplacen a los globales.
 */
const SDK_CDN = {
    supabase: "readonly",
    XLSX: "readonly",
    pdfjsLib: "readonly"
};

// Servicios que app.js y las paginas consumen pero no definen
const SERVICIOS = {
    AuthService: "readonly",
    BrandService: "readonly",
    CategoryService: "readonly",
    ProductService: "readonly",
    ExcelImportService: "readonly"
};

const REGLAS = {
    // Errores reales que ya causaron bugs en este proyecto
    "no-dupe-keys": "error",
    "no-redeclare": "error",
    "no-unreachable": "error",
    "no-constant-condition": ["error", { checkLoops: false }],
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-useless-escape": "error",
    "no-prototype-builtins": "error",
    "no-self-assign": "error",
    "no-unmodified-loop-condition": "error",

    // Estilo y consistencia
    eqeqeq: ["warn", "smart"],
    "no-var": "error",
    "prefer-const": "warn",
    "no-throw-literal": "error",

    // Variables sin usar: aviso, no bloqueo (queda codigo heredado por revisar)
    "no-unused-vars": [
        "warn",
        {
            args: "none",
            caughtErrors: "none",
            varsIgnorePattern: "^_"
        }
    ]
};

export default [
    {
        ignores: [
            "node_modules/**",
            ".npm-cache/**",
            "supabase/.temp/**",
            "supabase/functions/**", // Deno + TypeScript: runtime aparte, no se lintea con ESLint
            "img/**",
            "*.min.js"
        ]
    },
    js.configs.recommended,
    {
        // Config del propio linter: es un modulo ES
        files: ["eslint.config.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "module",
            globals: { ...globals.node }
        }
    },
    {
        // Paginas que consumen los servicios
        files: ["app.js", "categorias.js", "contacto.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "script",
            globals: { ...globals.browser, ...SDK_CDN, ...SERVICIOS }
        },
        rules: REGLAS
    },
    {
        // Servicios: definen sus propios objetos, solo necesitan el SDK
        files: [
            "auth-service.js",
            "brand-service.js",
            "category-service.js",
            "product-service.js",
            "supabase-client.js",
            "test-pdf.js"
        ],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "script",
            globals: { ...globals.browser, ...SDK_CDN }
        },
        rules: REGLAS
    },
    {
        // El importador de Excel consume ProductService directamente
        files: ["excel-import-service.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "script",
            globals: { ...globals.browser, ...SDK_CDN, ProductService: "readonly" }
        },
        rules: REGLAS
    }
];
