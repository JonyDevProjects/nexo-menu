/**
 * ==============================================================================
 * NEXO MENU - CLIENT DISH IMAGE COMPRESSOR (US-101 / EPC-01)
 * Compresión WebP en cliente mediante Canvas API para 0 coste de servidor.
 * Garantiza imágenes < 100 KB con resolución máxima de 1200x800 px.
 * ==============================================================================
 */

export interface CompressionResult {
  success: boolean;
  dataUrl?: string;
  sizeKb?: number;
  width?: number;
  height?: number;
  format?: string;
  error?: string;
}

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 800;
const TARGET_MAX_KB = 100;
const INITIAL_QUALITY = 0.82;

export async function compressDishPhoto(file: File): Promise<CompressionResult> {
  // 1. Validar tipo de archivo permitido
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (!validTypes.includes(file.type.toLowerCase())) {
    return {
      success: false,
      error: "Por favor, selecciona una imagen válida (JPG, PNG o WEBP).",
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onerror = () => {
      resolve({
        success: false,
        error: "Error al leer el archivo de imagen en el dispositivo.",
      });
    };

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onerror = () => {
        resolve({
          success: false,
          error: "El archivo seleccionado no es una imagen válida o está dañado.",
        });
      };

      img.onload = () => {
        try {
          // 2. Calcular dimensiones respetando aspect-ratio
          let { width, height } = img;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const widthRatio = MAX_WIDTH / width;
            const heightRatio = MAX_HEIGHT / height;
            const bestRatio = Math.min(widthRatio, heightRatio);

            width = Math.round(width * bestRatio);
            height = Math.round(height * bestRatio);
          }

          // 3. Renderizar en Canvas
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({
              success: false,
              error: "No se pudo inicializar el contexto de dibujo Canvas.",
            });
            return;
          }

          // Fondo blanco para manejar PNGs transparentes limpiamente
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // 4. Compresión iterativa en WebP hasta estar bajo el límite de 100 KB
          let quality = INITIAL_QUALITY;
          let dataUrl = canvas.toDataURL("image/webp", quality);
          let format = "image/webp";

          // Fallback a JPEG si el navegador no soporta exportación WebP en Canvas
          if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", quality);
            format = "image/jpeg";
          }

          let sizeBytes = Math.round((dataUrl.length * 3) / 4);
          let sizeKb = Math.round((sizeBytes / 1024) * 10) / 10;

          // Si supera 100 KB, ajustar calidad de forma decreciente
          while (sizeKb > TARGET_MAX_KB && quality > 0.45) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL(format, quality);
            sizeBytes = Math.round((dataUrl.length * 3) / 4);
            sizeKb = Math.round((sizeBytes / 1024) * 10) / 10;
          }

          resolve({
            success: true,
            dataUrl,
            sizeKb,
            width,
            height,
            format,
          });
        } catch (err: any) {
          resolve({
            success: false,
            error: err.message || "Error inesperado durante la compresión.",
          });
        }
      };
    };

    reader.readAsDataURL(file);
  });
}
