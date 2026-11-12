# Nexo-Palace Engine

Motor de memoria del proyecto `nexo-menu`. Convierte la documentación, el
código y las convenciones del repositorio en un índice híbrido (semántico +
léxico) y un grafo de trazabilidad, y los expone como servidor MCP para que
los agentes consulten lo que el proyecto ya sabe en lugar de releer ficheros
linealmente.

Todo es local: un único fichero SQLite, sin servicios en la nube.

## Arranque rápido

```bash
npm install                # dependencias del motor (better-sqlite3, sqlite-vec, MCP SDK, ts-morph)
npm run palace:index       # indexa docs/, .commandcode/taste/ y el código; construye el grafo
npm run palace -- query "criterios de aceptación WCAG"
npm run palace -- trace "components/menu/MenuPublicView.tsx"
npm run palace:test        # prueba de humo del servidor MCP
npm run palace:bench       # comparativa de proveedores de embeddings
```

El índice vive en `palace/nexo-memory.sqlite3` (ignorado por git).

Para embeddings locales hay que levantar antes el motor de inferencia:

```bash
ollama serve
ollama pull nomic-embed-text
npm run litert:serve
```

Sin nada de eso, el motor funciona igual: usa el proveedor offline (léxico) y
lo deja registrado en `meta.embedding_provider`.

## Superficie de herramientas

El servidor MCP expone las cuatro herramientas por defecto. Para restringirlo a
la Fase 1 (indexación híbrida y búsqueda) mientras se valida:

```bash
PALACE_TOOLS=phase1 npm run palace:mcp
```

| Herramienta | Fase | Qué hace |
| :--- | :--- | :--- |
| `memory_query(query, scope?, limit?, pathPrefix?)` | 1 | Búsqueda híbrida sobre documentación, código, tests y taste. |
| `memory_status()` | 1 | Estado del índice: nodos, fragmentos, vectores y proveedor de embeddings. |
| `memory_trace(entity, depth?)` | 2 | Subgrafo de trazabilidad de un archivo o símbolo: requisitos, tests, documentos, convenciones y dependencias. |
| `memory_record_decision(context, decision, tags?, relatedFiles?)` | 3 | Persiste una decisión y la enlaza en el grafo y en `.commandcode/taste/`. |

El CLI expone los mismos comandos para agentes sin soporte MCP:
`palace query|trace|drift|decide|stats`.

## Herramientas MCP

El servidor corre sobre `stdio`:

```bash
npm run palace:mcp
```

Registro para clientes MCP en `.mcp.json`:

```json
{
  "mcpServers": {
    "nexo-palace": {
      "command": "node",
      "args": ["--experimental-strip-types", "scripts/palace-engine/server.ts"]
    }
  }
}
```

## Cómo funciona

### 1. Indexación documental

`ingest-docs.ts` recorre `docs/` y `.commandcode/taste/`, trocea cada Markdown
por su jerarquía de encabezados y extrae los metadatos.

El corpus de este repositorio no usa YAML frontmatter, así que el parser
acepta frontmatter si existe y, si no, deduce los metadatos del encabezado del
documento (`**Date:**`, `**Status:**`, líneas `Clave: valor` separadas por `|`).

El estado de cada requisito se resuelve con la evidencia más fuerte
disponible, en este orden:

1. La columna de estado de las tablas de estado (`| Epic ID | … | Estado
   Operativo | … |`).
2. El estado heredado de la épica que contiene la historia de usuario.
3. El estado del documento.

Esto importa: en `docs/especificacion_backlog_v1.1.md` la misma épica aparece
como la activa en el texto y como "en espera" en otro punto. La tabla gana.

### 2. Grafo de trazabilidad

`extract-code.ts` recorre `app/`, `components/`, `lib/` y los directorios de
test con `ts-morph` y construye un grafo dirigido:

| Relación | Origen | Evidencia |
| :--- | :--- | :--- |
| `contains` | archivo → símbolo | declaración exportada |
| `implements` | símbolo → requisito | ID de épica en un comentario del símbolo (`EPC-01`, `US-101`) |
| `tests` | test → módulo | import estático o dinámico del test |
| `depends_on` | módulo → módulo | imports reales, resueltos con el alias `@/*` |
| `references` | documento → código | el documento cita la ruta del archivo |
| `governed_by` | taste → código | la convención cita la ruta del archivo |

El grafo se apoya solo en evidencia observable: rutas citadas, imports reales e
identificadores en comentarios. Una relación que no se puede señalar no se
declara.

`memory_trace` distingue lo directo de lo transitivo: cada elemento lleva su
`distance` en saltos, y `dependencies` y `dependents` solo incluyen enlaces de
distancia 1.

### 3. Búsqueda híbrida

`query.ts` combina tres señales y las fusiona con Reciprocal Rank Fusion:

- **BM25** sobre FTS5, para identificadores exactos (`EPC-02`, `MenuEditor`).
- **Coincidencia literal** de identificadores, que sobrevive a la tokenización
  de FTS5 y a los acentos.
- **Vecindad vectorial** (KNN de `sqlite-vec`).

### 4. Memoria decisional y deriva

`memory_record_decision` guarda la decisión en la tabla `episodes`, crea su
nodo en el grafo, la indexa con embeddings y deja constancia en
`.commandcode/taste/decisions.md` — dentro del directorio de taste que el
indexador ya recorre, de modo que la decisión queda versionada junto al
código y el indexador la recoge en la siguiente pasada.

`npm run palace -- drift` compara los archivos modificados según Git con los
requisitos enlazados a ese código, marca los afectados como `NEEDS_REVIEW` y
registra el evento.

## Proveedor de embeddings

La capa de vectores es enchufable. Hay tres proveedores reales y uno de
respaldo:

| Proveedor | Qué es | Dim | Requiere |
| :--- | :--- | :--- | :--- |
| `litert` | **LiteRT local** — el servicio `scripts/litert-service.ts` con `nomic-embed-text` sobre Ollama/Metal | 768 | Ollama + modelo descargado + el servicio local |
| `gemini` | API de Google (`gemini-embedding-001` o `gemini-embedding-2-preview`) | 768 | `GEMINI_API_KEY` y cuota |
| `ollama` | Ollama directo, sin pasar por el servicio LiteRT | según modelo | Ollama en marcha |
| `offline` | hash-TF-IDF determinista, sin red | 384 | nada |

### LiteRT local (por defecto)

Es el motor que el proyecto ya usaba para visión y razonamiento, ampliado a
embeddings. `scripts/litert-service.ts` expone ahora `/v1/embeddings` con la
misma forma que la API de OpenAI, y delega el cálculo en el motor de inferencia
local.

```bash
# 1. El daemon de inferencia local, con un modelo de embedding descargado
ollama serve
ollama pull nomic-embed-text

# 2. El servicio LiteRT (visión, razonamiento y embeddings)
npm run litert:serve

# 3. Indexar
npm run palace:index
```

Configuración (`.env`):

```
LITERT_EMBED_URL=http://127.0.0.1:11435
LITERT_EMBEDDING_MODEL=nomic-embed-text
```

El orden de resolución en modo `auto` es **LiteRT → Gemini → Ollama → offline**.
Se puede forzar con `PALACE_EMBED_PROVIDER` (`litert`, `gemini`, `ollama`,
`offline`) o `PALACE_EMBED_MODEL`.

> El cambio de proveedor **no** se hace en silencio. Aunque dos modelos tengan
> la misma dimensión (LiteRT `nomic-embed-text` y Gemini `embedding-001` usan
> 768), sus vectores no son comparables entre sí, así que el motor rechaza
> reindexar con otro proveedor salvo que se indique explícitamente
> (`--provider <nombre>`), que es lo que autoriza reconstruir la tabla
> vectorial.

### Comparativa medida

`npm run palace:bench` construye un índice por proveedor (en su propia base) y
lanza el mismo conjunto de consultas contra cada uno. Sobre este repositorio,
con 8 consultas que cubren paráfrasis, identificadores exactos y código:

| Proveedor | top-1 (híbrido) | top-5 (híbrido) | top-1 (solo vector) | top-5 (solo vector) | Indexación | Latencia |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **LiteRT local** (`nomic-embed-text`) | 2/8 | 4/8 | **4/8** | 4/8 | **7,8 s** | **24 ms** |
| Gemini Embedding 2 preview | 3/8 | 5/8 | **4/8** | **6/8** | 214 s | 566 ms |
| Offline hash-TF-IDF | 3/8 | 5/8 | 3/8 | 5/8 | 1 s | 2 ms |

Cómo leerlo:

- **LiteRT iguala a Gemini Embedding 2 en precisión (top-1) y es ~23 veces más
  rápido**, con una indexación 28 veces más corta y sin cuota que agotar.
- **Gemini Embedding 2 gana en cobertura (top-5): 6/8 frente a 4/8.** Si lo que
  importa es que el agente reciba más candidatos de contexto para elegir, Gemini
  aporta más.
- La búsqueda híbrida amortigua la diferencia: el pie léxico (BM25 y coincidencia
  literal) hace mucho trabajo, y por eso los tres proveedores rinden parecido
  en modo híbrido.
- El proveedor offline no es solo un respaldo: en este corpus rindió como los
  otros. Sirve cuando no hay red, pero no capta paráfrasis.

**Recomendación:** LiteRT local como proveedor por defecto —es local, no
consume cuota y responde en milisegundos—, y Gemini Embedding 2 cuando se
necesite cobertura y haya cuota disponible:

```bash
npm run palace:index -- --provider gemini --model gemini-embedding-2-preview
```

### Sobre ejecutar modelos `.tflite` en Node

El informe de `scripts/litert_embedding_models.md` propone ejecutar un modelo
Universal Sentence Encoder en formato `.tflite` con `@mediapipe/tasks-text`.
Se comprobó en esta máquina y **no es viable en Node tal cual**:

- `@mediapipe/tasks-text` está compilado para navegador. El cargador WASM
  necesita `document`, `importScripts` y un ámbito de navegador; con un shim
  mínimo llega a cargar el fileset, pero la instanciación del grafo no
  termina nunca en Node.
- `@tensorflow/tfjs-tflite` (la otra vía TFLite) carga el backend WASM, pero la
  promesa de `loadTFLiteModel` tampoco se resuelve.

La ruta que sí funciona es la que usa el motor que el proyecto ya tenía
puesto: el servicio LiteRT sobre el runtime local de inferencia, con
`nomic-embed-text`. Da 768 dimensiones, corre sobre Metal y no necesita
shims de navegador.

### Cuota de la API de Gemini

Dos límites condicionan el uso de la API:

| Límite | Valor | Efecto |
| :--- | :--- | :--- |
| `embed_content_free_tier_requests` por minuto | 100 | Se cubre con un intervalo mínimo entre peticiones (`PALACE_EMBED_MIN_INTERVAL_MS`, 620 ms por defecto). |
| Peticiones de embedding **por día** | 1000 | Es el límite real. La ventana se reinicia pasado un tiempo, y el motor informa de cuándo. |

El endpoint por lotes (`batchEmbedContents`) tiene una cuota más restrictiva y
devuelve 429 con las claves de nivel gratuito, así que el motor usa
peticiones individuales con concurrencia limitada, reintentos con espera
exponencial y respeta la espera que el propio servidor indica.

El motor no falla de forma opaca cuando se agota la cuota diaria: informa del
límite, de la hora de restablecimiento y de que los fragmentos ya indexados
conservan su vector.

### Suministrar una clave de Gemini

El motor lee el `.env` del repositorio (ya está en `.gitignore`). **La clave
nunca debe ir en `.env.example`**: ese fichero está versionado en git.

```bash
# .env
GEMINI_API_KEY=tu-clave-aquí
```

El `.env` del proyecto **tiene prioridad** sobre las variables ya exportadas en
la shell: una clave antigua en la shell no debe dejar de usar una clave válida
del repositorio.

El modelo de embedding se **descubre automáticamente** con `ListModels`, porque
no todas las claves tienen provisionado el mismo catálogo. La preferencia es
`gemini-embedding-001`, luego `text-embedding-004`, y por último la versión
`preview` disponible. Se puede forzar con `PALACE_EMBED_MODEL`.

### Reindexación incremental

Cada fragmento guarda el hash de su contenido. En la siguiente indexación solo
se embeben los fragmentos cuyo texto ha cambiado o que aún no tienen vector;
el resto conserva su embedding. Una reindexación sin cambios no llama a la
API:

```bash
npm run palace:index   # primera vez: ~5 min (Gemini) o ~8 s (LiteRT)
npm run palace:index   # sin cambios: segundos, 0 peticiones a la API
```

Para pasar opciones al CLI a través de npm hay que usar `--`:

```bash
npm run palace:index -- --provider litert
npm run palace -- query "alérgenos" --scope doc --limit 5
```

### Coste en cuota de una indexación completa

Un indexado completo son ~250 peticiones: los fragmentos de menos de 160
caracteres se dejan solo en el índice léxico, porque no aportan valor semántico
y consumen cuota. Con el límite gratuito de 1000 peticiones diarias caben unas
tres indexaciones completas al día; con la reindexación incremental, las
actualizaciones habituales cuestan solo los fragmentos modificados.

## Esquema

Un único fichero SQLite, `palace/nexo-memory.sqlite3`:

| Tabla | Contenido |
| :--- | :--- |
| `nodes` | Entidades: documentos, código, tests, símbolos, requisitos, taste, decisiones. |
| `edges` | Grafo de trazabilidad (`implements`, `tests`, `depends_on`, `references`…). |
| `chunks` | Fragmentos indexables con su `header_path` y sus requisitos. |
| `chunks_fts` | Índice FTS5 (BM25). |
| `chunks_vec` | Índice vectorial (`sqlite-vec`). |
| `episodes` | Decisiones registradas. |
| `drift_events` | Eventos de deriva detectados. |
| `meta` | Parámetros del build del índice (dimensión, proveedor, fecha). |

## Integración con las skills EGM

| Skill | Punto de integración |
| :--- | :--- |
| `egm-brainstorm` | Paso 0: consulta `memory_query` antes de proponer, y trata los requisitos `done` / `on_hold` / `NEEDS_REVIEW` como restricciones. |
| `egm-draft` | Paso 0: traza con `memory_trace` los archivos que va a tocar, para conocer requisitos, tests y dependencias ocultas. |
| `egm-resolve` | Paso 4.5: registra con `memory_record_decision` la decisión que cierra la resolución. |
| `egm-drift-report` | Usa `palace -- drift` como fuente autoritativa de deriva. |

## Limitaciones conocidas

- Los tests de Playwright (`e2e/`) no importan componentes: ejercitan rutas.
  No generan aristas `tests` salvo que importen el módulo.
- La arista `implements` exige que el código cite el ID del requisito. Un
  módulo implementando un requisito sin citarlo no queda enlazado.
- El proveedor `offline` no captura paráfrasis: solo solapamiento de términos.
- `memory_trace` no resuelve ambigüedades por sí solo: cuando hay varios
  candidatos devuelve la lista en `candidates` en lugar de elegir uno.
- El modelo local `nomic-embed-text` es de 2024 y está entrenado sobre texto en
  inglés: con el corpus en español rinde por debajo de Gemini Embedding 2 en
  cobertura (top-5), aunque empata en precisión.
- Los fragmentos de menos de 160 caracteres no se embeben. Siguen siendo
  recuperables por la vía léxica, pero no aparecen en los resultados que solo
  usan la señal vectorial.
- Ejecutar modelos `.tflite` con LiteRT en Node no funciona con las librerías
  de navegador (`@mediapipe/tasks-text`, `@tensorflow/tfjs-tflite`); la vía
  viable es el servicio LiteRT sobre el runtime local de inferencia.
