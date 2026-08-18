# Retirar canvas de topología

- Status: accepted
- Date: 2026-08-18

## Context

El producto evoluciona hacia **documentación rápida de conexiones de comunicación** (diagramas con `diagram_links` E1…), no hacia un canvas de topología física tipo NMS.

Coexistían dos lienzos:

- `/topology` + `topology_canvas_layouts` + `work_areas` (capa física detallada)
- `/connection-diagram` + `connection_diagrams` + `diagram_links` (documentación de enlaces)

El canvas de topología duplicaba propósito con el diagrama de conexión y confundía la navegación.

## Decision

1. **Retirar** la UI y la API de layout de topología:
   - Rutas frontend `/topology` → redirect a `/connection-diagram`
   - Endpoints `GET/PUT/DELETE /topology/canvas-layout` y CRUD HTTP bajo `/topology`
   - Tabla `topology_canvas_layouts` (migración `0050_drop_topology_canvas_layouts.ts`)
2. **Conservar** el grafo de inventario (`TopologyService.getTopology`) usado por `GET /connection-diagrams/:id/graph`.
3. **Conservar** la entidad `connections` (cableado físico en dominio) y su service/repository; sin pantalla dedicada por ahora.
4. **Conservar** `diagram_links` como único mecanismo de documentación visual de enlaces en canvas.
5. Puertos nuevos se crean en **Up**; la UI deja de editar status operativo (documentación, no monitoreo).

## Consequences

- ADR 0009 queda parcialmente superseded en la parte de coexistencia permanente de `/topology`.
- Bookmarks a `/topology` siguen funcionando vía redirect.
- Futuro CRUD de `connections` físicas, si se expone, irá bajo ruta dedicada (p. ej. `/api/connections`), no bajo topología.

## Related

- [0009-diagramas-multiples-y-ruteo-ortogonal.md](0009-diagramas-multiples-y-ruteo-ortogonal.md)
- [0010-diagram-links-simplificados.md](0010-diagram-links-simplificados.md)
