# Full-depth templates y cara de chasis por puerto

- Status: accepted
- Date: 2026-08-03

## Context

Los equipos full-depth (p. ej. servers) ocupan la misma U en frente y dorso del rack. El modelo solo permitía `rack_face ∈ {front, rear}` (una cara). Las bandejas `four_post` ya bloqueaban ambas caras; los devices no.

Además, los jacks de un server suelen estar en una sola cara del chasis (LAN atrás, iDRAC adelante). `is_passthrough` (ADR 0005) es otra semántica: jack puente con **dos** caras de conexión.

## Decision

1. `device_templates.is_full_depth` (boolean, default false). Al crear template con tipo Server, la UI propone `true` por defecto (editable).
2. Al montar en riel (o bandeja) un template full-depth, `devices.rack_face = 'both'`. Occupancy emite footprints en front **y** rear (misma regla que `four_post`).
3. `device_template_ports.chassis_face` + `ports.chassis_face` (`front`|`rear`, default `front`): lado físico del chasis para puertos **no** passthrough. Se clona al instanciar; editable en instancia.
4. Conexiones: passthrough = front|rear (sin cambio). No-passthrough = solo `chassis_face`.
5. Vista rack Front/Rear: dispositivos full-depth visibles en ambas; puertos filtrados por `chassis_face`. Vista Ambas: nodo real en columna frente + ghost de ocupación en dorso.

## Consequences

- Migración `0040_`; siguiente: `0041_`.
- Capacidad del rack sigue contando `heightU * 2` (caras independientes); full-depth consume 2 caras por U.
- `chassis_face` ≠ `is_passthrough`; no mezclar en UI ni validadores.
