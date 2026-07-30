# ADR 0001 — Project como scope raíz

- **Estado:** Aceptado
- **Fecha:** 2026-07-29
- **Decisión:** Opción A — Company **es** el Proyecto
- **Decisores:** Dueño del producto

## Contexto

La visión de producto establece que todo gira alrededor de un **Proyecto** (= infraestructura completa de un cliente), sin multi-tenant por empresa aislada.

El sistema estaba construido sobre `companies` / `company_memberships` / `company_id` / `X-Company-Id`.

## Decisión

**Opción A:** renombrar el concepto de punta a punta:

| Antes | Después |
|-------|---------|
| `companies` | `projects` |
| `company_memberships` | `project_memberships` |
| `company_id` / `companyId` | `project_id` / `projectId` |
| `X-Company-Id` | `X-Project-Id` |
| UX Cliente / Company | Proyecto / Project |

Un solo nivel de scope. Migración `0026_rename_companies_to_projects.ts`. No se mantienen aliases de rutas ni del header antiguo (FE actualizado en el mismo cambio).

## Consecuencias

- Scope canónico en código y DB: `projects`, `project_id`, `X-Project-Id`.
- Reglas Cursor, `AGENTS.md`, `ARCHITECTURE.md` y `DOMAIN-MODEL.md` actualizados.
- Fase 1b (Repository/DTO, auditoría, soft delete) sigue en [0002-capa-repository-y-dto.md](0002-capa-repository-y-dto.md) y el roadmap.
