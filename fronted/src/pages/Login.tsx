import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Input } from '../components/Input'
import { Button } from '../components/Button'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError('Email o contraseña inválidos')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-gray-50 px-4 py-3 dark:bg-gray-950">
      <div className="flex w-full min-w-0 max-w-md flex-col">
        <div className="mb-4 text-center sm:mb-5">
          <h1>
            <img
              src="/infrared-px-logo.jpg"
              alt="InfraRed PX Control"
              className="mx-auto h-auto max-h-[min(28dvh,12.5rem)] w-full max-w-full rounded-2xl object-contain shadow-lg ring-1 ring-black/10"
            />
          </h1>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Documentá conexiones de comunicación de forma rápida
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@demo.local"
              required
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresá tu contraseña"
              required
            />
            <Button type="submit" isLoading={isLoading} className="w-full">
              Iniciar sesión
            </Button>
          </form>
        </div>

        <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-500">
          Plataforma de documentación de infraestructura
        </p>
      </div>
    </div>
  )
}
