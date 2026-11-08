import { describe, it, expect } from "vitest";
import type {
  ExtractedMenu,
  ExtractedCategory,
  ExtractedDish,
} from "../../lib/types";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal but realistic ExtractedMenu fixture.
 * Contains two categories, each with multiple dishes and allergen arrays,
 * so that every nesting level can be exercised by the tests below.
 */
function makeFixture(): ExtractedMenu {
  return {
    categories: [
      {
        name_es: "Entradas",
        name_en: "Appetizers",
        dishes: [
          {
            name_es: "Nachos",
            name_en: "Nachos",
            description_es: "Delicious nachos",
            description_en: null,
            price: 8.99,
            allergens: ["dairy", "gluten"],
            image_url: "https://example.com/nachos.jpg",
          },
          {
            name_es: "Guacamole",
            name_en: "Guacamole",
            description_es: "Fresh avocado dip",
            description_en: null,
            price: 6.5,
            allergens: [],
            image_url: null,
          },
        ],
      },
      {
        name_es: "Platos Fuertes",
        // name_en intentionally omitted (nullable).
        dishes: [
          {
            name_es: "Enchiladas",
            name_en: "Enchiladas",
            description_es: "Classic enchiladas",
            description_en: null,
            price: 12.0,
            allergens: ["dairy", "gluten", "soy"],
            image_url: null,
          },
        ],
      },
    ],
  };
}

/**
 * Deep-clone an ExtractedMenu using the built-in structuredClone API
 * (available in Node ≥ 17 / modern browsers). This is the canonical
 * way to produce independent copies without custom cloning logic.
 */
function cloneMenu(menu: ExtractedMenu): ExtractedMenu {
  return structuredClone(menu);
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("extracted menu – deep-cloning produces independent copies", () => {
  const original = makeFixture();

  // ── Test 1: Clone is not the same reference as original ───────────────────

  it("Clone is not the same reference as original", () => {
    // #ts: Verifies that structuredClone returns a brand-new object graph;
    // top-level identity should differ between original and clone.
    const clone = cloneMenu(original);

    expect(clone).not.toBe(original);
    expect(clone.categories).not.toBe(original.categories);
  });

  // ── Test 2: Modifying cloned dishes doesn't affect original ───────────────

  it("Modifying cloned dishes does not affect original", () => {
    // #ts: After cloning, mutation on any dish inside the clone must leave
    // the corresponding dish in the original untouched.
    const clone = cloneMenu(original);
    const clonedDish = clone.categories[0].dishes[0];
    const originalDish = original.categories[0].dishes[0];

    // Mutate the clone's dish price.
    clonedDish.price = 999;
    clonedDish.name_es = "MODIFIED";

    expect(clonedDish.price).toBe(999);
    expect(clonedDish.name_es).toBe("MODIFIED");

    // Original must be unchanged.
    expect(originalDish.price).toBe(8.99);
    expect(originalDish.name_es).toBe("Nachos");
  });

  // ── Test 3: Modifying cloned category name doesn't affect original ────────

  it("Modifying cloned category name does not affect original", () => {
    // #ts: Category-level fields are independently copied — changing the
    // clone's category name never mutates the original.
    const clone = cloneMenu(original);
    const clonedCategory = clone.categories[1];
    const originalCategory = original.categories[1];

    // Mutate category name on the clone.
    clonedCategory.name_es = "CAMBIADO";

    expect(clonedCategory.name_es).toBe("CAMBIADO");
    expect(originalCategory.name_es).toBe("Platos Fuertes");
  });

  // ── Test 4: Allergen arrays in clone are independent copies ───────────────

  it("Allergen arrays in clone are independent copies", () => {
    // #ts: Arrays nested one level deep (allergens[]) must be different
    // array references. Pushing/removing items from the clone's array
    // must not impact the original.
    const clone = cloneMenu(original);
    const clonedDish = clone.categories[0].dishes[0];
    const originalDish = original.categories[0].dishes[0];

    // The allergen arrays must NOT be the same reference.
    expect(clonedDish.allergens).not.toBe(originalDish.allergens);

    // Mutate the clone's allergen array.
    clonedDish.allergens.push("eggs");
    clonedDish.allergens.splice(0, 1);

    expect(clonedDish.allergens.length).toBe(2);
    expect(clonedDish.allergens).toContain("eggs");
    // Original must still have exactly ["dairy", "gluten"].
    expect(originalDish.allergens.length).toBe(2);
    expect(originalDish.allergens).toEqual(["dairy", "gluten"]);
  });

  // ── Test 5: Nested dish fields are deeply copied ──────────────────────────

  it("Nested dish fields are deeply copied", () => {
    // #ts: Every leaf field inside a Dish (price, strings, nulls) must be
    // preserved through structuredClone. We verify by mutating several
    // fields on the clone and confirming the original remains intact.
    const clone = cloneMenu(original);
    const secondDish = clone.categories[0].dishes[1];
    const originalSecond = original.categories[0].dishes[1];

    // Mutate all scalar fields of the cloned dish.
    secondDish.name_es = "NUEVO";
    secondDish.description_es = "Nuevo description";
    secondDish.description_en = "New desc";
    secondDish.price = 100;
    secondDish.image_url = "https://example.com/new.jpg";
    secondDish.allergens = ["nuts"];

    // All original values must survive unchanged.
    expect(originalSecond.name_es).toBe("Guacamole");
    expect(originalSecond.description_es).toBe("Fresh avocado dip");
    expect(originalSecond.description_en).toBeNull();
    expect(originalSecond.price).toBe(6.5);
    expect(originalSecond.image_url).toBeNull();
    expect(originalSecond.allergens).toEqual([]);
  });
});
