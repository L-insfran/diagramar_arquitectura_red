# Storage decision — attachments Phase 6

- Status: accepted
- Date: 2026-07-30

## Context

Fase 6 requiere adjuntos (PDF, planos, fotos, diagramas, links) y secretos cifrados.
No existe aún Drive/S3/Netlify Blobs en el backend Adonis; bodyparser ya acepta multipart (20mb).

## Decision

1. **Metadata en PostgreSQL** (`attachments`, `secrets`) con polimorfismo `attachable_type` + `attachable_id` y `project_id` para scope.
2. **Bytes de archivo en disco local**: `backend/storage/attachments/{projectId}/{attachmentId}/…`.
3. Descarga autenticada vía `GET /api/attachments/:id/download` (no servir estático público).
4. Links y notas no requieren storage.
5. Secretos: AES-256-GCM vía `crypto_service` (mismo patrón que employee credentials); ciphertext nunca en list/show; `GET …/reveal` solo roles con mutate.

## Consequences

- Simple de operar en local y VPS; hay que respaldar el directorio `storage/`.
- Migración futura a S3/Drive/Blobs: sustituir solo la capa de storage (path → object key) sin cambiar el contrato API.
- `.gitignore` debe excluir `backend/storage/attachments/**` (mantener `.gitkeep`).
