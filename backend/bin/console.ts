import 'reflect-metadata'
import { configDotenv } from 'dotenv'
configDotenv()
import { Ignitor } from '@adonisjs/core'

const app = new Ignitor(new URL('../', import.meta.url))

app.ace()
  .handle(process.argv.splice(2))
  .then(() => process.exit(0))
  .catch(console.error)
