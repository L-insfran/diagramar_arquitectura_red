import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

/**
 * Derives a stable 32-byte key from APP_KEY using SHA-256.
 * This avoids requiring a separate hex-encoded env var while reusing
 * the existing secret already present in the environment.
 */
function getKey(): Buffer {
  const appKey = process.env.APP_KEY ?? 'network-manager-secret-key-2024!!'
  return createHash('sha256').update(appKey).digest()
}

/**
 * Encrypts plaintext using AES-256-GCM with a random IV per call.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex-encoded).
 */
export function encryptText(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a ciphertext string produced by encryptText.
 * Throws if the ciphertext is malformed or the key/tag is invalid.
 */
export function decryptText(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format')
  }
  const [ivHex, authTagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
