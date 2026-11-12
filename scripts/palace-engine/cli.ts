/**
 * Nexo-Palace Engine — CLI.
 *
 * Uso:
 *   palace index [--provider gemini|ollama|offline] [--model <modelo>]
 *   palace query "<texto>" [--scope doc|code|test|taste|requirement|all] [--limit N]
 *   palace trace "<ruta o símbolo>" [--depth N]
 *   palace drift [--base <ref>] [--dry-run]
 *   palace stats
 *
 * El mismo motor se expone como servidor MCP en `server.ts`.
 */
import { closeDb, indexProvider, indexStats, openDb, setMeta } from "./db.ts";
import { loadEnv, OFFLINE_EMBEDDING_DIM } from "./config.ts";
import {
  createEmbeddingProvider,
  describeProvider,
  OfflineEmbeddingProvider,
  providerFromId,
  type EmbeddingProvider,
} from "./embedder.ts";
import { detectDrift } from "./drift.ts";
import { recordDecision } from "./episodes.ts";
import { extractCode } from "./extract-code.ts";
import { ingestDocuments } from "./ingest-docs.ts";
import { search } from "./query.ts";
import { traceEntity } from "./trace.ts";

/** Opciones analizadas de la línea de comandos. */
interface CliOptions {
  positional: string[];
  flags: Record<string, string | boolean>;
}

/** Divide los argumentos en posicionales y banderas. */
function parseArgs(argv: string[]): CliOptions {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

/**
 * Proveedor para las consultas: el mismo con el que se indexó.
 *
 * Si ese proveedor ya no está disponible (cuota agotada, Ollama apagado), la
 * capa vectorial queda desactivada —sus vectores no serían comparables— y la
 * búsqueda sigue siendo léxica.
 */
function queryProvider(db: ReturnType<typeof openDb>): EmbeddingProvider {
  const index = indexProvider(db);
  const fromIndex = providerFromId(index.id, index.dim);
  if (fromIndex) return fromIndex;

  process.stderr.write(
    "[nexo-palace] El índice no tiene capa vectorial o su proveedor no está disponible: " +
      "la búsqueda será solo léxica.\n",
  );
  return new OfflineEmbeddingProvider(index.dim ?? OFFLINE_EMBEDDING_DIM);
}

/** Imprime el uso del CLI. */
function usage(): void {
  process.stdout.write(
    [
      "Nexo-Palace Engine — memoria del proyecto nexo-menu",
      "",
      "Comandos:",
      "  index [--provider <gemini|ollama|offline>] [--model <modelo>]   Indexa documentación y código",
      "  query <texto> [--scope <scope>] [--limit <n>] [--path <prefijo>] Consulta híbrida",
      "  trace <entidad> [--depth <n>]                                  Traza el grafo de un archivo o símbolo",
      "  drift [--base <ref>] [--dry-run]                                Detecta deriva entre código y requisitos",
      "  decide --context <texto> --decision <texto> [--tags a,b] [--files x,y]",
      "                                                                   Registra una decisión en la memoria",
      "  stats                                                           Estado del índice",
      "",
    ].join("\n"),
  );
}

/** Ejecuta el comando solicitado. */
async function main(): Promise<number> {
  loadEnv();

  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0];

  if (!command || command === "help" || flags.help) {
    usage();
    return 0;
  }

  const db = openDb();

  switch (command) {
    case "index": {
      // Si el índice ya tiene una capa vectorial, se reutiliza su proveedor:
      // cambiar de proveedor en silencio descartaría los embeddings actuales.
      const explicit = typeof flags.provider === "string" ? flags.provider : undefined;
      const index = indexProvider(db);
      const provider = explicit
        ? await createEmbeddingProvider({
            provider: explicit,
            model: typeof flags.model === "string" ? flags.model : undefined,
          })
        : (providerFromId(index.id, index.dim) ??
          (await createEmbeddingProvider({
            model: typeof flags.model === "string" ? flags.model : undefined,
          })));

      process.stderr.write(`[palace] indexando documentos con ${describeProvider(provider)}\n`);
      const docs = await ingestDocuments(provider, { db, allowProviderSwitch: Boolean(explicit) });

      process.stderr.write("[palace] indexando código y construyendo el grafo...\n");
      const code = await extractCode(provider, { db, allowProviderSwitch: Boolean(explicit) });

      setMeta(db, "indexed_at", new Date().toISOString());

      const stats = indexStats(db);
      process.stdout.write(
        [
          `Documentos: ${docs.documents} (${docs.files} ficheros, ${docs.chunks} fragmentos)`,
          `Requisitos detectados: ${docs.requirements}`,
          `Código: ${code.files} ficheros, ${code.symbols} símbolos, ${code.tests} tests`,
          `Aristas del grafo: ${code.edges}`,
          `Vectores: ${stats.vectors} (dim ${stats.dim}, proveedor ${stats.provider})`,
          docs.skippedShort > 0
            ? `Fragmentos sin embedding por ser demasiado cortos: ${docs.skippedShort}`
            : "",
          docs.errors.length > 0 ? `Errores: ${docs.errors.length}` : "",
          ...docs.errors.map((e) => `  - ${e}`),
        ]
          .filter(Boolean)
          .join("\n") + "\n",
      );
      return 0;
    }

    case "query": {
      const text = positional.slice(1).join(" ");
      if (!text) {
        process.stderr.write("Error: falta el texto de la consulta.\n");
        return 1;
      }
      const provider = queryProvider(db);
      const results = await search(
        text,
        provider,
        {
          scope: typeof flags.scope === "string" ? flags.scope : "all",
          limit: typeof flags.limit === "string" ? Number(flags.limit) : 8,
          pathPrefix: typeof flags.path === "string" ? flags.path : undefined,
        },
        db,
      );

      if (results.length === 0) {
        process.stdout.write("Sin resultados.\n");
        return 0;
      }

      for (const r of results) {
        process.stdout.write(
          [
            "",
            `=== ${r.path ?? r.nodeId} ${r.headerPath ? `[${r.headerPath}]` : ""}`,
            `    tipo=${r.nodeType} score=${r.score} lexico=${r.lexicalRank ?? "-"} vector=${r.vectorRank ?? "-"}${r.literal ? " literal" : ""}${r.requirementIds.length > 0 ? ` requisitos=${r.requirementIds.join(",")}` : ""}`,
            "",
            r.content,
          ].join("\n"),
        );
      }
      process.stdout.write("\n");
      return 0;
    }

    case "trace": {
      const entity = positional.slice(1).join(" ");
      if (!entity) {
        process.stderr.write("Error: falta la entidad a trazar.\n");
        return 1;
      }
      const trace = traceEntity(entity, typeof flags.depth === "string" ? Number(flags.depth) : 2, db);
      process.stdout.write(`${JSON.stringify(trace, null, 2)}\n`);
      return 0;
    }

    case "drift": {
      const result = detectDrift(
        {
          baseRef: typeof flags.base === "string" ? flags.base : undefined,
          mark: flags["dry-run"] !== true,
        },
        db,
      );
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }

    case "decide": {
      const context = typeof flags.context === "string" ? flags.context : "";
      const decision = typeof flags.decision === "string" ? flags.decision : "";
      if (!context || !decision) {
        process.stderr.write("Error: `decide` requiere --context y --decision.\n");
        return 1;
      }
      const tags =
        typeof flags.tags === "string" ? flags.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
      const relatedFiles =
        typeof flags.files === "string"
          ? flags.files.split(",").map((f) => f.trim()).filter(Boolean)
          : [];

      const provider = queryProvider(db);
      const episode = await recordDecision({ context, decision, tags, relatedFiles }, db, provider);
      process.stdout.write(`${JSON.stringify(episode, null, 2)}\n`);
      return 0;
    }

    case "stats": {
      process.stdout.write(`${JSON.stringify(indexStats(db), null, 2)}\n`);
      return 0;
    }

    default:
      process.stderr.write(`Comando desconocido: ${command}\n\n`);
      usage();
      return 1;
  }
}

main()
  .then((code) => {
    closeDb();
    process.exit(code);
  })
  .catch((err) => {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    closeDb();
    process.exit(1);
  });
