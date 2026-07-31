# Architecture Decision Records (ADR)

Los ADR documentan decisiones de arquitectura significativas: contexto, opciones, decisión y consecuencias.

## Cómo agregar uno

1. Copiar el formato de un ADR existente.
2. Numerar secuencialmente: `0003-titulo-kebab-case.md`.
3. Estado inicial: `Propuesto` o `Abierto`.
4. Al decidir: pasar a `Aceptado` (o `Rechazado` / `Superseded`) y fechar.
5. Enlazar desde [ROADMAP.md](../ROADMAP.md) o [ARCHITECTURE.md](../ARCHITECTURE.md) si afecta la hoja de ruta.

## Índice

| ADR | Título | Estado |
|-----|--------|--------|
| [0001](0001-project-como-scope-raiz.md) | Project como scope raíz (Company vs Project) | Aceptado (opción A) |
| [0002](0002-capa-repository-y-dto.md) | Introducir capa Repository y DTO | Aceptado |
| [0003](0003-attachments-storage-local.md) | Storage local para attachments | Aceptado |
| [0004](0004-device-templates-globales.md) | Device templates como catálogo global | Aceptado |
| [0005](0005-port-passthrough-faces.md) | Port passthrough con caras front/rear | Aceptado |
