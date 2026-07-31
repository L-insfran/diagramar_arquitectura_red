# Port passthrough con caras front/rear

- Status: accepted
- Date: 2026-07-31

## Context

Un patch panel (cableado estructurado) no es un extremo de red: cada jack es un **puente** entre dos cables (p. ej. enlace rear entre racks y patch cord front hacia un switch).

El modelo anterior imponía **1 conexión física activa por puerto**, lo que impedía documentar:

`PR01.P1.rear ↔ PR02.P1.rear` y a la vez `SW.Px ↔ PR02.P1.front`.

## Decision

1. Campo `is_passthrough` en `ports` y `device_template_ports` (default `false`).
2. Campos `source_face` / `target_face` (`front` | `rear`) en `connections`.
3. Regla de unicidad: **1 conexión física activa por `(port_id, face)`** (service 409 + índices parciales).
4. Puertos no-passthrough solo admiten cara `front`.
5. El puente interno del jack **no** se modela como `Connection`.
6. En topología, celdas passthrough exponen dos anclas (rear izquierda / front derecha).
7. **`is_passthrough` es editable** en UI (template e instancia) y vía bulk
   (`PUT /devices/:id/ports/passthrough`, `PUT /device-templates/:id/ports/passthrough`).
   No se deriva automáticamente del tipo de puerto; el backfill solo premarca candidates.
8. Vista de rack en canvas: Front / Rear / **Ambas** (dos columnas). Los equipos de la cara no activa
   ya no se ocultan cuando la vista es "Ambas", de modo que se puede cablear un patch panel del dorso
   hacia un switch del frente.

Backfill (`0035_` + ampliación `0036_`): conexiones existentes → `face = front`;
`is_passthrough = true` para device types que contengan `patch` / `cableado estructurado` / sean
exactamente `ethernet`, y para templates cuyo nombre/modelo contenga `patch panel` / `patchera` /
`panel de parcheo`. El backfill es aditivo (nunca desmarca).

## Consequences

- Switches y endpoints no cambian de comportamiento.
- Templates de patch panel deben marcar `is_passthrough` (clonado a la instancia).
- Pathfinding end-to-end vía puente queda fuera de alcance de esta decisión (puede añadirse después).
