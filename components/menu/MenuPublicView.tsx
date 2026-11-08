"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FullMenuData, Dish } from "@/lib/types";
import { EU_ALLERGENS } from "@/lib/allergens";
import { AllergenBadge } from "@/components/ui/AllergenBadge";
import { formatPrice } from "@/lib/utils";
import { Globe, Moon, Sun, UtensilsCrossed, AlertTriangle, Sparkles, QrCode, X, Maximize2 } from "lucide-react";

interface MenuPublicViewProps {
  data: FullMenuData;
}

export const MenuPublicView: React.FC<MenuPublicViewProps> = ({ data }) => {
  const [lang, setLang] = useState<"es" | "en">("es");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);
  const [lightboxDish, setLightboxDish] = useState<Dish | null>(null);

  const toggleAllergenFilter = (code: string) => {
    if (excludedAllergens.includes(code)) {
      setExcludedAllergens(excludedAllergens.filter((c) => c !== code));
    } else {
      setExcludedAllergens([...excludedAllergens, code]);
    }
  };

  const clearFilters = () => setExcludedAllergens([]);

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="min-h-screen bg-neutral-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        {/* Cabecera del Restaurante */}
        <header className="relative bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 pt-6 pb-4 px-4 sm:px-6 shadow-sm">
          <div className="max-w-2xl mx-auto flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                  {data.restaurant.name}
                </h1>
              </div>
              {data.restaurant.description && (
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
                  {data.restaurant.description}
                </p>
              )}
            </div>

            {/* Controles de Idioma, Modo Oscuro y QR de Mesa */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/qr/${data.restaurant.slug}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors"
                title="Ver y descargar QR de mesa"
                aria-label="Ver y descargar QR de mesa"
              >
                <QrCode className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">QR Mesa</span>
              </Link>

              <button
                type="button"
                onClick={() => setLang(lang === "es" ? "en" : "es")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Cambiar idioma"
              >
                <Globe className="w-3.5 h-3.5 text-zinc-500" />
                <span>{lang === "es" ? "🇪🇸 ES" : "🇬🇧 EN"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Alternar modo oscuro"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Barra Sticky de Filtro por Alérgenos */}
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 py-2.5 shadow-sm">
          <div className="max-w-2xl mx-auto space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <span>🛡️ {lang === "es" ? "Filtrar por tus alergias:" : "Filter by allergies:"}</span>
              </span>
              {excludedAllergens.length > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-amber-600 dark:text-amber-400 font-semibold text-[11px] hover:underline"
                >
                  {lang === "es" ? "Quitar filtros" : "Clear filters"}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {EU_ALLERGENS.map((all) => {
                const isExcluded = excludedAllergens.includes(all.code);
                return (
                  <button
                    key={all.code}
                    type="button"
                    onClick={() => toggleAllergenFilter(all.code)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all select-none ${
                      isExcluded
                        ? "bg-red-500 text-white shadow-sm ring-2 ring-red-400/40"
                        : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span>{all.icon}</span>
                    <span>
                      {isExcluded
                        ? lang === "es"
                          ? `Sin ${all.nameEs}`
                          : `No ${all.nameEn}`
                        : all.nameEs}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pestañas de Secciones (Scroll-spy) */}
        <div className="sticky top-[77px] z-20 bg-neutral-50/90 dark:bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-200/60 dark:border-zinc-800/60 px-4 py-2">
          <div className="max-w-2xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
            {data.categories.map((cat) => (
              <a
                key={cat.id}
                href={`#cat-${cat.id}`}
                className="px-3 py-1 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 whitespace-nowrap hover:border-amber-500 transition-colors"
              >
                {lang === "en" && cat.name_en ? cat.name_en : cat.name_es}
              </a>
            ))}
          </div>
        </div>

        {/* Contenido de la Carta */}
        <main className="max-w-2xl mx-auto px-4 py-6 space-y-8 pb-32">
          {data.categories.map((cat) => {
            const filteredDishes = cat.dishes.filter((dish) => {
              if (excludedAllergens.length === 0) return true;
              // Check if dish contains any excluded allergen
              const hasForbidden = dish.allergens.some((a) =>
                excludedAllergens.includes(a.toLowerCase())
              );
              return !hasForbidden;
            });

            return (
              <section key={cat.id} id={`cat-${cat.id}`} className="space-y-3 scroll-mt-28">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-100 uppercase text-amber-700 dark:text-amber-400">
                    {lang === "en" && cat.name_en ? cat.name_en : cat.name_es}
                  </h2>
                  <span className="text-xs text-zinc-400 font-medium">
                    {filteredDishes.length} {lang === "es" ? "platos" : "items"}
                  </span>
                </div>

                {filteredDishes.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-zinc-100/60 dark:bg-zinc-900/40 text-center text-xs text-zinc-500 italic">
                    {lang === "es"
                      ? "No hay platos en esta sección compatibles con los filtros de alérgenos seleccionados."
                      : "No dishes match your selected allergy filters in this section."}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredDishes.map((dish) => {
                      const dishTitle =
                        lang === "en" && dish.name_en ? dish.name_en : dish.name_es;
                      const dishDesc =
                        lang === "en" && dish.description_en
                          ? dish.description_en
                          : dish.description_es;

                      return (
                        <div
                          key={dish.id}
                          className={`p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm transition-all ${
                            !dish.is_available ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                                  {dishTitle}
                                </h3>
                                {!dish.is_available && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                                    {lang === "es" ? "Agotado hoy" : "Sold out"}
                                  </span>
                                )}
                              </div>

                              {dishDesc && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                                  {dishDesc}
                                </p>
                              )}

                              <div className="pt-0.5">
                                <span className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 tracking-tight">
                                  {formatPrice(dish.price, data.restaurant.currency)}
                                </span>
                              </div>
                            </div>

                            {dish.image_url && (
                              <button
                                type="button"
                                onClick={() => setLightboxDish(dish)}
                                className="relative flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700/80 bg-zinc-100 dark:bg-zinc-800 group focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                                title={lang === "es" ? "Pulsar para ampliar foto" : "Click to view photo"}
                                aria-label={lang === "es" ? `Ver foto de ${dishTitle}` : `View photo of ${dishTitle}`}
                              >
                                <img
                                  src={dish.image_url}
                                  alt=""
                                  loading="lazy"
                                  aria-hidden="true"
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                                </div>
                              </button>
                            )}
                          </div>

                          {/* Alérgenos */}
                          {dish.allergens && dish.allergens.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                              {dish.allergens.map((code) => (
                                <AllergenBadge key={code} code={code} lang={lang} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {/* Advertencia Legal Oficial al Comensal */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
            <p className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {lang === "es" ? "Información sobre Alérgenos:" : "Allergen Information:"}
            </p>
            <p className="text-[11px] leading-relaxed">
              {lang === "es"
                ? "Si usted tiene alguna alergia o intolerancia severa, por favor comuníquelo a nuestro personal de sala antes de realizar su pedido para evitar riesgos de contaminación cruzada."
                : "If you have a severe allergy or dietary intolerance, please inform our staff before ordering to prevent cross-contamination risks."}
            </p>
          </div>
        </main>

        {/* Footer con Branding Viral del Plan Free */}
        <footer className="fixed bottom-0 left-0 right-0 py-2.5 px-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 text-center z-40">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400 font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Carta creada con <strong className="text-zinc-800 dark:text-zinc-200 font-bold">Nexo</strong></span>
            <span className="hidden sm:inline">· Crea la tuya gratis en 3 minutos</span>
          </Link>
        </footer>

        {/* Modal Lightbox de Foto de Plato (EPC-01 / US-102) */}
        {lightboxDish && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setLightboxDish(null)}
          >
            <div
              className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-[16/10] w-full bg-zinc-950 overflow-hidden">
                <img
                  src={lightboxDish.image_url || ""}
                  alt={lang === "en" && lightboxDish.name_en ? lightboxDish.name_en : lightboxDish.name_es}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setLightboxDish(null)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-colors"
                  aria-label="Cerrar visor"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/60 text-white backdrop-blur-sm text-xs font-bold">
                  {formatPrice(lightboxDish.price, data.restaurant.currency)}
                </div>
              </div>

              <div className="p-5 pt-1 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                    {lang === "en" && lightboxDish.name_en ? lightboxDish.name_en : lightboxDish.name_es}
                  </h3>
                  {(lang === "en" && lightboxDish.description_en ? lightboxDish.description_en : lightboxDish.description_es) && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {lang === "en" && lightboxDish.description_en ? lightboxDish.description_en : lightboxDish.description_es}
                    </p>
                  )}
                </div>

                {lightboxDish.allergens && lightboxDish.allergens.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                      {lang === "es" ? "Alérgenos declarados (UE 1169/2011):" : "Declared allergens (EU 1169/2011):"}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {lightboxDish.allergens.map((code) => (
                        <AllergenBadge key={code} code={code} lang={lang} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
