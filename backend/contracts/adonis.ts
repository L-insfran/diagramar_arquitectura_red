/**
 * Ensures TypeScript merges framework augmentations (ctx.auth, request.validateUsing).
 * Included as a root source file via tsconfig "include".
 */
import '@adonisjs/auth/initialize_auth_middleware'
import '@adonisjs/core/providers/vinejs_provider'
