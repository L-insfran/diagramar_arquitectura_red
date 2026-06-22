import { defineConfig } from '@adonisjs/http-server'

export const appKey = process.env.APP_KEY || 'network-manager-secret-key-2024!!'

const httpConfig = defineConfig({
  generateRequestId: true,
  allowMethodSpoofing: false,
  useAsyncLocalStorage: true,
  cookie: {},
})

export default {
  appKey,
  http: httpConfig,
}
