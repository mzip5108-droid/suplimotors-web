import js from "@eslint/js";
import globals from "globals";

/**
 * El SDK de Supabase, XLSX y pdf.js se cargan por CDN con <script src> en las
 * vistas, asi que siguen siendo globales del navegador y no se importan.
 */
const SDK_CDN = {
    supabase: "readonly",
    XLSX: "readonly",
    pdfjsLib: "readonly"
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
        // Config del propio linter
        files: ["eslint.config.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "module",
            globals: { ...globals.node }
        }
    },
    {
        // Aplicacion modular: cada archivo declara sus imports y exports
        files: ["js/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "module",
            globals: { ...globals.browser, ...SDK_CDN }
        },
        rules: REGLAS
    },
    {
        // Tests: corren en Node, pero montan un DOM con jsdom y usan sus globals
        files: ["tests/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "module",
            globals: { ...globals.node, ...globals.browser }
        },
        rules: REGLAS
    },
    {
        // Herramientas de verificacion en Node (CommonJS)
        files: ["tools/**/*.cjs"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "commonjs",
            globals: { ...globals.node }
        },
        rules: REGLAS
    }
];
