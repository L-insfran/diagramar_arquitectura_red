import server from '@adonisjs/core/services/server'
import router from '@adonisjs/core/services/router'

server.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
])

router.use([
  () => import('@adonisjs/cors/cors_middleware'),
])
