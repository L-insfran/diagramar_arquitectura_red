import { configDotenv } from 'dotenv'
configDotenv()
import pkg from 'pg'
const { Client } = pkg

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
})

await client.connect()

const result = await client.query(`SELECT email, password FROM system_users WHERE email = 'admin@demo.local'`)
const row = result.rows[0]
console.log('Stored hash:', row.password)

// Test with @phc-crypto/bcrypt (what AdonisJS hash uses internally)
const { Bcrypt } = await import('@adonisjs/hash/drivers/bcrypt')
const driver = new Bcrypt({ rounds: 10 })
const isValid = await driver.verify(row.password, 'admin123')
console.log('AdonisJS bcrypt driver verify result:', isValid)

// Also test making a new hash and verifying
const newHash = await driver.make('admin123')
console.log('New hash preview:', newHash.substring(0, 20))
const isNewValid = await driver.verify(newHash, 'admin123')
console.log('New hash verify:', isNewValid)

await client.end()
process.exit(0)
