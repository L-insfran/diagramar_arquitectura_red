#!/usr/bin/env node
// @ts-check

/**
 * Entrypoint de Ace.
 *
 * Node 24 importa .ts, pero no resuelve los imports ".js" hacia el fuente
 * ".ts" (adonisrc.ts, aliases de package.json). Sin ese resolve, Ace arranca
 * con un rc vacío y comandos como migration:status no quedan registrados.
 * tsx hace ese resolve. El import de console va después de register():
 * un import estático se evaluaría antes y el hook no alcanzaría a Adonis.
 */
import { register } from 'tsx/esm/api'

register()

await import('./bin/console.ts')
