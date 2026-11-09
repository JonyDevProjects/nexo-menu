# Compresión de Imágenes en Nexo Menu

Este proyecto implementa **dos estrategias de compresión diferentes**, cada una optimizada para un propósito distinto. No son intercambiables.

---

## 1. Dish Image Compressor (US-101 / EPC-01)

**Archivo:** `lib/utils/dishImageCompressor.ts`  
**Uso:** Fotos individuales de platos dentro del MenuEditor admin.  
**Componente que lo invoca:** `components/admin/MenuEditor.tsx` → `handleDishPhotoUpload()`

### Características

| Atributo | Valor |
|----------|-------|
| **Formato de salida** | WebP (fallback a JPEG si Canvas no soporta `toDataURL("image/webp")`) |
| **Resolución máxima** | 1200×800 px (mantiene aspect-ratio) |
| **Tamaño objetivo** | < 100 KB |
| **Calidad inicial** | 0.82 (WebP), decreciente por pasos de 0.1 hasta 0.45 |
| **Estrategia** | **Iterativa:** ajusta calidad en bucle `while(sizeKb > 100)` hasta alcanzar target |
| **Canvas API** | Sincrona en hilo principal (no usa Web Workers — *planned*) |
| **Formatos aceptados** | JPEG, PNG, WebP, JPG |

### Proceso

1. Leer archivo como DataURL con FileReader
2. Redimensionar manteniendo aspect-ratio a máximo 1200×800
3. Dibujar en Canvas con fondo blanco (para manejar PNG transparentes)
4. Exportar como WebP con calidad 0.82
5. Si supera 100 KB → reducir calidad en pasos de 0.1 hasta 0.45 o límite alcanzado
6. Retornar DataURL comprimida

---

## 2. Image Uploader (Multi-carta)

**Archivo:** `components/admin/ImageUploader.tsx`  
**Uso:** Subida masiva de fotos de cartas/pizarras completas para procesamiento AI.  
**Flujo:** Selecciona imágenes → las envía al pipeline Gemini extraction (vía `app/actions/ai.ts`).

### Características

| Atributo | Valor |
|----------|-------|
| **Formato de salida** | JPEG exclusivamente |
| **Resolución máxima** | 1536×1536 px (por dimensión mayor entre ancho y alto) |
| **Tamaño objetivo** | Sin límite explícito |
| **Calidad** | Fija en 0.82, sin iteración |
| **Estrategia** | **Single-pass:** un solo resize + export JPEG |
| **Máximo de imágenes** | Configurables vía prop `maxImages` (default: 3) |
| **Captura nativa** | Soporta `capture="environment"` (cámara trasera del dispositivo) |

### Proceso

1. Permitir selección múltiple o captura directa desde cámara
2. Para cada imagen: resize a máximo 1536px en la dimensión más larga
3. Exportar directamente como JPEG con calidad 0.82
4. Mostrar miniaturas con opción de eliminar antes de enviar al backend

---

## Comparación Rápida

| Aspecto | Dish Compressor | Image Uploader |
|---------|----------------|----------------|
| **Propósito** | Foto de plato individual (vista pública) | Carta completa (input para AI extraction) |
| **Formato** | WebP → JPEG fallback | JPEG |
| **Compresión** | Iterativa (< 100 KB target) | Single-pass (calidad fija 0.82) |
| **Resolución** | 1200×800 | 1536×1536 |
| **¿En qué flujo se usa?** | Editor → guardado en menú → vista pública `/m/[slug]` | Home page → subida → Gemini extraction → editor de resultados |

---

## Notas Técnicas

- Ambas usan `Canvas API` en **hilo principal**. La especificación menciona Web Workers como mejora future (#D2 en drift report).
- El Dish Compressor fue añadido en **EPC-01** (mergeada).
- El Image Uploader era parte del flujo pre-EPC-01 para subir cartas completas a extraer con IA.
