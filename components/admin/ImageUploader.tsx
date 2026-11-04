"use client";

import React, { useRef, useState } from "react";
import { Camera, Upload, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface CompressedImage {
  id: string;
  dataUrl: string;
  file: File;
  previewUrl: string;
}

interface ImageUploaderProps {
  onImagesReady: (images: CompressedImage[]) => void;
  maxImages?: number;
  isLoading?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImagesReady,
  maxImages = 3,
  isLoading = false,
}) => {
  const [images, setImages] = useState<CompressedImage[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1536;
          const MAX_HEIGHT = 1536;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(img.src);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > maxImages) {
      setErrorMsg(`Puedes subir un máximo de ${maxImages} fotos a la vez.`);
      return;
    }

    setIsCompressing(true);
    const newImages: CompressedImage[] = [...images];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;

        const compressedDataUrl = await compressImage(file);
        newImages.push({
          id: `${Date.now()}-${i}-${Math.random()}`,
          dataUrl: compressedDataUrl,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      setImages(newImages);
      onImagesReady(newImages);
    } catch (err) {
      console.error("Error al procesar imágenes:", err);
      setErrorMsg("Ocurrió un error al procesar las fotos. Por favor intenta de nuevo.");
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (id: string) => {
    const updated = images.filter((img) => img.id !== id);
    setImages(updated);
    onImagesReady(updated);
  };

  return (
    <div className="w-full space-y-4">
      {/* Zona táctil principal */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 select-none
          ${
            images.length > 0
              ? "border-amber-400/80 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20"
              : "border-zinc-300 hover:border-amber-500 bg-white dark:bg-zinc-900/60 dark:border-zinc-700"
          }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={isLoading || isCompressing}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
            <Camera className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {images.length === 0
                ? "Haz una foto o sube tu carta"
                : `Añadir otra foto (${images.length}/${maxImages})`}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Soporta fotos de pizarra, carta en papel o menú del día (hasta {maxImages} caras)
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isLoading || isCompressing}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Seleccionar foto
            </Button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 dark:bg-red-950/50 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-900">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Miniaturas de fotos seleccionadas */}
      {images.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Fotos listas para procesar ({images.length}):
          </p>
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, index) => (
              <div
                key={img.id}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 shadow-sm group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.dataUrl}
                  alt={`Cara ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                  Foto {index + 1}
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  disabled={isLoading}
                  className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-red-600 text-white rounded-full transition-colors"
                  aria-label="Eliminar foto"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
