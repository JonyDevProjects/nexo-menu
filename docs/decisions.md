# Decisiones

> Registro de decisiones de arquitectura tomadas durante la ejecución de las skills EGM.
> Este fichero lo mantiene el Nexo-Palace Engine a través de `memory_record_decision`.


### 2026-11-15 — test, ci, localstore
* **Contexto:** Aislamiento de tests en localStore y CI gate
* **Decisión:** Se expone _resetStoreForTesting() para garantizar aislamiento determinista en tests unitarios, se incorpora Test 6 para certificar el graceful fallback en disco read-only (Serverless/Docker), y se hace obligatorio npm test en CI
* **Archivos relacionados:** lib/data/localStore.ts, tests/unit/localstore.test.ts, .github/workflows/ci.yml
* **Episodio:** `decision:2026-11-15T21-34-50-400Z`
