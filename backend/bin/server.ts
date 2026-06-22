import 'reflect-metadata'
import { configDotenv } from 'dotenv'
configDotenv()
import { Ignitor } from '@adonisjs/core'

const app = new Ignitor(new URL('../', import.meta.url))

app.httpServer()
  .start()
  .catch(console.error)
