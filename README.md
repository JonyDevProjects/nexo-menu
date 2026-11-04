# Nexo Menu — Carta Digital Inteligente con IA & Alérgenos QR
**Producto Digital de Hostelería & Restauración (Nexo Software Factory)**

[![CI/CD Pipeline](https://github.com/JonyDevProjects/nexo-menu/actions/workflows/ci.yml/badge.svg)](https://github.com/JonyDevProjects/nexo-menu/actions)
[![Next.js](https://img.shields.io/badge/Next.js-15.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Dev_Parity-blue?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-Proprietary-amber)](#)

---

## 🍽️ Descripción del Producto

**Nexo Menu** es la solución SaaS para bares, restaurantes y cafeterías que permite digitalizar cualquier carta física en papel o pizarra en **menos de 3 minutos**:

1. **Ingesta Inteligente con IA Multimodal**:
   - Extracción automatizada de categorías, platos, precios y los 14 alérgenos de declaración obligatoria según el **Reglamento (UE) nº 1169/2011**.
   - Soporte híbrido: Google Gemini Flash / LiteRT local / Ollama visión.
2. **Editor Táctil & Certificación Legal**:
   - Ajuste rápido de precios y alérgenos con interfaz táctil pensada para hosteleros en sala o cocina.
   - Declaración de responsabilidad y confirmación de alérgenos blindada.
3. **Generación de Código QR y Peana A5 (`/qr/[slug]`)**:
   - Código QR de alta redundancia (Nivel H, 30% corrección óptica).
   - Descarga en **PNG (1024x1024 px)** y **SVG vectorial**.
   - Maquetación y peana de mesa A5 lista para imprimir con `window.print()` y doblar para mesas.
4. **Carta Digital Pública para Comensales (`/m/[slug]`)**:
   - Visualización instantánea con filtros reactivos de alérgenos (exclusión dinámica en tiempo real).
   - Selector multidioma instantáneo (🇪🇸 Español / 🇬🇧 English) sin recarga.
   - Modo día/noche adaptable a la iluminación del local.
   - Acceso sin registro ni descarga de aplicaciones móviles.

---

## 👥 Equipo y Gobernanza

- **Product Owner (PO)**: `Nexo-PO-Menu` (Interlocución con clientes de hostelería, roadmap y validación funcional).
- **Tech Lead Corporativo**: `Nexo-Tech-Lead` (Arquitectura y seguridad).
- **DevOps & QA**: `Nexo-DevOps-QA` (Contenedorización, CI/CD y suites de pruebas).
- **Centro de Operaciones**: [Nexo Software Factory Hub](https://github.com/JonyDevProjects/Nexo).

---

## 🚀 Inicio Rápido (Entorno Local)

### Requisitos Previos
- Node.js 20+ o 22+
- Docker & Docker Compose (opcional para paridad con Supabase)

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/JonyDevProjects/nexo-menu.git
cd nexo-menu

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local

# 4. Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

---

## 🐳 Entorno Contenedorizado Docker

Para desarrollo con paridad total frente a Vercel Serverless y PostgreSQL 15:

```bash
# Levantar Next.js y base de datos local
docker compose up -d

# Ver logs en vivo
docker compose logs -f

# Detener contenedores
docker compose down
```

---

## 🧪 Pruebas y Aseguramiento de Calidad (QA)

Ejecutar la suite completa de CI:

```bash
npm run test:ci
```

Esta suite ejecuta:
- `npm run typecheck`: Comprobación estricta de TypeScript.
- `npm run test:rls`: Auditoría estática de políticas Row Level Security (RLS) y aislamiento multi-tenant.
- `npm run test:field`: Auditoría de tiempos de carga móvil y filtros reactivos de alérgenos.
- `npm run test:flow`: Verificación de extremo a extremo de ingesta IA, autenticación transparente y visualización `/qr/[slug]`.

---

## 🌿 Flujo GitFlow

- **`main`**: Rama de producción (despliegue automático a Vercel Producción).
- **`develop`**: Rama de integración continua (despliegue a Vercel Preview / Staging).
- **`feature/<nombre>`**: Ramas de desarrollo para nuevas funcionalidades.
- **`fix/<nombre>`**: Ramas para corrección de incidencias.
