# Decisiones

> Registro de decisiones de arquitectura tomadas durante la ejecución de las skills EGM.
> Este fichero lo mantiene el Nexo-Palace Engine a través de `memory_record_decision`.


### 2026-11-12 — embeddings, motor, litert
* **Contexto:** El motor necesitaba un proveedor de embeddings. La API de Gemini funciona pero tiene una cuota diaria de 1000 peticiones que ya agotó la indexación en varias ocasiones, y añade ~570 ms de latencia por consulta.
* **Decisión:** Se adopta LiteRT local (nomic-embed-text sobre el servicio LiteRT/Ollama) como proveedor por defecto: empata con Gemini Embedding 2 en precisión top-1, es ~23 veces más rápido, indexa 28 veces más rápido y no consume cuota. Gemini Embedding 2 se conserva como opción explícita cuando importa la cobertura en top-5. La vía TFLite directa en Node (@mediapipe/tasks-text, @tensorflow/tfjs-tflite) se descarta por no ser viable en Node.
* **Archivos relacionados:** scripts/palace-engine/embedder.ts, scripts/litert-service.ts, scripts/palace-engine/bench.ts
* **Episodio:** `decision:2026-11-12T09-44-18-523Z`
