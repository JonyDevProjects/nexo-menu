"use client";

import React, { useState } from "react";
import { ExtractedMenu, ExtractedCategory, ExtractedDish } from "@/lib/types";
import { EU_ALLERGENS } from "@/lib/allergens";
import { AllergenBadge } from "@/components/ui/AllergenBadge";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2, ShieldCheck, Check, Sparkles, Store, Globe } from "lucide-react";

interface MenuEditorProps {
  initialMenu: ExtractedMenu;
  onSave: (payload: {
    restaurantName: string;
    slug: string;
    description: string;
    menu: ExtractedMenu;
    legalConfirmed: boolean;
  }) => Promise<void>;
  isSaving?: boolean;
  provider?: "local" | "litert" | "gemini" | "mock";
  modelName?: string;
}

export const MenuEditor: React.FC<MenuEditorProps> = ({
  initialMenu,
  onSave,
  isSaving = false,
  provider = "local",
  modelName = "IA",
}) => {
  const [menu, setMenu] = useState<ExtractedMenu>(initialMenu);
  const [restaurantName, setRestaurantName] = useState("Mi Restaurante");
  const [slug, setSlug] = useState("mi-restaurante");
  const [description, setDescription] = useState("Tapas, raciones y comida casera.");
  const [legalConfirmed, setLegalConfirmed] = useState(false);
  const [activeAllergenModal, setActiveAllergenModal] = useState<{
    catIdx: number;
    dishIdx: number;
  } | null>(null);

  const handleSlugChange = (val: string) => {
    const clean = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");
    setSlug(clean);
  };

  const updateDish = (
    catIdx: number,
    dishIdx: number,
    field: keyof ExtractedDish,
    value: any
  ) => {
    const updated = { ...menu };
    updated.categories[catIdx].dishes[dishIdx] = {
      ...updated.categories[catIdx].dishes[dishIdx],
      [field]: value,
    };
    setMenu(updated);
  };

  const toggleAllergen = (catIdx: number, dishIdx: number, allergenCode: string) => {
    const updated = { ...menu };
    const current = updated.categories[catIdx].dishes[dishIdx].allergens || [];
    if (current.includes(allergenCode)) {
      updated.categories[catIdx].dishes[dishIdx].allergens = current.filter(
        (c) => c !== allergenCode
      );
    } else {
      updated.categories[catIdx].dishes[dishIdx].allergens = [...current, allergenCode];
    }
    setMenu(updated);
  };

  const removeDish = (catIdx: number, dishIdx: number) => {
    const updated = { ...menu };
    updated.categories[catIdx].dishes.splice(dishIdx, 1);
    setMenu(updated);
  };

  const addDish = (catIdx: number) => {
    const updated = { ...menu };
    updated.categories[catIdx].dishes.push({
      name_es: "Nuevo plato",
      name_en: "New dish",
      description_es: "",
      description_en: "",
      price: 0,
      allergens: [],
    });
    setMenu(updated);
  };

  const handleSaveClick = async () => {
    if (!legalConfirmed) {
      alert("Debes marcar la casilla de verificación legal de alérgenos para publicar.");
      return;
    }
    await onSave({
      restaurantName,
      slug,
      description,
      menu,
      legalConfirmed,
    });
  };

  return (
    <div className="w-full space-y-6 pb-24">
      {/* Datos básicos del local */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-base">
          <Store className="w-5 h-5 text-amber-600" />
          <span>Datos del Establecimiento</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nombre de tu Bar o Restaurante
            </label>
            <input
              type="text"
              value={restaurantName}
              onChange={(e) => {
                setRestaurantName(e.target.value);
                if (slug === "mi-restaurante" || slug.length === 0) {
                  handleSlugChange(e.target.value);
                }
              }}
              placeholder="Ej. Cervecería Los Amigos"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Enlace de tu Carta Digital (Slug)
            </label>
            <div className="flex items-center rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 overflow-hidden text-sm">
              <span className="px-2.5 text-zinc-400 text-xs select-none">/m/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="los-amigos"
                className="w-full py-2.5 pr-3 bg-transparent text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Descripción corta o lema
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Especialidad en carnes y tapas caseras desde 1998."
            className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Secciones de la Carta extraídas */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Platos Extraídos por la IA
            </h2>
            <p className="text-xs text-zinc-500">
              Revisa los precios y confirma los alérgenos con un toque.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            {provider === "litert" ? modelName : provider === "local" ? `Local ${modelName}` : provider === "gemini" ? "Gemini Flash" : "Demo Mock"}
          </span>
        </div>

        {menu.categories.map((cat, catIdx) => (
          <div
            key={catIdx}
            className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4"
          >
            {/* Nombre de la categoría */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <input
                type="text"
                value={cat.name_es}
                onChange={(e) => {
                  const updated = { ...menu };
                  updated.categories[catIdx].name_es = e.target.value;
                  setMenu(updated);
                }}
                className="text-base font-bold text-zinc-900 dark:text-zinc-100 bg-transparent focus:outline-none focus:underline"
              />
              <span className="text-xs text-zinc-400">
                {cat.dishes.length} platos
              </span>
            </div>

            {/* Lista de platos en la sección */}
            <div className="space-y-3">
              {cat.dishes.map((dish, dishIdx) => (
                <div
                  key={dishIdx}
                  className="p-3.5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={dish.name_es}
                        onChange={(e) =>
                          updateDish(catIdx, dishIdx, "name_es", e.target.value)
                        }
                        placeholder="Nombre del plato"
                        className="w-full text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-transparent focus:outline-none"
                      />
                      <input
                        type="text"
                        value={dish.description_es || ""}
                        onChange={(e) =>
                          updateDish(catIdx, dishIdx, "description_es", e.target.value)
                        }
                        placeholder="Descripción o ingredientes"
                        className="w-full text-xs text-zinc-500 dark:text-zinc-400 bg-transparent focus:outline-none"
                      />
                      {dish.name_en && (
                        <p className="text-[11px] text-zinc-400 italic flex items-center gap-1">
                          <Globe className="w-3 h-3 text-zinc-400" />
                          {dish.name_en}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                        <input
                          type="number"
                          step="0.10"
                          value={dish.price}
                          onChange={(e) =>
                            updateDish(
                              catIdx,
                              dishIdx,
                              "price",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-14 text-sm font-bold text-right bg-transparent focus:outline-none"
                        />
                        <span className="text-xs font-semibold text-zinc-500">€</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeDish(catIdx, dishIdx)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg"
                        title="Eliminar plato"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Alérgenos sugeridos */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {dish.allergens && dish.allergens.length > 0 ? (
                      dish.allergens.map((code) => (
                        <AllergenBadge
                          key={code}
                          code={code}
                          onRemove={() => toggleAllergen(catIdx, dishIdx, code)}
                        />
                      ))
                    ) : (
                      <span className="text-[11px] text-zinc-400 italic">
                        Sin alérgenos detectados
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveAllergenModal({ catIdx, dishIdx })}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Editar alérgenos
                    </button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => addDish(catIdx)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Añadir plato a {cat.name_es}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal / Selector de alérgenos */}
      {activeAllergenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Seleccionar Alérgenos (Reglamento UE)
            </h3>
            <p className="text-xs text-zinc-500">
              Toca para marcar o desmarcar los alérgenos presentes en este plato:
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {EU_ALLERGENS.map((all) => {
                const current =
                  menu.categories[activeAllergenModal.catIdx].dishes[
                    activeAllergenModal.dishIdx
                  ].allergens || [];
                const isSelected = current.includes(all.code);

                return (
                  <button
                    key={all.code}
                    type="button"
                    onClick={() =>
                      toggleAllergen(
                        activeAllergenModal.catIdx,
                        activeAllergenModal.dishIdx,
                        all.code
                      )
                    }
                    className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium border text-left transition-all ${
                      isSelected
                        ? "bg-amber-100 border-amber-300 text-amber-950 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-200 font-semibold"
                        : "bg-zinc-50 border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span>{all.icon}</span>
                    <span className="truncate">{all.nameEs}</span>
                    {isSelected && <Check className="w-3 h-3 ml-auto text-amber-600" />}
                  </button>
                );
              })}
            </div>

            <Button
              className="w-full"
              size="md"
              onClick={() => setActiveAllergenModal(null)}
            >
              Listo
            </Button>
          </div>
        </div>
      )}

      {/* Cláusula Legal Obligatoria */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
        <input
          type="checkbox"
          id="legalCheck"
          checked={legalConfirmed}
          onChange={(e) => setLegalConfirmed(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
        />
        <label
          htmlFor="legalCheck"
          className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed cursor-pointer"
        >
          <span className="font-bold flex items-center gap-1 mb-0.5">
            <ShieldCheck className="w-4 h-4" />
            Certificación legal obligatoria (Reglamento UE 1169/2011):
          </span>
          Confirmo que he verificado los ingredientes, precios y alérgenos de cada
          plato. Reconozco que la IA actúa únicamente como asistente y asumo la
          responsabilidad legal ante los clientes.
        </label>
      </div>

      {/* Barra fija inferior con botón primario */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 z-40 max-w-xl mx-auto flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">
          Total:{" "}
          <span className="font-bold text-zinc-900 dark:text-zinc-100">
            {menu.categories.reduce((acc, c) => acc + c.dishes.length, 0)} platos
          </span>
        </div>

        <Button
          onClick={handleSaveClick}
          isLoading={isSaving}
          disabled={!legalConfirmed || isSaving}
          size="lg"
          className="flex-1"
        >
          Publicar Carta Digital y Obtener QR
        </Button>
      </div>
    </div>
  );
};
