# ADR 0014: Layout independiente por modo (libre / árbol)

**Estado:** Aceptado  
**Fecha:** 2026-08-21  
**Relacionado:** [ADR 0013](0013-puertos-completos-y-modo-arbol.md)

## Contexto

El modo libre y el modo árbol compartían las mismas columnas de geometría (`node_positions`, `edge_routes`, `label_offsets`, `handle_anchors`), pero usan sistemas de coordenadas incompatibles:

- **Libre:** posiciones de equipos relativas al contenedor padre (React Flow `parentId`).
- **Árbol:** posiciones absolutas sobre el canvas (sin contenedores dibujados).

Al activar el modo árbol, el frontend sobrescribía `node_positions` con dagre y vaciaba `edge_routes` / `handle_anchors`, destruyendo el layout libre guardado. Al volver a libre, las coordenadas absolutas del árbol se reinterpretaban como relativas al contenedor → desorden y solapamiento.

## Decisión

1. Las columnas actuales de geometría son **exclusivamente el layout libre**.
2. Nueva columna JSONB `tree_layout` (migración `0059`) con el bucket del árbol:

```json
{
  "nodePositions": {},
  "edgeRoutes": {},
  "labelOffsets": {},
  "handleAnchors": {}
}
```

3. `containers` y `settings` siguen **compartidos** (membresía y opciones comunes).
4. «Guardar layout» escribe solo el bucket del modo activo.
5. Cambiar de vista **no** recalcula ni borra geometría. Dagre solo corre la **primera** vez que un diagrama entra a árbol sin `tree_layout.nodePositions`.
6. «Reorganizar árbol» escribe únicamente en `tree_layout`.
7. Backfill: diagramas con `layout_mode = 'tree'` copian la geometría actual a `tree_layout` y limpian las columnas libres (coordenadas de árbol corruptas para la vista libre).
8. `reparentDeviceInDiagrams` / `removeDeviceFromAllDiagrams` limpian el device en **ambos** buckets.

## Consecuencias

- Cada vista conserva el último layout guardado por el usuario.
- Diagramas existentes en modo libre no cambian.
- Diagramas que quedaron en árbol recuperan su forma en árbol; al volver a libre los equipos se apilan limpios dentro de cada contenedor hasta que el usuario guarde un layout libre.
- El diálogo de confirmación al cambiar de modo se elimina (ya no hay pérdida de layout del otro modo).
- Se actualiza parcialmente ADR 0013: el cambio a árbol ya no recalcula ni limpia el layout libre.
