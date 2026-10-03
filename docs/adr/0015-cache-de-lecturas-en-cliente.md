# ADR 0015: Caché de lecturas en el cliente

**Estado:** Aceptado  
**Fecha:** 2026-10-01  
**Relacionado:** [ADR 0002](0002-capa-repository-y-dto.md)

## Contexto

Cada pantalla pide sus datos con `useApi` y descarta la respuesta al desmontarse. Sitios, tipos, plantillas y el resto de GET del proyecto se vuelven a bajar al cambiar de ruta. Una librería de caché (React Query) resuelve eso, pero mete un modelo de datos nuevo en toda la UI.

## Decisión

1. La caché vive en el cliente HTTP (axios), no en cada pantalla. `useApi` no cambia de firma.
2. Solo se guardan `GET` con cuerpo JSON y estado de éxito.
3. La clave es método + URL + `X-Project-Id`. Cambiar de proyecto no reutiliza la respuesta de otro.
4. Cada entrada vive 20 segundos. Hay un tope de entradas; se descarta la más vieja.
5. Un `POST`, `PUT`, `PATCH` o `DELETE` exitoso vacía las entradas de ese proyecto. El refetch que sigue a un guardado llega a la red.
6. No se usa React Query ni una caché en el servidor.

## Consecuencias

- Navegar entre pantallas del mismo proyecto reutiliza lecturas recientes.
- Dos pestañas no comparten esta caché: es memoria del documento.
- Un GET de archivo (`blob`) no entra en la caché.
