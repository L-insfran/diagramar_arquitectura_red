import { defineConfig, drivers } from '@adonisjs/core/encryption'

const appKey = process.env.APP_KEY || 'network-manager-secret-key-2024!!'

export default defineConfig({
  default: 'app',
  list: {
    app: drivers.aes256cbc({
      id: 'app',
      keys: [appKey],
    }),
  },
})
