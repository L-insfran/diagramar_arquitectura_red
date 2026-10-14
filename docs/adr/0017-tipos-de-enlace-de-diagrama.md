# ADR 0017: Tipos de enlace de diagrama

**Estado:** Aceptado  
**Fecha:** 2026-10-13  
**Relacionado:** [ADR 0010](0010-diagram-links-simplificados.md)

## Contexto

En el diagrama de conexión todos los `diagram_links` se pintan del mismo color. El selector que el modal llamaba «Tipo de enlace» guarda `cable_type_id`: el medio físico (UTP, fibra), un catálogo global. La función del enlace en la documentación (anillo, acceso a un equipo final, troncal) es otra cosa y cambia de nombre y de color según el proyecto.

## Decisión

1. Catálogo **`diagram_link_types`** con scope de proyecto: `name`, `color` hex, `line_style`, `description`, `sort_order`, `is_default`, soft delete y auditoría.
2. `diagram_links.link_type_id` es opcional. El color y el estilo de línea no se copian al enlace: cambiarlos en el tipo actualiza todos los trazos de ese tipo.
3. Sin tipo, el trazo sigue en azul continuo (`#3b82f6`). Una ruta desactualizada sigue en ámbar con guiones, por encima del estilo del tipo.
4. `line_style` es un enum cerrado: `solid`, `long_dash`, `short_dash`, `dotted`, `dash_dot`, `dash_dot_dot`. El patrón visual vive en el cliente. Los tipos ya creados quedan en `solid`.
5. `cable_types` permanece como medio físico. Alta y edición del enlace eligen ambos, por separado.
6. Borrar un tipo que todavía tiene enlaces activos responde 409.
7. Como máximo un tipo por defecto activo por proyecto. El nombre es único entre filas activas del proyecto, sin distinguir mayúsculas.

## Consecuencias

- Migración `0063_create_diagram_link_types.ts`. El estilo de línea entra en `0064_diagram_link_types_line_style.ts`.
- El canvas, la leyenda, la tabla de referencia, el PDF y el DXF leen el color y el estilo del tipo. En el DXF el trazo discontinuo se parte en segmentos: el visor de AutoCAD ignora el LTYPE cuando la polilínea tiene ancho. La capa por medio no cambia.
- No hay tipos sembrados: cada proyecto los crea.

## Related

- [0010](0010-diagram-links-simplificados.md) — enlaces simplificados
