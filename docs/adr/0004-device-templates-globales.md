# Device templates como catálogo global

- Status: accepted
- Date: 2026-07-30

## Context

En la Fase 2 (`0029_`) los `device_templates` nacieron con `project_id`: cada proyecto tenía su propio catálogo de SKU.
Eso impedía reutilizar un template (p. ej. “Switch 24 puertos Cisco C9200”) al documentar la infraestructura de otro cliente/proyecto.

Los catálogos `port_types` y `cable_types` ya son globales. Los dispositivos siguen siendo scope de proyecto.

## Decision

1. **`device_templates` es catálogo de plataforma**: sin `project_id` (migración `0034_`).
2. **Lectura**: cualquier usuario autenticado ve el catálogo completo.
3. **Mutación**: mismo patrón que `port_types` / `cable_types` (`requireMutateProjectContext`).
4. **Instancias** (`devices`) conservan `project_id` y referencian el template global vía `device_template_id`.
5. Editar marca/modelo/tipo de un template sincroniza esos campos denormalizados en devices activos de **todos** los proyectos que lo usen.

## Consequences

- Un template creado una vez se reutiliza al alta de equipos en cualquier proyecto.
- Borrar un proyecto ya no cascada-borra templates.
- Pueden quedar duplicados históricos del backfill por-proyecto; limpieza manual vía UI.
- Attachments/secrets sobre un template siguen llevando `project_id` del contexto; el attachable solo valida que el template exista y no esté soft-deleted.
