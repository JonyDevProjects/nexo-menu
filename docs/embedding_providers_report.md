# Comparativa de proveedores de embeddings — Nexo-Palace

**Fecha:** 2026-11-12
**Alcance:** evaluación de las opciones de embedding local con el motor LiteRT frente a las ya implementadas (API de Gemini y proveedor offline léxico).
**Reproducible con:** `npx nexo-palace bench` desde el repositorio de la herramienta (`nexo-palace`), que construye un índice por proveedor y lanza el mismo conjunto de consultas.

## Conclusión

**LiteRT local (`nomic-embed-text`) se adopta como proveedor por defecto.** Empató con Gemini Embedding 2 en precisión (top-1) con una latencia 23 veces menor, indexa 28 veces más rápido y no consume cuota. Gemini Embedding 2 se mantiene como opción explícita cuando importa la cobertura de candidatos (top-5).

## Qué se comprobó

### La vía TFLite directa en Node no es viable

El informe de `scripts/litert_embedding_models.md` propone ejecutar un modelo Universal Sentence Encoder `.tflite` con `@mediapipe/tasks-text`. Se probó en esta máquina (Node 24, darwin arm64) y **no funciona**:

| Enfoque | Resultado |
| :--- | :--- |
| `@mediapipe/tasks-text` + USE float32 | El bundle es de navegador. Con un shim mínimo (`document`, `importScripts`, `require`, `__dirname`) carga el fileset, pero la instanciación del grafo WASM **no termina nunca** en Node. |
| `@tensorflow/tfjs-tflite` + USE float32 | El backend WASM de tfjs arranca (`setBackend("wasm")` correcto), pero `loadTFLiteModel()` **deja la promesa sin resolver**. |

El modelo USE sí se puede descargar (6 MB desde `storage.googleapis.com/mediapipe-models`), y `@mediapipe/tasks-text` está publicado en npm. El bloqueo es el runtime, no el modelo.

### La vía viable: el motor que el proyecto ya tenía

`scripts/litert-service.ts` ya era el servicio local del proyecto (visión y razonamiento, delegando en el runtime de inferencia local sobre Metal). Se le ha añadido `/v1/embeddings` con la forma de la API de OpenAI:

```bash
ollama serve
ollama pull nomic-embed-text
npm run litert:serve
```

## Resultados medidos

8 consultas que cubren paráfrasis sin vocabulario literal, identificadores exactos, y recuperación de código y de especificación.

| Proveedor | top-1 (híbrido) | top-5 (híbrido) | top-1 (solo vector) | top-5 (solo vector) | Indexación | Latencia |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **LiteRT local** (`nomic-embed-text`, 768d) | 2/8 | 4/8 | **4/8** | 4/8 | **7,8 s** | **24 ms** |
| Gemini Embedding 2 preview (768d) | 3/8 | 5/8 | **4/8** | **6/8** | 214 s | 566 ms |
| Offline hash-TF-IDF (384d, léxico) | 3/8 | 5/8 | 3/8 | 5/8 | 1 s | 2 ms |

## Lectura de los resultados

- **Precisión:** LiteRT y Gemini Embedding 2 empatan en top-1 (4/8). El modelo local es de 2024 y está entrenado sobre texto en inglés; con un corpus en español no llega al nivel de cobertura de Gemini (4/8 frente a 6/8 en top-5).
- **Latencia:** 24 ms frente a 566 ms. La diferencia es el viaje de red por consulta, y se nota en un agente que consulta la memoria en cada paso de una tarea.
- **Cosquota:** Gemini Embedding 2 consume una petición por fragmento. Con el límite gratuito de 1000 peticiones diarias, una indexación completa son ~250 peticiones: caben unas tres al día, y cualquier reindexación las gasta. La reindexación incremental (hash de contenido por fragmento) reduce el coste al texto realmente cambiado, pero la cuota sigue siendo el cuello de botella.
- **Por qué el modo híbrido iguala a todos:** el pie léxico (BM25 de FTS5 y coincidencia literal de identificadores) resuelve la mayoría de las consultas por su cuenta. La diferencia entre modelos se ve al aislar la señal vectorial (`mode: "vector"`), donde el orden de calidad es claro.

## Decisiones derivadas

1. **Proveedor por defecto: `litert`.** El orden de resolución en modo `auto` es LiteRT → Gemini → Ollama → offline.
2. **Cambiar de proveedor nunca es automático.** Aunque dos modelos compartan dimensión (LiteRT `nomic-embed-text` y Gemini `embedding-001` usan 768), sus vectores no son comparables. El motor rechaza reindexar con otro proveedor salvo que se indique con `--provider`.
3. **Las consultas usan el proveedor con el que se indexó**, no uno resuelto en el momento. Si ese proveedor no está disponible, la búsqueda vectorial se desactiva con un aviso y la léxica sigue funcionando.
4. **Se conservan los fragmentos sin embedding por ser demasiado cortos** (<160 caracteres) solo en el índice léxico, para no gastar cuota en fragmentos que aportan poco valor semántico.

## Limitaciones de esta evaluación

- 8 consultas es una muestra pequeña: sirve para distinguir providers, no para una evaluación de calidad estadísticamente sólida.
- El corpus está en español y el modelo local no está entrenado para eso. Con un corpus multilingüe o en inglés, la distancia entre LiteRT y Gemini se reduciría.
- El índice se construye sobre el estado del repositorio en esta fecha; cambiar el corpus cambia los números.
