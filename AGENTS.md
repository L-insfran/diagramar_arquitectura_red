# AGENTS.md

Punto de entrada para cualquier agente de IA que trabaje en este repositorio.

## Qué es este producto

Plataforma profesional de **documentación de infraestructura IT y redes** (comparable a NetBox / RackTables / Device42), con UX moderna. **No** es un CRUD genérico. Las **relaciones y conexiones** son el núcleo del dominio.

Visión completa: [docs/PRODUCT-VISION.md](docs/PRODUCT-VISION.md)

## Antes de escribir código

1. Analizar la arquitectura existente.
2. Buscar reutilización.
3. Evitar duplicación.
4. Mantener consistencia.
5. Pensar impacto en módulos futuros (racks, templates, SNMP, integraciones).
6. Priorizar escalabilidad.
7. No crear componentes gigantes.
8. Preferir piezas reutilizables.
9. Nombres claros.
10. Documentar lo complejo.

Extender el sistema. No rehacerlo. No romper permisos ni funcionalidad existente.

## Lecturas obligatorias

| Documento | Para qué |
|-----------|----------|
| [docs/PRODUCT-VISION.md](docs/PRODUCT-VISION.md) | Visión de producto |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack y flujo real hoy |
| [docs/DOMAIN-MODEL.md](docs/DOMAIN-MODEL.md) | Qué existe vs qué falta |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases 0–7 |
| [docs/adr/](docs/adr/) | Decisiones abiertas/aceptadas |

Reglas Cursor (contexto persistente): [.cursor/rules/](.cursor/rules/)

## Hechos críticos (no inventar)

- Scope **actual** en DB/código: **`projects`** (`project_id`, `X-Project-Id`, `project_memberships`). ADR aceptado: [docs/adr/0001-project-como-scope-raiz.md](docs/adr/0001-project-como-scope-raiz.md) (opción A).
- Jerarquía física: **sites → areas → racks → devices** (Fases 3–4). `work_areas` del canvas es solo visual.
- **Sí** existen `device_templates` + puertos de template (catálogo **global**, ADR 0004); devices nacen de template.
- Soft delete / auditoría by-user: piloto en devices, connections, templates, sites, areas, racks, attachments, secrets.
- **Sí** existen conexiones como entidad, topología React Flow, VLANs, networks, ports, `port_types` enriquecidos, `cable_types`, roles admin/operator/viewer.
- **Sí** existen `attachments` + `secrets` polimórficos (Fase 6); archivos en disco local (ADR 0003).
- **Sí** existe `GET /api/dashboard` con métricas agregadas del proyecto (Fase 7).
- Regla: 1 conexión física activa por **(puerto, cara)**; puertos passthrough tienen `front`/`rear` (ADR 0005); marca editable en UI + bulk.
- Frontend vive en la carpeta **`fronted/`** (typo histórico).
- Siguiente migración tras `0036_`: **`0037_`**.
- Capas: Controller → Service → Repository → DTO → Validator (ADR 0002).
- Regla de conexiones: 1 física activa por `(port, face)`; patch panels = `is_passthrough` (ADR 0005).
