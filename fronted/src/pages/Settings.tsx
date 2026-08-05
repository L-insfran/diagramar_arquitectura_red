import { Sun, Moon, Users, ChevronRight, Tags, Cable, Box, Building2, HardDrive, Network, Image } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import { Button } from '../components/Button'
import { systemBrandingService } from '../services/systemBranding.service'
import type { SystemBranding } from '../types'

export default function SettingsPage() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { isAdmin, canMutate, isGlobalAdmin } = usePermissions()
  const navigate = useNavigate()
  const toast = useToast()

  const [branding, setBranding] = useState<SystemBranding | null>(null)
  const [tagline, setTagline] = useState('')
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [brandingSaving, setBrandingSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [])

  const loadBranding = useCallback(async () => {
    if (!isGlobalAdmin) return
    try {
      const data = await systemBrandingService.get()
      setBranding(data)
      setTagline(data.reportTagline ?? '')
      revokePreview()
      setPendingFile(null)
      if (data.hasLogo) {
        const url = await systemBrandingService.fetchLogoObjectUrl()
        if (url) {
          previewUrlRef.current = url
          setLogoPreviewUrl(url)
        } else {
          setLogoPreviewUrl(null)
        }
      } else {
        setLogoPreviewUrl(null)
      }
    } catch {
      toast.error('No se pudo cargar la marca de reportes')
    }
    // toast omitido a propósito: el objeto cambia con cada toast y dispararía un loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlobalAdmin, revokePreview])

  useEffect(() => {
    void loadBranding()
    return () => revokePreview()
  }, [loadBranding, revokePreview])

  const onPickFile = (file: File | null) => {
    if (!file) return
    setPendingFile(file)
    revokePreview()
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setLogoPreviewUrl(url)
  }

  const handleSaveBranding = async () => {
    setBrandingSaving(true)
    try {
      const fileToUpload = pendingFile
      const updated = await systemBrandingService.update({
        reportTagline: tagline.trim() || null,
        file: fileToUpload,
      })
      setBranding(updated)
      setPendingFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (updated.hasLogo) {
        revokePreview()
        const url = await systemBrandingService.fetchLogoObjectUrl()
        if (url) {
          previewUrlRef.current = url
          setLogoPreviewUrl(url)
        }
      }
      toast.success('Marca de reportes guardada')
    } catch (err: any) {
      toast.error(
        'No se pudo guardar',
        err?.response?.data?.message || 'Revisa el archivo y el tagline.'
      )
    } finally {
      setBrandingSaving(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (pendingFile && !branding?.hasLogo) {
      setPendingFile(null)
      revokePreview()
      setLogoPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setBrandingSaving(true)
    try {
      const updated = await systemBrandingService.deleteLogo()
      setBranding(updated)
      setPendingFile(null)
      revokePreview()
      setLogoPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('Logo eliminado')
    } catch {
      toast.error('No se pudo eliminar el logo')
    } finally {
      setBrandingSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" subtitle="Gestiona tu cuenta y preferencias" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Perfil">
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                {user?.firstName?.charAt(0) || 'U'}
                {user?.lastName?.charAt(0) || ''}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {user ? `${user.firstName} ${user.lastName}` : 'User'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-medium capitalize">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Apariencia">
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Tema</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Usando modo {theme === 'dark' ? 'oscuro' : 'claro'}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={toggleTheme}
              icon={theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            >
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </Button>
          </div>
        </Card>

        {isGlobalAdmin && (
          <Card title="Marca de reportes">
            <div className="mt-4 space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Logo global de la cabecera de los PDF. Si hay logo, reemplaza el nombre del
                proyecto en la marca (no se muestra el nombre al lado).
              </p>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 border border-gray-700">
                  {logoPreviewUrl ? (
                    <img
                      src={logoPreviewUrl}
                      alt="Logo de reportes"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <Image className="w-7 h-7 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                    className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-500/10 file:text-blue-500 hover:file:bg-blue-500/20"
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    PNG, JPG, WebP o SVG · máx. 5 MB
                    {branding?.logoOriginalFilename
                      ? ` · actual: ${branding.logoOriginalFilename}`
                      : ''}
                  </p>
                </div>
              </div>
              <Input
                label="Tagline (opcional)"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="p. ej. Process Automation Experts"
                maxLength={255}
                hint="Texto pequeño bajo el nombre del proyecto en el header del PDF"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleSaveBranding()} disabled={brandingSaving}>
                  {brandingSaving ? 'Guardando…' : 'Guardar'}
                </Button>
                {(branding?.hasLogo || pendingFile) && (
                  <Button
                    variant="secondary"
                    onClick={() => void handleRemoveLogo()}
                    disabled={brandingSaving}
                  >
                    Quitar logo
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {canMutate && (
          <Card title="Sitios y áreas">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Ubicación física
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Sedes y áreas de inventario (distinto de zonas del diagrama)
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/sites')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

        {canMutate && (
          <Card title="Racks">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Gabinetes y ocupación U
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Visor de ocupación U y montaje de equipos
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/racks')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

        {canMutate && (
          <Card title="Templates de dispositivo">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Box className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Catálogo de templates
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Catálogo global: marca, modelo, U y puertos reutilizables en todos los proyectos
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/device-templates')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

        {isAdmin && (
          <Card title="Tipos de dispositivo">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Tags className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Catálogo de tipos
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Agregar, editar y eliminar tipos para dispositivos
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/device-types')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

        {isAdmin && (
          <Card title="Tipos de puerto">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Cable className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Catálogo de puertos
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Velocidad, color, dirección e icono por tipo
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/port-types')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

        {isAdmin && (
          <Card title="Tipos de cable">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Network className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Catálogo de cables
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    UTP, fibra, DAC y otros medios documentables
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/cable-types')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

        {isAdmin && (
          <Card title="Usuarios del sistema">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Gestión de usuarios
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Crear, editar y eliminar usuarios del sistema
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/users')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
