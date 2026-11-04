import os
import json
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = "/Users/jonathanquishpe/JoniDev/Nexo/worktrees/worker-ai-benchmark/data/benchmark_dataset"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Select available fonts
def get_font(size, bold=False):
    font_paths = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Unicode.ttf"
    ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

# -------------------------------------------------------------
# 1. Carta Impresa Tradicional a 2 Columnas
# -------------------------------------------------------------
def generate_carta_impresa():
    w, h = 1200, 1500
    img = Image.new("RGB", (w, h), color=(250, 248, 242))
    draw = ImageDraw.Draw(img)

    # Subtle border
    draw.rectangle([30, 30, w - 30, h - 30], outline=(180, 160, 140), width=3)
    draw.rectangle([38, 38, w - 38, h - 38], outline=(210, 195, 180), width=1)

    # Header
    font_title = get_font(42, bold=True)
    font_sub = get_font(20, bold=False)
    draw.text((w // 2, 80), "TABERNA EL CHULAPO", fill=(40, 30, 20), font=font_title, anchor="mm")
    draw.text((w // 2, 125), "Cocina Tradicional & Tapas Madrileñas — Carta de Raciones", fill=(100, 80, 60), font=font_sub, anchor="mm")
    draw.line([(80, 155), (w - 80, 155)], fill=(180, 160, 140), width=2)

    # Dividing vertical line for 2 columns
    draw.line([(w // 2, 175), (w // 2, h - 120)], fill=(210, 195, 180), width=1)

    font_section = get_font(26, bold=True)
    font_dish = get_font(21, bold=True)
    font_desc = get_font(16, bold=False)
    font_price = get_font(22, bold=True)

    # Columna 1: TAPAS Y RACIONES
    draw.text((80, 190), "TAPAS Y RACIONES", fill=(140, 50, 30), font=font_section)
    draw.line([(80, 225), (w // 2 - 40, 225)], fill=(140, 50, 30), width=2)

    col1_items = [
        ("Croquetas de Jamón Ibérico (6 uds)", "Bechamel cremosa artesana con jamón de bellota", "9,50 €"),
        ("Patatas Bravas Tradicionales", "Patatas crujientes con salsa brava casera y alioli", "6,50 €"),
        ("Calamares a la Andaluza", "Anillas de calamar fresco enharinadas con limón", "11,00 €"),
        ("Gambas al Ajillo con Guindilla", "Gambas salteadas en aceite de oliva virgen y ajo", "12,50 €"),
    ]

    y = 250
    for name, desc, price in col1_items:
        draw.text((80, y), name, fill=(30, 30, 30), font=font_dish)
        draw.text((w // 2 - 60, y), price, fill=(40, 30, 20), font=font_price, anchor="ra")
        y += 30
        draw.text((80, y), desc, fill=(90, 85, 80), font=font_desc)
        y += 65

    # Columna 2: PLATOS PRINCIPALES Y POSTRES
    draw.text((w // 2 + 50, 190), "PLATOS PRINCIPALES Y POSTRES", fill=(140, 50, 30), font=font_section)
    draw.line([(w // 2 + 50, 225), (w - 80, 225)], fill=(140, 50, 30), width=2)

    col2_items = [
        ("Tortilla de Patatas de Betanzos", "Huevos de corral camperos y patata pochada tierna", "8,00 €"),
        ("Entrecot de Ternera a la Brasa", "Carne madurada 300g con patatas y pimientos", "18,00 €"),
        ("Merluza a la Cazuela con Almejas", "Lomo de merluza fresca en salsa verde y vino blanco", "16,50 €"),
        ("Tarta de Queso Fluida al Horno", "Estilo San Sebastián con interior suave y cremoso", "5,50 €"),
    ]

    y = 250
    for name, desc, price in col2_items:
        draw.text((w // 2 + 50, y), name, fill=(30, 30, 30), font=font_dish)
        draw.text((w - 80, y), price, fill=(40, 30, 20), font=font_price, anchor="ra")
        y += 30
        draw.text((w // 2 + 50, y), desc, fill=(90, 85, 80), font=font_desc)
        y += 65

    # Bottom notice
    font_footer = get_font(14, bold=False)
    draw.line([(80, h - 90), (w - 80, h - 90)], fill=(180, 160, 140), width=1)
    draw.text((w // 2, h - 60), "Precios en euros con IVA incluido. Información sobre alérgenos (Reglamento UE 1169/2011) a disposición del cliente.", fill=(110, 100, 90), font=font_footer, anchor="mm")

    path = os.path.join(OUTPUT_DIR, "carta_impresa_2col.jpg")
    img.save(path, "JPEG", quality=92)
    print(f"Generated: {path}")

# -------------------------------------------------------------
# 2. Pizarra de Bar Escrita a Mano con Tiza
# -------------------------------------------------------------
def generate_pizarra_tiza():
    w, h = 1100, 1400
    img = Image.new("RGB", (w, h), color=(32, 36, 35))
    draw = ImageDraw.Draw(img)

    # Chalkboard wooden frame
    draw.rectangle([0, 0, w, 25], fill=(120, 80, 50))
    draw.rectangle([0, h - 25, w, h], fill=(120, 80, 50))
    draw.rectangle([0, 0, 25, h], fill=(110, 75, 45))
    draw.rectangle([w - 25, 0, w, h], fill=(110, 75, 45))

    # Add subtle chalk dust/texture
    for _ in range(3000):
        rx = random.randint(30, w - 30)
        ry = random.randint(30, h - 30)
        c = random.randint(45, 65)
        draw.point((rx, ry), fill=(c, c, c))

    font_header = get_font(44, bold=True)
    font_sub = get_font(26, bold=False)
    font_item = get_font(28, bold=True)
    font_price = get_font(30, bold=True)

    # Chalk title
    draw.text((w // 2, 90), "— RACIONES DEL DÍA —", fill=(245, 245, 235), font=font_header, anchor="mm")
    draw.text((w // 2, 145), "BAR CASA PACO ★ PRODUCTO FRESCO", fill=(240, 220, 160), font=font_sub, anchor="mm")
    draw.line([(80, 180), (w - 80, 180)], fill=(200, 200, 190), width=3)

    items = [
        ("Torreznos de Soria Crujientes", "7,50 €"),
        ("Chipirones Encebollados a la Plancha", "13,00 €"),
        ("Ensaladilla Rusa con Ventresca y Picos", "8,50 €"),
        ("Pimientos de Padrón Fritos", "6,00 €"),
        ("Rabo de Toro Estofado al Vino Tinto", "15,50 €"),
        ("Mejillones al Vapor con Limón", "9,00 €"),
    ]

    y = 240
    for name, price in items:
        # Slight jitter to simulate chalkboard handwriting
        jx = random.randint(-2, 2)
        jy = random.randint(-2, 2)
        draw.text((90 + jx, y + jy), f"• {name}", fill=(240, 245, 245), font=font_item)
        draw.text((w - 90 + jx, y + jy), price, fill=(255, 240, 180), font=font_price, anchor="ra")

        # Chalk underline with dots
        draw.line([(90, y + 50), (w - 90, y + 50)], fill=(70, 75, 75), width=1)
        y += 120

    draw.text((w // 2, h - 90), "¡PREGÚNTANOS POR LOS ALÉRGENOS!", fill=(220, 210, 180), font=font_sub, anchor="mm")

    path = os.path.join(OUTPUT_DIR, "pizarra_tiza_bar.jpg")
    img.save(path, "JPEG", quality=90)
    print(f"Generated: {path}")

# -------------------------------------------------------------
# 3. Menú del Día en Papel Doblado con Iluminación Irregular
# -------------------------------------------------------------
def generate_menu_dia():
    w, h = 1100, 1500
    img = Image.new("RGB", (w, h), color=(244, 241, 232))
    draw = ImageDraw.Draw(img)

    # Lighting gradient simulation (shadow top-left and bottom-right)
    for y_idx in range(h):
        shadow = int(18 * math.sin((y_idx / h) * math.pi))
        color = (244 - shadow, 241 - shadow, 232 - shadow)
        draw.line([(0, y_idx), (w, y_idx)], fill=color)

    # Paper fold line across the middle
    fold_y = h // 2
    draw.line([(0, fold_y - 1), (w, fold_y - 1)], fill=(215, 210, 200), width=2)
    draw.line([(0, fold_y + 1), (w, fold_y + 1)], fill=(255, 255, 250), width=1)

    # Diagonal fold line
    for x in range(w):
        yf = int(350 + (x * 0.15))
        draw.point((x, yf), fill=(220, 215, 205))

    font_title = get_font(36, bold=True)
    font_sub = get_font(22, bold=True)
    font_sec = get_font(24, bold=True)
    font_dish = get_font(21, bold=False)
    font_price = get_font(32, bold=True)

    # Header
    draw.text((w // 2, 70), "HOSTAL RESTAURANTE EL ROBLE", fill=(35, 35, 35), font=font_title, anchor="mm")
    draw.text((w // 2, 115), "MENÚ DEL DÍA LABORABLES", fill=(70, 70, 70), font=font_sub, anchor="mm")
    draw.text((w // 2, 170), "12,50 €", fill=(160, 40, 20), font=font_price, anchor="mm")
    draw.text((w // 2, 215), "Incluye: Primer plato, Segundo plato, Pan, Postre o Café y Bebida (Vino o Agua)", fill=(100, 95, 90), font=get_font(16, bold=False), anchor="mm")
    draw.line([(100, 240), (w - 100, 240)], fill=(180, 175, 165), width=2)

    # PRIMEROS
    draw.text((120, 270), "PRIMEROS PLATOS (A ELEGIR):", fill=(140, 50, 30), font=font_sec)
    primeros = [
        "• Salmorejo Cordobés con Jamón y Huevo Duro",
        "• Lentejas Castellanas Caseras con Chorizo",
    ]
    y = 315
    for p in primeros:
        draw.text((140, y), p, fill=(40, 40, 40), font=font_dish)
        y += 45

    # SEGUNDOS
    draw.text((120, 430), "SEGUNDOS PLATOS (A ELEGIR):", fill=(140, 50, 30), font=font_sec)
    segundos = [
        "• Lubina Fresca a la Espalda con Ajos Salteados",
        "• Escalope de Ternera Milanesa con Patatas Fritas",
    ]
    y = 475
    for s in segundos:
        draw.text((140, y), s, fill=(40, 40, 40), font=font_dish)
        y += 45

    # POSTRES
    draw.text((120, 600), "POSTRES CASEROS:", fill=(140, 50, 30), font=font_sec)
    postres = [
        "• Natillas Caseras con Canela y Galleta María",
        "• Flan de Huevo Tradicional con Nata Montada",
    ]
    y = 645
    for pt in postres:
        draw.text((140, y), pt, fill=(40, 40, 40), font=font_dish)
        y += 45

    draw.line([(100, 780), (w - 100, 780)], fill=(180, 175, 165), width=1)
    draw.text((w // 2, 820), "IVA 10% INCLUIDO — COCINA CASERA DIARIA", fill=(120, 115, 110), font=get_font(15, bold=False), anchor="mm")

    path = os.path.join(OUTPUT_DIR, "menu_dia_doblado.jpg")
    img.save(path, "JPEG", quality=88)
    print(f"Generated: {path}")

# -------------------------------------------------------------
# 4. Generate Ground Truth Metadata JSON
# -------------------------------------------------------------
def generate_metadata():
    ground_truth = {
        "dataset_name": "Nexo Spanish Hospitality AI Benchmark Dataset",
        "created_at": "2026-10-31T05:00:00Z",
        "samples": [
            {
                "id": "sample-01",
                "filename": "carta_impresa_2col.jpg",
                "format_type": "Carta Impresa Tradicional a 2 Columnas",
                "establishment": "Taberna El Chulapo",
                "total_dishes": 8,
                "categories": [
                    {
                        "name_es": "Tapas y Raciones",
                        "dishes": [
                            {
                                "name_es": "Croquetas de Jamón Ibérico (6 uds)",
                                "price": 9.50,
                                "allergens": ["gluten", "dairy", "eggs"]
                            },
                            {
                                "name_es": "Patatas Bravas Tradicionales",
                                "price": 6.50,
                                "allergens": ["gluten", "eggs"]
                            },
                            {
                                "name_es": "Calamares a la Andaluza",
                                "price": 11.00,
                                "allergens": ["gluten", "molluscs"]
                            },
                            {
                                "name_es": "Gambas al Ajillo con Guindilla",
                                "price": 12.50,
                                "allergens": ["crustaceans", "sulphites"]
                            }
                        ]
                    },
                    {
                        "name_es": "Platos Principales y Postres",
                        "dishes": [
                            {
                                "name_es": "Tortilla de Patatas de Betanzos",
                                "price": 8.00,
                                "allergens": ["eggs"]
                            },
                            {
                                "name_es": "Entrecot de Ternera a la Brasa",
                                "price": 18.00,
                                "allergens": []
                            },
                            {
                                "name_es": "Merluza a la Cazuela con Almejas",
                                "price": 16.50,
                                "allergens": ["fish", "molluscs", "sulphites"]
                            },
                            {
                                "name_es": "Tarta de Queso Fluida al Horno",
                                "price": 5.50,
                                "allergens": ["dairy", "eggs", "gluten"]
                            }
                        ]
                    }
                ]
            },
            {
                "id": "sample-02",
                "filename": "pizarra_tiza_bar.jpg",
                "format_type": "Pizarra de Bar Escrita a Mano con Tiza",
                "establishment": "Bar Casa Paco",
                "total_dishes": 6,
                "categories": [
                    {
                        "name_es": "Raciones del Día",
                        "dishes": [
                            {
                                "name_es": "Torreznos de Soria Crujientes",
                                "price": 7.50,
                                "allergens": []
                            },
                            {
                                "name_es": "Chipirones Encebollados a la Plancha",
                                "price": 13.00,
                                "allergens": ["molluscs"]
                            },
                            {
                                "name_es": "Ensaladilla Rusa con Ventresca y Picos",
                                "price": 8.50,
                                "allergens": ["eggs", "fish", "gluten"]
                            },
                            {
                                "name_es": "Pimientos de Padrón Fritos",
                                "price": 6.00,
                                "allergens": []
                            },
                            {
                                "name_es": "Rabo de Toro Estofado al Vino Tinto",
                                "price": 15.50,
                                "allergens": ["celery", "sulphites"]
                            },
                            {
                                "name_es": "Mejillones al Vapor con Limón",
                                "price": 9.00,
                                "allergens": ["molluscs", "sulphites"]
                            }
                        ]
                    }
                ]
            },
            {
                "id": "sample-03",
                "filename": "menu_dia_doblado.jpg",
                "format_type": "Menú del Día en Papel Doblado con Iluminación Irregular",
                "establishment": "Hostal Restaurante El Roble",
                "total_dishes": 6,
                "menu_price": 12.50,
                "categories": [
                    {
                        "name_es": "Primeros Platos",
                        "dishes": [
                            {
                                "name_es": "Salmorejo Cordobés con Jamón y Huevo Duro",
                                "price": 12.50,
                                "allergens": ["gluten", "eggs"]
                            },
                            {
                                "name_es": "Lentejas Castellanas Caseras con Chorizo",
                                "price": 12.50,
                                "allergens": ["gluten", "sulphites"]
                            }
                        ]
                    },
                    {
                        "name_es": "Segundos Platos",
                        "dishes": [
                            {
                                "name_es": "Lubina Fresca a la Espalda con Ajos Salteados",
                                "price": 12.50,
                                "allergens": ["fish"]
                            },
                            {
                                "name_es": "Escalope de Ternera Milanesa con Patatas Fritas",
                                "price": 12.50,
                                "allergens": ["gluten", "eggs"]
                            }
                        ]
                    },
                    {
                        "name_es": "Postres Caseros",
                        "dishes": [
                            {
                                "name_es": "Natillas Caseras con Canela y Galleta María",
                                "price": 12.50,
                                "allergens": ["dairy", "eggs", "gluten"]
                            },
                            {
                                "name_es": "Flan de Huevo Tradicional con Nata Montada",
                                "price": 12.50,
                                "allergens": ["dairy", "eggs"]
                            }
                        ]
                    }
                ]
            }
        ]
    }

    meta_path = os.path.join(OUTPUT_DIR, "dataset_metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(ground_truth, f, indent=2, ensure_ascii=False)
    print(f"Generated: {meta_path}")

if __name__ == "__main__":
    generate_carta_impresa()
    generate_pizarra_tiza()
    generate_menu_dia()
    generate_metadata()
