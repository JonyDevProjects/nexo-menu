/**
 * Prueba de humo del servidor MCP.
 *
 * Levanta el servidor como proceso hijo, se conecta con el cliente MCP y
 * comprueba que las herramientas responden. Es la verificación de que el
 * motor es consumible por un agente cualquiera, no solo por el CLI.
 *
 * Se comprueban los dos modos de superficie:
 *   * por defecto, solo la Fase 1 (`memory_query`, `memory_status`);
 *   * con `PALACE_TOOLS=all`, la superficie completa (Fases 2 y 3).
 *
 *   node --experimental-strip-types scripts/palace-engine/test-mcp.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, deleteNode, openDb } from "./db.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, "server.ts");
const TASTE_DECISIONS = join(resolve(HERE, "..", ".."), ".commandcode", "taste", "decisions.md");

/** Ejecuta una comprobación y anota el resultado. */
let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  const mark = ok ? "OK  " : "FALLO";
  process.stdout.write(`[${mark}] ${label}${detail ? ` — ${detail}` : ""}\n`);
  if (!ok) failures++;
}

/** Conecta con el servidor MCP y devuelve el cliente. */
async function connect(env: Record<string, string> = {}): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--experimental-strip-types", SERVER],
    cwd: resolve(HERE, "..", ".."),
    stderr: "pipe",
    env: { ...process.env, ...env } as Record<string, string>,
  });
  const client = new Client({ name: "palace-smoke-test", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

/** Ejecuta la batería de comprobaciones de la Fase 1. */
async function checkPhase1(client: Client): Promise<void> {
  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  check("expone memory_query", names.includes("memory_query"), names.join(", "));
  check("expone memory_status", names.includes("memory_status"));

  // --- memory_query: criterios WCAG ------------------------------------------
  const wcag = await client.callTool({
    name: "memory_query",
    arguments: { query: "criterios de aceptación WCAG", limit: 8 },
  });
  const wcagText = (wcag.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  check("memory_query responde", wcagText.length > 0);
  const wcagPayload = JSON.parse(wcagText) as {
    count: number;
    results: Array<{ path: string }>;
  };
  check("memory_query devuelve resultados", wcagPayload.count > 0, `${wcagPayload.count} resultados`);
  check(
    "memory_query alcanza review_accessibility_wcag.md",
    wcagPayload.results.some((r) => r.path === "docs/review_accessibility_wcag.md"),
    wcagPayload.results.map((r) => r.path).join(", "),
  );

  // Consulta dirigida a los hallazgos del review: aquí el documento debe
  // encabezar la lista.
  const findings = await client.callTool({
    name: "memory_query",
    arguments: { query: "skip navigation link bypass keyboard focus trap modal", limit: 3 },
  });
  const findingsText = (findings.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  const findingsPayload = JSON.parse(findingsText) as { results: Array<{ path: string }> };
  check(
    "memory_query encabepa con los hallazgos de accesibilidad WCAG",
    findingsPayload.results[0]?.path === "docs/review_accessibility_wcag.md",
    findingsPayload.results.map((r) => r.path).join(", "),
  );

  // --- memory_query: identificador exacto ------------------------------------
  const epc = await client.callTool({
    name: "memory_query",
    arguments: { query: "EPC-02", scope: "doc", limit: 3 },
  });
  const epcText = (epc.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  const epcPayload = JSON.parse(epcText) as { count: number };
  check("memory_query encuentra el ticket EPC-02", epcPayload.count > 0, `${epcPayload.count} resultados`);

  // --- memory_status ---------------------------------------------------------
  const status = await client.callTool({ name: "memory_status", arguments: {} });
  const statusText = (status.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  const statusPayload = JSON.parse(statusText) as { chunks: number; nodes: number };
  check("memory_status informa del índice", statusPayload.chunks > 0, `${statusPayload.nodes} nodos`);

}

async function main(): Promise<void> {
  // --- Superficie por defecto: completa (Fases 1, 2 y 3) ---------------------
  const client = await connect();
  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  check(
    "la superficie por defecto incluye las cuatro herramientas",
    ["memory_query", "memory_status", "memory_trace", "memory_record_decision"].every((n) =>
      names.includes(n),
    ),
    names.join(", "),
  );
  await checkPhase1(client);

  const trace = await client.callTool({
    name: "memory_trace",
    arguments: { entity: "components/menu/MenuPublicView.tsx", depth: 2 },
  });
  const traceText = (trace.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  const tracePayload = JSON.parse(traceText) as {
    resolved: { path: string } | null;
    tests: unknown[];
    requirements: unknown[];
  };
  check(
    "memory_trace resuelve MenuPublicView.tsx",
    tracePayload.resolved?.path === "components/menu/MenuPublicView.tsx",
    tracePayload.resolved?.path ?? "sin resolver",
  );
  check("memory_trace devuelve subgrafo", Array.isArray(tracePayload.tests));

  // La prueba escribe una decisión real: se guarda el estado previo para
  // restaurarlo al terminar y no dejar artefactos en el repositorio.
  const tasteBefore = existsSync(TASTE_DECISIONS) ? readFileSync(TASTE_DECISIONS, "utf8") : null;

  const decision = await client.callTool({
    name: "memory_record_decision",
    arguments: {
      context: "Prueba de humo de memory_record_decision.",
      decision: "La decisión se persiste, se enlaza en el grafo y se indexa.",
      tags: ["verificacion"],
      relatedFiles: ["scripts/palace-engine/server.ts"],
    },
  });
  const decisionText = (decision.content as Array<{ type: string; text?: string }>)[0]?.text ?? "";
  const decisionPayload = JSON.parse(decisionText) as { id: string; tasteFile: string };
  check("memory_record_decision devuelve un episodio", decisionPayload.id.startsWith("decision:"), decisionPayload.id);

  await client.close();

  // Limpieza del artefacto de prueba. Se hace con el servidor ya cerrado para
  // que la conexión vea los cambios que escribió el proceso hijo.
  const db = openDb();
  deleteNode(db, decisionPayload.id);
  db.prepare("DELETE FROM episodes WHERE id = ?").run(decisionPayload.id);
  closeDb();

  if (tasteBefore === null) {
    rmSync(TASTE_DECISIONS, { force: true });
  } else {
    writeFileSync(TASTE_DECISIONS, tasteBefore, "utf8");
  }

  // --- Superficie restringida: solo Fase 1 -----------------------------------
  const phase1 = await connect({ PALACE_TOOLS: "phase1" });
  const phase1Names = (await phase1.listTools()).tools.map((t) => t.name).sort();
  check(
    "PALACE_TOOLS=phase1 restringe la superficie",
    !phase1Names.includes("memory_trace") && !phase1Names.includes("memory_record_decision"),
    phase1Names.join(", "),
  );
  await phase1.close();

  process.stdout.write(
    failures === 0 ? "\nTodas las comprobaciones pasaron.\n" : `\n${failures} comprobación(es) fallaron.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`Error: ${(err as Error).message}\n`);
  process.exit(1);
});
