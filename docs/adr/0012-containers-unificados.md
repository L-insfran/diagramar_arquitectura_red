# Contenedores unificados (`containers`)

- Status: accepted
- Date: 2026-08-19

## Context

El inventario físico modela racks (ADR 0006) y tableros/boards (ADR 0008) como tablas separadas con FKs independientes en `devices`. Los dispositivos "sueltos" en un área no tienen contenedor explícito. En el diagrama de conexión, los containers JSONB usan keys `rack:{id}` y `board:{id}` por separado. Esto complica la jerarquía conceptual y la UI al añadir nuevos tipos de contenedor.

La jerarquía objetivo es:

```
Proyecto → Sitio → Área → Contenedor (default | rack | board) → Dispositivo → Puertos → Enlaces
```

## Decision

1. Nueva tabla **`containers`** scoped por proyecto, hija de `areas`.
2. Columna **`kind`**: `'default' | 'rack' | 'board'`.
3. Campos comunes: `name`, `code`, `manufacturer`, `model`, `notes`, soft delete (`deleted_at`, `deleted_by`) + auditoría (`created_by`, `updated_by`).
4. Específicos rack: `height_u` (obligatorio si `kind = 'rack'`, CHECK).
5. Específicos board: `board_kind` (`'electrical' | 'communications' | 'generic'`), `grid_rows`, `grid_cols` (obligatorios si `kind = 'board'`, CHECK).
6. `kind = 'default'`: sin U ni grilla; agrupa equipos "sueltos" del área. Se crea automáticamente por área si no existe al asignar un device sin rack/board.
7. Devices: un solo FK **`container_id`** reemplaza `rack_id` y `board_id`. Post-migración todo device tiene `container_id` (los de área van a un contenedor `default`). CHECK de exclusión mutua board↔rack se elimina.
8. `rack_accessories`: `rack_id` → `container_id`; validación de negocio: solo válido si `container.kind = 'rack'`.
9. Diagramas: keys JSONB migran de `rack:{id}` / `board:{id}` a `container:{id}`; áreas siguen `area:{id}`.
10. Preservar UUIDs: al migrar racks/boards a containers se conserva el mismo `id` para no romper FKs ni JSON del diagrama.
11. Tablas `racks` y `boards` se dropean tras completar la migración de código.
12. **No se unifican** `connections` y `diagram_links` (siguen como capas distintas — ADR 0005 / 0010).

## Consequences

- Migraciones `0054`–`0056` (crear containers, backfill, cutover devices/accessories/diagrams, drop racks/boards).
- API: `/api/containers` reemplaza `/api/racks` y `/api/boards`. Endpoint `GET /containers/:id/occupancy` delega a lógica U vs grilla según `kind`.
- Frontend: una sola página Contenedores con filtro por tipo; formularios condicionados a `kind`.
- Sidebar: entrada "Contenedores" reemplaza "Racks".
- `ContainerService` delega ocupación a sub-servicios rack-layout / board-layout según `kind`.
- Reglas de montaje en `DeviceService` (prioridad): board-container → accessory → rack-container → default-container.

## Deuda pendiente

- **Auto-creación de contenedor default**: el ADR indica "Se crea automáticamente por área si no existe al asignar un device sin rack/board", pero `DeviceService` no implementa esa lógica. Un device sin `containerId` queda con `container_id = NULL` y no aparece en el diagrama. Se requiere un `ensureDefaultContainer(areaId)` en `DeviceService.create/update`.
- Migración `0057` añadió `UNIQUE INDEX containers_area_default_uidx ON containers (area_id) WHERE kind = 'default' AND deleted_at IS NULL` para blindar la unicidad.

## Related

- [0006](0006-rack-shelves-accessories.md) — accesorios de rack (superseded parcialmente por container_id)
- [0008](0008-boards-como-contenedor-fisico.md) — boards (superseded por containers kind=board)
- [0009](0009-diagramas-multiples-y-ruteo-ortogonal.md) — diagramas múltiples
- [0010](0010-diagram-links-simplificados.md) — diagram_links
