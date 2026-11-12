# Modelos de Embedding Compatibles con LiteRT

Sí, puedes ejecutar modelos de embedding de forma **100% local y offline** utilizando el motor LiteRT (anteriormente TensorFlow Lite). Esto encaja perfectamente con la filosofía de un motor autónomo y sin latencia de red.

Dado que ya tienes infraestructura en `lib/ai/litert.ts`, aquí tienes los mejores modelos que puedes exportar a formato `.tflite` para este propósito:

## 1. Universal Sentence Encoder (USE) - TFLite (Recomendado)
Es el modelo clásico de Google, altamente optimizado para extracción de características de texto en dispositivos móviles y Edge.
*   **Dimensiones:** 512 (Tendrás que configurar `sqlite-vec` como `float[512]`).
*   **Ventaja:** Hay versiones oficiales pre-empaquetadas en TensorFlow Hub/Kaggle específicamente diseñadas para TFLite. Es extremadamente rápido.
*   **Integración:** La forma más moderna de usarlo con LiteRT en Node.js/TypeScript es a través de la librería **MediaPipe Text Embedder** (que corre LiteRT por debajo).

## 2. all-MiniLM-L6-v2 (Convertido a TFLite)
Es el rey indiscutible del Open Source para RAG ligero.
*   **Dimensiones:** 384 (Ahorra aún más espacio en tu base de datos SQLite).
*   **Ventaja:** Pesa menos de 90MB, tiene una precisión semántica excepcional para su tamaño y es muy fácil de convertir a `.tflite` o usar vía ONNX si decides abrir el abanico.
*   **Integración:** Requiere pasar el modelo de PyTorch/HuggingFace a TFLite mediante un script de conversión estándar de TensorFlow.

## 3. MobileBERT (Feature Extractor)
*   **Dimensiones:** Típicamente 512 o 768 dependiendo de la capa final.
*   **Ventaja:** Mayor comprensión contextual que USE puro, aunque un poco más pesado en RAM.

---

### Impacto en la Base de Datos (Nexo-Palace Engine)
Si decides usar LiteRT con el modelo **USE**, el esquema de la tabla vectorial en tu script `palace-engine.ts` deberá reflejar el tamaño exacto del vector de salida. El código comentado se actualizaría así:

```sql
-- Si usas Universal Sentence Encoder (USE)
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
  id TEXT PRIMARY KEY,
  embedding float[512]
);

-- Si usas all-MiniLM-L6-v2
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
  id TEXT PRIMARY KEY,
  embedding float[384]
);
```

### Recomendación Técnica
La vía de menor resistencia para tu stack TypeScript actual es usar el paquete `@mediapipe/tasks-text`. Este paquete incluye la tarea `TextEmbedder`, que carga un modelo `.tflite` (como Universal Sentence Encoder) y te devuelve el array de *floats* listo para insertar en `sqlite-vec`, abstrayéndote de la complejidad matemática de los tensores.