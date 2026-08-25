# ADR 0013: Puertos completos, anclas neutrales y modo árbol

**Estado:** Aceptado  
**Fecha:** 2026-08-19  
**Supersede:** parcialmente convenciones de handle `out:`/`in:` del canvas (legacy soportado al leer)

## Contexto

El diagrama de conexión mostraba handles de puerto **solo cuando ya existía un `diagram_link`**. El id del handle codificaba el rol del enlace (`out:port:{uuid}` / `in:port:{uuid}`), lo que impedía mostrar todos los puertos del inventario y persistir anclas antes de crear enlaces.

Los operadores necesitan:

- Ver **todos los puertos** al agregar equipos.
- Defaults de lado: origen izquierda / destino derecha (modo libre); origen abajo / destino arriba (modo árbol).
- Reordenar anclas con arrastre fluido.
- Un **modo árbol** con layout jerárquico automático (dagre).

## Decisión

### 1. Identidad neutral del handle

- Id canónico: `port:{uuid}` o `label:{encoded}` (texto libre).
- El rol (`source` / `target`) se deriva del `diagram_link`, no del id.
- Al leer `handle_anchors`, se normalizan claves legacy `out:`/`in:` → neutral.

### 2. Slots de puerto (`devicePortSlots.ts`)

- `resolveDevicePortSlots` construye la lista completa desde `inventory[].data.ports`.
- Settings en `connection_diagrams.settings`:
  - `portDisplay`: `'all' | 'connected'` (default `'all'`)
  - `portFlowInverted`: boolean (intercambia lados default)
- Puertos sin enlace: estilo compacto; con enlace: destacado.

### 3. Persistencia

- Migración `0058`: columna `layout_mode` (`free` | `tree`, default `free`).
- Validator de update acepta `handleAnchors`, `layoutMode`, y `nodePositions` con `width`/`height`.
- `duplicate` copia `handleAnchors` y `layoutMode`.

### 4. Modo árbol

- Propiedad persistida `layout_mode = 'tree'`.
- Canvas: equipos visibles como nodos raíz; **no** se dibujan contenedores área/rack/tablero.
- Membresía en `containers[].deviceIds` intacta → volver a `free` restaura vista física.
- Posiciones: `computeTreeLayout` (dagre, `rankdir: TB`); botón «Reorganizar árbol».
- Cambio de modo **no** destruye el layout del otro modo. La geometría de árbol vive en `tree_layout` (ADR 0014); dagre solo corre la primera vez que no hay layout de árbol guardado.

## Consecuencias

- Diagramas existentes pueden cambiar visualmente los lados default de puertos no movidos manualmente; mitigado con `portFlowInverted`.
- Equipos con muchos puertos crecen en alto; mitigado con `portDisplay: 'connected'`.
- El frontend es la fuente de verdad del layout de anclas; el backend persiste JSONB sin reinterpretar geometría.
- **Supersedido en parte por ADR 0014:** el layout libre y el de árbol son buckets independientes; cambiar de vista ya no sobrescribe `node_positions` libres.
