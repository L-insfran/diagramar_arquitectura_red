# Boards como contenedor físico

- Status: accepted
- Date: 2026-08-06

## Context

El inventario físico solo modelaba **racks** (unidades U). En redes/IT reales también existen **tableros** (eléctricos, de comunicaciones o genéricos): paneles o gabinetes sin altura U donde se montan equipos en una grilla libre (filas × columnas). El módulo “Diagrama de conexión” necesita dibujar ambos contenedores en el canvas con el nombre del rack/tablero visible.

## Decision

1. Nueva entidad `boards` scoped por proyecto, hija de `areas` (mismo patrón que `racks`).
2. Campos: `name`, `code`, `kind` (`electrical` | `communications` | `generic`), `grid_rows`, `grid_cols` (1–40), manufacturer/model/notes, soft delete + auditoría.
3. Montaje de devices: `board_id`, `board_row`, `board_col`, `board_row_span`, `board_col_span`. Inventario real (no solo layout visual).
4. Exclusión mutua con rack: CHECK `board_id IS NULL OR rack_id IS NULL`. Placement en `DeviceService`: board → shelf → rack → site/area.
5. Colisiones 2D en `board_layout.ts` (footprints fila×columna), endpoint `GET /boards/:id/occupancy`.
6. No se modelan caras front/rear en tableros (sin elevación U).

## Consequences

- Migración `0046_create_boards.ts`.
- `/topology` sigue sin mostrar tableros como contenedores (coexiste); el grafo sí expone `boardId`/`boardRow`/… en nodos.
- Página de inventario `/boards` queda opcional (CRUD ligero desde el diagrama en v1).
- ADR relacionado: [0009](0009-diagramas-multiples-y-ruteo-ortogonal.md).
