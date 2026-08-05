# Bandejas rackeables como accesorios (Opción C)

- Status: accepted
- Date: 2026-07-31

## Context

Hace falta documentar **bandejas fijas** en rack (1U/2U) con fijación solo frontal o integral (4 postes), y equipos **apoyados** sobre ellas (ancho completo o 1/3). El modelo actual solo monta `devices` en una cara (`front`|`rear`) por U de riel; no hay profundidad ni ocupación horizontal.

## Decision

1. Catálogo global `rack_accessory_templates` (SKU de bandeja: altura U, `kind=shelf`).
2. Instancias de proyecto `rack_accessories` montadas en un rack: `unit_start`, `height_u` (1–6), `mount_type` (`front_only`|`four_post`), huella horizontal en rejilla de 6 columnas.
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

## Addendum — huella horizontal 2–6 y altura 1–6U (2026-08-05)

1. El rack tiene una **rejilla horizontal fija de 6 columnas**.
2. Templates e instancias de accesorio: `height_u` ∈ **1..6**; `horizontal_slot_start` (0-based) + `horizontal_width_slots` ∈ **2..6** con `start + width ≤ 6`. Default: ancho completo (`0`, `6`).
3. La ocupación unifica footprints en columnas 0–5: rieles = ancho completo; equipos apoyados mapean tercios legacy → sextos (`start*2`, `width*2`).
4. **Equipos apoyados solo en bandejas de ancho completo** (`horizontal_width_slots = 6`). Migración `0042_`.

## Addendum — hang accessories + capacidad 3–5 (2026-08-05)

1. `kind` ampliado: `'shelf' | 'hang'`.
2. **Bandeja (`shelf`)**: sin cambio de montaje (`front_only` | `four_post`). Campo `device_slot_count` (3–5, default 3) = lugares por **cara** (full-depth = cupos independientes en front y rear).
3. **Colgante (`hang`)**: una sola cara (`face` = `front`|`rear`); `height_u` 1–5 (default 3); `device_slot_count` 3–5 (default 3). Equipos lado a lado; `shelf_height_u` ≤ `height_u` del accesorio.
4. Slots de device: `shelf_slot_start` ∈ `0..N-1`, `shelf_width_slots` con `start+width ≤ N` (`N = device_slot_count`). Mapeo a rejilla 6: `floor(i*6/N)`.
5. Migración `0043_`.

## Addendum — chassis / ordenador rackeable (2026-08-05)

1. `kind` ampliado: `'shelf' | 'hang' | 'chassis'`.
2. **Chasis (`chassis`)**: ordenador u otro SKU sólido **sin hospedar equipos** (`device_slot_count = 0`). Una cara (`face` front|rear); altura **1–4U**; ancho fijo **6/6**. Ocupa U en esa cara y bloquea montaje en rieles/otros accesorios; no admite `supported_by_accessory_id`.
3. Seed catálogo: `HCM2-19-SS-1U-BK-C`. Migración `0045_`.

## Consequences

- Accesorios ≠ devices (sin puertos/conexiones). Escala a blanking/cable managers / chassis.
- Occupancy y topología fusionan devices + accessories + huellas de equipos montados (apoyados o colgados).
- Migración `0038_` (+ `0039_` altura; `0042_` rejilla 6; `0043_` hang + slots; `0045_` chassis); API `/rack-accessory-templates` y `/rack-accessories`.
