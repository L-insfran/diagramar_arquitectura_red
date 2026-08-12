# Enlaces simplificados de diagrama (`diagram_links`)

- Status: accepted
- Date: 2026-08-10

## Context

El Diagrama de conexión (ADR 0009) reutilizaba las entidades `connections` físicas (puerto+cara, ADR 0005) y el modal detallado de `/topology`. Para documentar y reportar cableado de forma ágil hace falta arrastrar equipo→equipo, indicar origen/destino con puerto opcional (lista o texto libre) y **no** exigir que el puerto esté `up`.

## Decision

1. Nueva tabla **`diagram_links`** (scope por proyecto): `source_device_id` / `target_device_id`, `source_port_id` / `target_port_id` opcionales, `source_port_label` / `target_port_label` obligatorios, `description`, `code` correlativo por proyecto (visible como `E1`), soft delete + auditoría.
2. Independiente de `connections`: el canvas de `/connection-diagram` crea/edita/borra solo `diagram_links` vía `GET|POST|PUT|DELETE /api/diagram-links`.
3. `GET /connection-diagrams/:id/graph` expone edges desde `diagram_links` (con `sourceLabel` / `targetLabel` tipo `"Rack 1 / OS2 · LAN 1"`), **no** desde `connections`.
4. `/topology` y el cableado físico detallado **no cambian**.
5. No hay promoción automática link → `connection` en esta fase.

## Consequences

- Migración `0048_create_diagram_links.ts` + `0049_add_code_to_diagram_links.ts`; siguiente disponible: `0050_`.
- ADR 0009 punto 4 (CRUD de cables vía `/topology` en el diagrama) queda **superseded** para el canvas de conexión.
- `edge_routes` del diagrama se keyea por id de `diagram_link`.
- Informes futuros pueden leer `diagram_links` + etiquetas de ubicación.

## Related

- [0005](0005-port-passthrough-faces.md) — conexiones físicas detalladas (intactas)
- [0009](0009-diagramas-multiples-y-ruteo-ortogonal.md) — diagramas múltiples
