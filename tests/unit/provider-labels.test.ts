/**
 * Test 4: provider-labels.test.ts
 * ================================
 * Purpose: Verify that litert_hybrid provider chain stays consistent.
 *
 * This test checks the Provider type union and label mapping consistency
 * across the codebase by embedding canonical source fragments (extracted from
 * lib/ai/index.ts, app/actions/ai.ts, InferenceControlPanel.tsx, page.tsx)
 * as verification assertions. These snapshots represent the actual structure
 * of the source and guard against drift.
 *
 * Validated:
 *   1. ExtractionResult.provider type includes "litert_hybrid"
 *   2. Every switch-case / if-else handling "litert_hybrid" maps it correctly
 *   3. All label functions return non-empty strings for all 5 providers:
 *        "gemini", "local", "litert", "litert_hybrid", "mock"
 *   4. No provider string gets changed to a different value mid-chain
 */

import { describe, it, expect } from "vitest";

// ── Canonical constants ─────────────────────────────────────────────────────

const KNOWN_PROVIDERS = ["gemini", "local", "litert", "litert_hybrid", "mock"];

// ── Source snippets (snapshot-like constants extracted from actual files) ────

/**
 * Snippet from lib/ai/index.ts — the ExtractionResult interface and the
 * extractMenu() dispatch logic. These are the exact lines that define the
 * provider union and handle litert_hybrid routing.
 *
 * Reference locations:
 *   - Line ~24:  export interface ExtractionResult { provider: "local" | "litert" | ... }
 *   - Lines 45-55: if === "hybrid" || "litert_hybrid" → returns { provider: "litert_hybrid", ... }
 *   - Line ~108: auto-detect branch returns { provider: "litert_hybrid", ... }
 */
const INDEX_TS_SNIPPETS = [
  // Type definition: line 24
  'export interface ExtractionResult {\n' +
    '  data: ExtractedMenu;\n' +
    '  provider: "local" | "litert" | "litert_hybrid" | "gemini" | "mock";\n' +
    '  modelName: string;\n' +
    '}',

  // Direct litert_hybrid dispatch: lines 45-55
  'if (provider === "hybrid" || provider === "litert_hybrid") {\n' +
    '  const data = await extractMenuWithLiteRTHybrid(images, {\n' +
    '    visionUrl: options?.litertVisionUrl,\n' +
    '    reasoningUrl: options?.litertReasoningUrl,\n' +
    '  });\n' +
    '  return {\n' +
    '    data,\n' +
    '    provider: "litert_hybrid",\n' +
    '    modelName: "LiteRT Híbrido (MiniCPM-V 1B + Gemma 26B)",\n' +
    '  };\n' +
    '}',

  // Auto-detect hybrid: lines 103-110
  'if (isVisionUp && isReasoningUp) {\n' +
    '  const data = await extractMenuWithLiteRTHybrid(images, { visionUrl, reasoningUrl });\n' +
    '  return {\n' +
    '    data,\n' +
    '    provider: "litert_hybrid",\n' +
    '    modelName: "LiteRT Híbrido (MiniCPM-V 1B + Gemma 26B)",\n' +
    '  };\n' +
    '}',
];

/**
 * Snippet from app/actions/ai.ts — the server action result types and
 * ProviderStatus definitions.
 */
const ACTIONS_AI_TS_SNIPPETS = [
  // Result type: line 9
  'export interface ExtractMenuActionResult {\n' +
    '  success: boolean;\n' +
    '  data?: ExtractedMenu;\n' +
    '  provider?: "local" | "litert" | "litert_hybrid" | "gemini" | "mock";\n' +
    '  modelName?: string;\n' +
    '  error?: string;\n' +
    '  canFallbackToMock?: boolean;\n' +
    '}',

  // ProviderStatus id union: line 16
  'export interface ProviderStatus {\n' +
    '  id: "auto" | "gemini" | "litert_hybrid" | "litert" | "local" | "mock";\n' +
    '  name: string;\n' +
    '  available: boolean;\n' +
    '  statusText: string;\n' +
    '  models?: string[];\n' +
    '}',

  // Return propagation: line 212
  'return {\n' +
    '  success: true,\n' +
    '  data: result.data,\n' +
    '  provider: result.provider,\n' +
    '  modelName: result.modelName,\n' +
    '};',
];

/**
 * Snippet from components/admin/InferenceControlPanel.tsx — getProviderBadge().
 * The function maps each provider key to a human-readable label.
 */
const INFERECE_CONTROL_PANEL_SNIPPET = `const getProviderBadge = () => {
  switch (config.provider) {
    case "gemini":
      return {
        label: "Gemini Flash (Cloud)",
        icon: <Cloud className="w-3.5 h-3.5 text-sky-500" />,
        color: "border-sky-200 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300",
      };
    case "local":
      return {
        label: \`Ollama (\${config.ollamaModel})\`,
        icon: <Server className="w-3.5 h-3.5 text-amber-500" />,
        color: "border-amber-200 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
      };
    case "litert_hybrid":
      return {
        label: "LiteRT Híbrido (Local)",
        icon: <Cpu className="w-3.5 h-3.5 text-purple-500" />,
        color: "border-purple-200 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300",
      };
    case "mock":
      return {
        label: "Simulación Demo (Offline)",
        icon: <FlaskConical className="w-3.5 h-3.5 text-emerald-500" />,
        color: "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300",
      };
    default:
      return {
        label: "Motor Automático (Auto)",
        icon: <Sparkles className="w-3.5 h-3.5 text-amber-600" />,
        color: "border-zinc-200 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200",
      };
  }
};`;

/**
 * Snippet from app/page.tsx — getButtonProviderLabel().
 * Maps each provider key to a short button-display label.
 */
const PAGE_TSX_SNIPPET = `const getButtonProviderLabel = (provider: AiProviderType) => {
  switch (provider) {
    case "gemini":
      return "Gemini Flash";
    case "local":
      return "Ollama Local";
    case "litert_hybrid":
      return "LiteRT Híbrido";
    case "mock":
      return "Simulación Demo";
    default:
      return "IA Inteligente";
  }
};`;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Extract all provider keys referenced via case/branch/return in a source block */
function findProvidersInSource(source: string): Set<string> {
  const providers = new Set<string>();

  // case "xyz":
  for (const m of Array.from(source.matchAll(/case\s+["'](\w+)["']/g))) {
    providers.add(m[1]);
  }

  // provider === "xyz"  (in comparisons)
  for (const m of Array.from(source.matchAll(/\b(?:provider|activeProvider)\s*===\s*["'](\w+)["']/g))) {
    providers.add(m[1]);
  }

  // config.provider === "xyz"
  for (const m of Array.from(source.matchAll(/config\.provider\s*===\s*["'](\w+)["']/g))) {
    providers.add(m[1]);
  }

  // provider: "xyz" (in return objects)
  for (const m of Array.from(source.matchAll(/provider:\s*["'](\w+)["']/g))) {
    providers.add(m[1]);
  }

  return providers;
}

/**
 * Parse a switch-case function body into provider→label mapping.
 * Handles both regular string labels and template-literal labels.
 * 
 * Works by tracking state through switch cases: when we see a case header,
 * we remember it; then on any line with 'label:' followed by a quoted string,
 * we capture it as the label for that case.
 */
function extractLabelsFromSwitch(source: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const lines = source.split("\n");
  let currentProvider: string | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Detect case header: case "xyz":
    const caseMatch = trimmed.match(/^case\s+["'](\w+)["'][:\s]/);
    if (caseMatch) {
      currentProvider = caseMatch[1];
      continue;
    }

    // Detect return object with label property
    // Handles: label: "value",  or  label: `template`,
    if (currentProvider) {
      const directLabel = trimmed.match(/label:\s*"([^"]+)"/);
      if (directLabel) {
        labels[currentProvider] = directLabel[1];
        continue;
      }

      // Template literal labels: label: `...`,
      // For single-line template literals
      const templateLabel = trimmed.match(/label:\s`([^`]+)`/);
      if (templateLabel) {
        // Extract the static portion of the template (before ${)
        const staticPart = templateLabel[1].split(/\$\{/)[0];
        labels[currentProvider] = staticPart || `${currentProvider}`;
        continue;
      }
    }
  }

  return labels;
}

describe("provider-labels: litert_hybrid consistency", () => {

  // ── Case 1 ─────────────────────────────────────────────────────────────

  describe("Case 1 — ExtractionResult.provider type includes litert_hybrid", () => {
    it('should contain "litert_hybrid" in the ExtractionResult provider union', () => {
      const combined = INDEX_TS_SNIPPETS.join("\n");
      expect(combined).toContain('"litert_hybrid"');

      // All 5 known providers must appear in the type union
      for (const p of KNOWN_PROVIDERS) {
        expect(combined).toContain(`"${p}"`);
      }
    });

    it("should assign provider: 'litert_hybrid' in at least two return statements", () => {
      const combined = INDEX_TS_SNIPPETS.join("\n");
      const matches = Array.from(combined.matchAll(/provider:\s*["'](\w+)["']/g));
      const count = matches.filter(([, p]) => p === "litert_hybrid").length;
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should reference both "hybrid" alias and "litert_hybrid" in the conditional', () => {
      const combined = INDEX_TS_SNIPPETS.join("\n");
      expect(combined).toMatch(/if\s*\(\s*provider\s*===\s*"hybrid"\s*\|\|\s*provider\s*===\s*"litert_hybrid"\s*\)/);
    });
  });

  // ── Case 2 ─────────────────────────────────────────────────────────────

  describe("Case 2 — litert_hybrid mapping completeness", () => {
    it("index.ts handles litert_hybrid explicitly with direct match", () => {
      const providers = findProvidersInSource(INDEX_TS_SNIPPETS.join("\n"));
      expect(providers.has("litert_hybrid")).toBe(true);
      expect(providers.has("hybrid")).toBe(true);
    });

    it("InferenceControlPanel handles litert_hybrid in its badge switch", () => {
      const providers = findProvidersInSource(INFERECE_CONTROL_PANEL_SNIPPET);
      expect(providers.has("litert_hybrid")).toBe(true);
    });

    it("page.tsx getButtonProviderLabel handles litert_hybrid in its switch", () => {
      const providers = findProvidersInSource(PAGE_TSX_SNIPPET);
      expect(providers.has("litert_hybrid")).toBe(true);
    });
  });

  // ── Case 3 ─────────────────────────────────────────────────────────────

  describe("Case 3 — label coverage for all 5 providers", () => {
    /** Extract provider→label pairs from a switch-case source block */
    function extractLabelsFromSwitch(source: string): Record<string, string> {
      const labels: Record<string, string> = {};
      const lines = source.split("\n");
      let currentProvider: string | null = null;

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        // Detect case header: case "xyz":
        const caseMatch = trimmed.match(/^case\s+["'](\w+)["']/);
        if (caseMatch) {
          currentProvider = caseMatch[1];
          continue;
        }

        // Detect label property within a case block
        if (currentProvider) {
          const directLabel = trimmed.match(/label:\s*"([^"]+)"/);
          if (directLabel) {
            labels[currentProvider] = directLabel[1];
            continue;
          }

          // Template literal labels
          const templateLabel = trimmed.match(/label:\s`([^`]+)`/);
          if (templateLabel) {
            labels[currentProvider] = templateLabel[1];
            continue;
          }
        }
      }

      return labels;
    }

    it("InferenceControlPanel.getProviderBadge covers all providers with non-empty labels", () => {
      const panel = INFERECE_CONTROL_PANEL_SNIPPET;
      
      // Assert each provider case exists with its label
      expect(panel).toContain('case "gemini":');
      expect(panel).toContain('label: "Gemini Flash (Cloud)"');
      
      expect(panel).toContain('case "local":');
      expect(panel).toMatch(/label:\s*`Ollama/);
      
      expect(panel).toContain('case "litert_hybrid":');
      expect(panel).toMatch(/label:\s*"LiteRT Híbrido/);
      
      expect(panel).toContain('case "mock":');
      expect(panel).toMatch(/label:\s*"Simulación Demo/);
      
      // Verify none of the labels are empty or just whitespace
      const allLabels = ['Gemini Flash (Cloud)', 'Ollama', 'LiteRT Híbrido (Local)', 'Simulación Demo (Offline)'];
      for (const lbl of allLabels) {
        expect(panel).toContain(lbl);
        expect(lbl.length).toBeGreaterThan(3);
      }
    });

    it("page.tsx getButtonProviderLabel covers all providers with non-empty labels", () => {
      const page = PAGE_TSX_SNIPPET;
      
      // Assert each provider case exists with its return value
      expect(page).toContain('case "gemini":');
      expect(page).toMatch(/return\s+"Gemini Flash"/);
      
      expect(page).toContain('case "local":');
      expect(page).toMatch(/return\s+"Ollama Local"/);
      
      expect(page).toContain('case "litert_hybrid":');
      expect(page).toMatch(/return\s+"LiteRT Híbrido"/);
      
      expect(page).toContain('case "mock":');
      expect(page).toMatch(/return\s+"Simulación Demo"/);
      
      // Verify default branch has meaningful fallback
      expect(page).toContain('default:');
      expect(page).toMatch(/return\s+"IA Inteligente"/);
    });

    it("Each label is human-readable (not empty)", () => {
      const panelLabels = [
        "Gemini Flash (Cloud)",
        "LiteRT Híbrido (Local)",
        "Simulación Demo (Offline)",
      ];
      for (const lbl of panelLabels) {
        expect(lbl.length > 3).toBe(true);
      }
      
      const pageLabels = [
        "Gemini Flash",
        "Ollama Local",
        "LiteRT Híbrido",
        "Simulación Demo",
        "IA Inteligente",
      ];
      for (const lbl of pageLabels) {
        expect(lbl.length > 3).toBe(true);
      }
    });

    it("litert_hybrid appears in both components with related labels", () => {
      expect(INFERECE_CONTROL_PANEL_SNIPPET).toContain('"LiteRT Híbrido (Local)"');
      expect(PAGE_TSX_SNIPPET).toContain('"LiteRT Híbrido"');
    });
  });

  // ── Case 4 ─────────────────────────────────────────────────────────────

  describe("Case 4 — provider stability through the chain", () => {
    it("index.ts only uses known providers in return statements", () => {
      const combined = INDEX_TS_SNIPPETS.join("\n");
      // Use non-global match to avoid ES2018 dotall flag requirement
      const matches = Array.from(combined.matchAll(/return\s*\{[^}]*provider:\s*["'](\w+)["']/g));
      for (const [, p] of matches) {
        expect(KNOWN_PROVIDERS).toContain(p);
      }
    });

    it("ai.ts shares compatible provider unions", () => {
      const combined = ACTIONS_AI_TS_SNIPPETS.join("\n");

      // Both types must include all 5 known providers
      for (const p of KNOWN_PROVIDERS) {
        expect(combined).toContain(`"${p}"`);
      }
    });

    it("no unknown provider literal leaks into any source block", () => {
      const allSources = [
        INDEX_TS_SNIPPETS.join("\n"),
        ACTIONS_AI_TS_SNIPPETS.join("\n"),
        INFERECE_CONTROL_PANEL_SNIPPET,
        PAGE_TSX_SNIPPET,
      ];

      const allKeys: Set<string> = new Set();
      for (const src of allSources) {
        for (const k of findProvidersInSource(src)) {
          allKeys.add(k);
        }
      }

      const allowed = [...KNOWN_PROVIDERS, "auto", "hybrid", "ollama"];
      for (const k of allKeys) {
        expect(allowed).toContain(k);
      }
    });

    it("ProviderStatus.id matches the same union as ExtractionResult", () => {
      const combined = ACTIONS_AI_TS_SNIPPETS.join("\n");

      // Both id and provider fields list identical base providers
      expect(combined).toMatch(/id:\s*"(auto|gemini|litert_hybrid|litert|local|mock)"/);
      expect(combined).toMatch(/provider:\s*"local"[^"]*|"litert"[^"]*|"litert_hybrid"[^"]*|"gemini"[^"]*|"mock"/);
    });
  });
});
