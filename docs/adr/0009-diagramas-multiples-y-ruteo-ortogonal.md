# Diagramas múltiples y ruteo ortogonal

- Status: accepted
- Date: 2026-08-06
- Updated: 2026-08-11

## Context

`topology_canvas_layouts` guarda **un** layout por `(project_id, layer=unified, scope)`. El canvas de `/topology` enruta cada cable de forma aislada (`portCablePath`), lo que produce solapes. Se necesita un módulo hermano — **Diagrama de conexión** — con varias vistas nombradas, contenedores jerárquicos y cables que no se superpongan.

## Decision

1. Nueva tabla `connection_diagrams`: nombre único por proyecto (índice parcial), `scope_site_ids` / `scope_area_ids`, `node_positions`, `label_offsets`, `edge_routes`, `containers`, `settings`, soft delete.
2. Coexistencia: `/topology` y `topology_canvas_layouts` **no se eliminan**. El nuevo módulo vive en `/connection-diagram`.
3. `GET /connection-diagrams/:id/graph` reusa `TopologyService.getTopology`, aplica el recorte de sitios/áreas y agrega `boards[]` + `areas[]`.
4. ~~Las conexiones siguen siendo `POST/PUT/DELETE /topology` (sin duplicar CRUD).~~ **Superseded por [ADR 0010](0010-diagram-links-simplificados.md):** el canvas de diagrama usa `diagram_links` (`/api/diagram-links`); `/topology` permanece para cableado físico detallado.
5. Frontend: router ortogonal batch (`utils/diagram/orthogonalRouter.ts`) — Hanan grid + A* + reserva de carriles; edge `RoutedLinkEdge` dibuja la polilínea precalculada.
6. Contenedores en canvas (jerarquía):
   - **Área** (`areaContainer`, key `area:{id}`) = contenedor principal.
   - **Rack** / **Tablero** (`rackContainer` / `boardContainer`) = subcontenedores con `parentId` apuntando al área; sin leyenda de sitio/área en el header.
   - **Equipos** (`simpleDevice`) = hijos de un rack/tablero **o** sueltos directamente en el área (`deviceIds` del área; inventario sin `rackId`/`boardId`).
   - Layouts legacy: racks/tableros sin `parentId` siguen siendo raíces planas.
7. Estado en `containers` JSONB: `{ x, y, deviceIds?, parentId?, view?, collapsed? }`.

## Consequences

- Migración `0047_create_connection_diagrams.ts`; siguiente disponible tras 0010: `0050_`.
- El ruteo es client-side; se persiste en `edge_routes` al guardar layout.
- Coste A*: mitigado con debounce, orden determinista y recorte por diagrama.
- ADR relacionado: [0008](0008-boards-como-contenedor-fisico.md), [0010](0010-diagram-links-simplificados.md).
