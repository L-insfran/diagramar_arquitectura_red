# Bandejas rackeables como accesorios (Opción C)

- Status: accepted
- Date: 2026-07-31

## Context

Hace falta documentar **bandejas fijas** en rack (1U/2U) con fijación solo frontal o integral (4 postes), y equipos **apoyados** sobre ellas (ancho completo o 1/3). El modelo actual solo monta `devices` en una cara (`front`|`rear`) por U de riel; no hay profundidad ni ocupación horizontal.

## Decision

1. Catálogo global `rack_accessory_templates` (SKU de bandeja: altura U, `kind=shelf`).
2. Instancias de proyecto `rack_accessories` montadas en un rack: `unit_start`, `height_u` (1|2), `mount_type` (`front_only`|`four_post`).
3. Ocupación unificada en `RackService`:
   - `front_only` bloquea U solo en **front**.
   - `four_post` bloquea U en **front y rear** (evita solape al ver el dorso).
4. Devices pueden montarse en rieles (como hoy) **o** apoyarse en bandeja:
   - `supported_by_accessory_id` + `shelf_slot_start` (0–2) + `shelf_width_slots` (1 = tercio, 3 = ancho completo).
   - No usan `rack_unit_start`/`rack_face`; heredan `rack_id`/site/area de la bandeja.
5. Equipos apoyados visibles por defecto en vista **frontal**; la bandeja integral ocupa también el rear.

## Addendum — altura vertical de equipos apoyados (2026-07-31)

Los equipos apoyados ocupan una **huella vertical** además de los tercios horizontales:

1. Campo por instancia `devices.shelf_height_u` (nullable, 1–20). Default en runtime = `deviceTemplate.rackUnits`.
2. Anclado en `shelf.unitStart`; crece hacia arriba → rango `[unitStart, unitStart + shelfHeightU - 1]`.
3. Esa huella **reserva U reales** en las caras de la bandeja (`front_only` → front; `four_post` → front+rear): bloquea montaje en rieles, otras bandejas y cuenta en `usedU` / `RackUnitPicker`.
4. El canvas dibuja el alto completo (sin recortar a la altura de la bandeja). Migración `0039_`.

## Consequences

- Accesorios ≠ devices (sin puertos/conexiones). Escala a blanking/cable managers.
- Occupancy y topología fusionan devices + accessories + huellas de equipos apoyados.
- Migración `0038_` (+ `0039_` para altura); API `/rack-accessory-templates` y `/rack-accessories`.
