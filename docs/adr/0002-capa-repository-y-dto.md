# ADR 0002 — Capa Repository y DTO

- **Estado:** Aceptado
- **Fecha:** 2026-07-29
- **Aceptado:** 2026-07-30
- **Relacionado:** Visión Controller → Service → Repository → DTO → Validator
- **Piloto:** módulo `devices` (Fase 1b)

## Contexto

La visión exige:

```
Controller → Service → Repository → DTO → Validator
```

Antes el backend usaba Controller → Service → Model Lucid, sin carpeta `repositories/` ni DTOs formales.

## Decisión

Adoptar la capa de forma **incremental y obligatoria hacia adelante**:

1. **Módulos nuevos:** siempre Service + Repository + DTO + Validator. El Controller no toca Lucid.
2. **Módulos tocados:** al modificar un flujo existente, extraer acceso a datos hacia Repository y tipar con DTO.
3. **No** reescribir todos los services en un solo PR.
4. Repository encapsula queries Lucid. Service contiene reglas de negocio.
5. DTO: interfaces TypeScript en `backend/app/dtos/`.

Ubicación canónica:

```
backend/app/repositories/
backend/app/dtos/
```

Aliases: `#repositories/*`, `#dtos/*`.

## Consecuencias

- Primer módulo migrado: `devices` (con auditoría y soft delete en esa tabla).
- Controllers que aún usan Model: migrarlos al tocarlos.
- Soft delete / auditoría se extienden tabla por tabla, no de golpe.
