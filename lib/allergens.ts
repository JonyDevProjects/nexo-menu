export interface AllergenDefinition {
  code: string;
  nameEs: string;
  nameEn: string;
  icon: string;
  descriptionEs: string;
}

export const EU_ALLERGENS: AllergenDefinition[] = [
  {
    code: "gluten",
    nameEs: "Gluten",
    nameEn: "Gluten",
    icon: "🌾",
    descriptionEs: "Trigo, centeno, cebada, avena y derivados",
  },
  {
    code: "crustaceans",
    nameEs: "Crustáceos",
    nameEn: "Crustaceans",
    icon: "🦐",
    descriptionEs: "Gambas, langostinos, cangrejos, etc.",
  },
  {
    code: "eggs",
    nameEs: "Huevos",
    nameEn: "Eggs",
    icon: "🥚",
    descriptionEs: "Huevos y ovoproductos",
  },
  {
    code: "fish",
    nameEs: "Pescado",
    nameEn: "Fish",
    icon: "🐟",
    descriptionEs: "Pescados y derivados",
  },
  {
    code: "peanuts",
    nameEs: "Cacahuetes",
    nameEn: "Peanuts",
    icon: "🥜",
    descriptionEs: "Cacahuetes y trazas",
  },
  {
    code: "soybeans",
    nameEs: "Soja",
    nameEn: "Soybeans",
    icon: "🌱",
    descriptionEs: "Soja y productos a base de soja",
  },
  {
    code: "dairy",
    nameEs: "Lácteos",
    nameEn: "Dairy / Milk",
    icon: "🥛",
    descriptionEs: "Leche y sus derivados (incluida lactosa)",
  },
  {
    code: "nuts",
    nameEs: "Frutos de Cáscara",
    nameEn: "Tree Nuts",
    icon: "🌰",
    descriptionEs: "Almendras, nueces, avellanas, pistachos, etc.",
  },
  {
    code: "celery",
    nameEs: "Apio",
    nameEn: "Celery",
    icon: "🥬",
    descriptionEs: "Apio y productos derivados",
  },
  {
    code: "mustard",
    nameEs: "Mostaza",
    nameEn: "Mustard",
    icon: "🌭",
    descriptionEs: "Mostaza y productos derivados",
  },
  {
    code: "sesame",
    nameEs: "Sésamo",
    nameEn: "Sesame Seeds",
    icon: "🥯",
    descriptionEs: "Semillas de sésamo y derivados",
  },
  {
    code: "sulphites",
    nameEs: "Sulfitos",
    nameEn: "Sulphites",
    icon: "🍷",
    descriptionEs: "Dióxido de azufre y sulfitos en vinos y salsas",
  },
  {
    code: "lupin",
    nameEs: "Altramuces",
    nameEn: "Lupin",
    icon: "🌼",
    descriptionEs: "Altramuces y productos derivados",
  },
  {
    code: "molluscs",
    nameEs: "Moluscos",
    nameEn: "Molluscs",
    icon: "🐙",
    descriptionEs: "Mejillones, almejas, calamares, pulpo",
  },
];

export const ALLERGENS_MAP = new Map(
  EU_ALLERGENS.map((item) => [item.code, item])
);

export function getAllergenInfo(code: string): AllergenDefinition | undefined {
  return ALLERGENS_MAP.get(code.toLowerCase().trim());
}
