# TODO – Work Package WP‑1: Entorno, Git & Repositorio remoto

## Objetivo
Establecer la higiene del repositorio y conectar la copia local con el repositorio remoto para que todo el equipo pueda colaborar y los pipelines de CI/CD se activen automáticamente.

## Sub‑tareas

1. **Crear rama principal `main` (si no existe)**
   - `git branch -M main`
   - Configurar protección de rama en GitHub (opcional).
2. **Configurar `.gitignore`** *(ya está presente, verificar que incluye*:
   - `node_modules/`
   - `dist/` / `.next/`
   - `*.env*`
   - `coverage/`
   - `*.log`
3. **Crear archivo de entorno de ejemplo**
   - `cp .env.example .env.local`
   - Documentar variables obligatorias en `README.md`.
4. **Añadir README y badge de CI** *(ya presente, pero revisar que el badge apunta al workflow `ci.yml`).*
5. **Commit inicial** *(realizado en el paso anterior)*
6. **Push a remoto** *(realizado)*
7. **Abrir Pull Request**
   - Ejecutar `git push origin main` (ya hecho) y crear PR desde la UI o usar la URL mostrada en el push.
8. **Activar GitHub Actions**
   - Verificar que el workflow `ci.yml` se ejecuta en cada push.
9. **Etiquetado de versión** (opcional)
   - `git tag v1.0.0 && git push origin v1.0.0`
10. **Documentar checklist**
    - Añadir tabla de estado en este archivo con columnas **[ ]** (pendiente) / **[x]** (completado).

## Checklist

| Sub‑tarea | Estado |
|-----------|--------|
| Crear rama `main` | [x] |
| Configurar `.gitignore` | [x] |
| Añadir `.env.example` y copiar a `.env.local` | [x] |
| Commit inicial | [x] |
| Push al remoto | [x] |
| Abrir Pull Request | [ ] |
| Activar CI/CD (GitHub Actions) | [ ] |
| Etiquetar versión | [ ] |
| Documentar en `README.md` | [x] |

---

*Una vez completado el PR y la CI, podemos avanzar a **WP‑2** (persistencia multi‑tenant & Supabase).*
