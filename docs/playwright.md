# Playwright E2E Testing — Nexo Menu

## Instalación

```bash
npm install  # instala @playwright/test (ya en devDependencies)
npx playwright install chromium
```

## Ejecutar tests

```bash
# Correr todos los tests E2E
npm run test:e2e

# Modo UI interactivo (para debug)
npm run test:e2e:ui

# Solo Chromium en CI
CI=1 npm run test:e2e
```

## Estructura de archivos

| Archivo | Propósito |
|---------|-----------|
| `playwright.config.ts` | Configuración global (browser, timeout, baseURL) |
| `e2e/menu.spec.ts` | Test principal que verifica carga de menú público |
| `test-results/` | Output: screenshots y traces (no version control) |

## Configuración actual

- **Browser:** Chromium (headless en CI, headed en `--ui`)
- **Base URL:** `http://localhost:3000`
- **Timeout por test:** 30 segundos
- **Test directory:** `./e2e/`

## Pre-requisitos para ejecutar

La aplicación debe estar corriendo en `http://localhost:3000`:

```bash
npm run dev
# luego en otra terminal:
npm run test:e2e
```

## Capturas de pantalla

Los tests generan screenshots automáticos en `test-results/`. Úsalos como evidencia visual en PRs o reportes de falla.
