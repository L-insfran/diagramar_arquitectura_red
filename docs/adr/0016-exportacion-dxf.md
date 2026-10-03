# ADR 0016: Exportación DXF del diagrama de conexión

**Estado:** Aceptado  
**Fecha:** 2026-10-02  
**Relacionado:** [ADR 0009](0009-diagramas-multiples-y-ruteo-ortogonal.md), [ADR 0014](0014-layout-por-modo-de-diagrama.md)

## Contexto

El PDF del diagrama es una captura raster. Quien abre el archivo en AutoCAD no puede editar líneas, capas ni textos. El DXF es el formato de intercambio abierto; el DWG es propietario y no hay un escritor JavaScript fiable.

La geometría ya está en el canvas: contenedores, equipos, puertos y polilíneas ortogonales. La vista activa (libre o árbol) es la que el usuario está viendo.

## Decisión

1. La exportación DXF se genera en el navegador, sin endpoint ni migración.
2. La fuente es el estado vivo del canvas (`getExportScene`), no la captura PNG ni un layout guardado distinto del que está en pantalla.
3. Unidades en milímetros, a la escala de impresión al 100%. El eje Y se invierte para que CAD lo lea hacia arriba.
4. Capas separadas: áreas, racks, tableros, equipos, puertos, un enlace por medio, etiquetas y rótulo.
5. El archivo cubre el diagrama completo, no el marco de impresión.
6. DWG queda fuera. Si más adelante hace falta, se convierte este DXF en el servidor.

## Consecuencias

- El PDF no cambia.
- Íconos y esquinas redondeadas no se exportan: el DXF usa rectángulos y polilíneas.
- La tabla de referencia de enlaces sigue solo en el PDF.
