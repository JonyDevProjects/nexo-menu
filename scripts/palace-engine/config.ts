/**
 * Nexo-Palace Engine — configuración central.
 *
 * Todas las rutas se resuelven respecto a la raíz del repositorio para que el
 * motor funcione sin importar el directorio de trabajo desde el que se lance.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Carga el `.env` del repositorio, si existe.
 *
 * A diferencia de `process.loadEnvFile()` (que no pisa lo que ya está
 * exportado en el shell), el `.env` del proyecto **tiene prioridad**: es la
 * configuración explícita del repositorio, y una variable antigua exportada en
 * la shell no debe dejar de usar una clave válida.
 *
 * Formato admitido: `CLAVE=valor`, comillas opcionales, `#` para comentarios
 * y prefijo `export` opcional.
 */
export function loadEnv(): void {
  const envPath = join(resolve(HERE, "..", ".."), ".env");
  let content: string;
  try {
    content = readFileSync(envPath, "utf8");
  } catch {
    // Sin `.env`: el motor sigue funcionando con las variables del entorno.
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

/** Raíz del repositorio nexo-menu. */
export const REPO_ROOT = resolve(HERE, "..", "..");

/** Directorio de artefactos locales del motor (ignorado por git). */
export const PALACE_DIR = join(REPO_ROOT, "palace");

/** Base de datos unificada: grafo + FTS5 + vectores. */
export const DB_PATH = process.env.PALACE_DB_PATH || join(PALACE_DIR, "nexo-memory.sqlite3");

/**
 * Directorios whose Markdown se indexa como fuente documental.
 * `docs/` contiene las especificaciones, auditorías y reportes de sesión.
 * `.commandcode/taste/` contiene las preferencias y convenciones del taste.
 */
export const DOC_GLOBS: string[] = [
  "docs",
  ".commandcode/taste",
];

/**
 * Directorios escaneados por el extractor AST de TypeScript (Fase 2).
 * `tests/` y `e2e/` se incluyen para poder derivar aristas `TESTEA`.
 */
export const CODE_DIRS: string[] = [
  "app",
  "components",
  "lib",
  "tests",
  "test",
  "e2e",
];

/** Extensiones de código indexables en el grafo. */
export const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/**
 * Dimensión por defecto del vector offline (hash-TF-IDF).
 * Si el proveedor de embeddings configurado usa otra dimensión, el motor
 * detecta el cambio en la tabla `meta` y reindexa el corpus vectorial.
 */
export const OFFLINE_EMBEDDING_DIM = 384;

/**
 * Dimensiones conocidas por proveedor, para validar antes de escribir.
 * Si el proveedor no está en esta tabla se usa la dimensión reportada por él.
 */
export const PROVIDER_DIMS: Record<string, number> = {
  "gemini:text-embedding-004": 768,
  "gemini:text-embedding-005": 768,
  "ollama:nomic-embed-text": 768,
  "ollama:bge-m3": 1024,
  "ollama:mxbai-embed-large": 1024,
  "offline:hash-tfidf": OFFLINE_EMBEDDING_DIM,
};

/** Número máximo de fragmentos devueltos por una consulta híbrida. */
export const DEFAULT_QUERY_LIMIT = 8;

/** Presupuesto de tokens por fragmento al trocear Markdown. */
export const CHUNK_TARGET_CHARS = 1400;

/**
 * Longitud mínima de un fragmento para que merece la pena embeberlo.
 *
 * Los fragmentos muy cortos (encabezados, tablas de una línea) aportan poco
 * valor semántico y consumen cuota: el nivel gratuito de Gemini permite 1000
 * peticiones de embedding al día. Los fragmentos cortos siguen siendo
 * recuperables por la vía léxica (FTS5 y coincidencia literal).
 */
export const MIN_EMBED_CHARS = Number(process.env.PALACE_MIN_EMBED_CHARS || 160);

/**
 * Reglas de exclusión para el indexador documental.
 * Se ignoran los bloques de código ejecutable y los mermaid, que no aportan
 * semántica recuperable y sí contaminan el vector.
 */
export const STRIP_CODE_BLOCKS = true;
