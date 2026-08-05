import api from './api'
import type { ApiResponse, SystemBranding } from '../types'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el logo'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Convierte un blob de imagen (incl. SVG) a PNG data URL vía canvas,
 * para que jsPDF pueda incrustarlo con addImage.
 */
export async function blobToPngDataUrl(blob: Blob): Promise<string> {
  const objectUrl = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('No se pudo decodificar el logo'))
      el.src = objectUrl
    })
    const w = Math.max(1, img.naturalWidth || img.width)
    const h = Math.max(1, img.naturalHeight || img.height)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export const systemBrandingService = {
  async get(): Promise<SystemBranding> {
    const { data } = await api.get<ApiResponse<SystemBranding>>('/system/branding')
    return data.data
  },

  async update(payload: {
    reportTagline?: string | null
    file?: File | null
  }): Promise<SystemBranding> {
    const form = new FormData()
    if (payload.reportTagline !== undefined) {
      form.append('reportTagline', payload.reportTagline ?? '')
    }
    if (payload.file) {
      form.append('file', payload.file)
    }
    const { data } = await api.put<ApiResponse<SystemBranding>>('/system/branding', form)
    return data.data
  },

  async deleteLogo(): Promise<SystemBranding> {
    const { data } = await api.delete<ApiResponse<SystemBranding>>('/system/branding/logo')
    return data.data
  },

  async fetchLogoBlob(): Promise<Blob | null> {
    try {
      const { data } = await api.get<Blob>('/system/branding/logo', {
        responseType: 'blob',
      })
      if (!data || data.size === 0) return null
      if (data.type && data.type.includes('json')) return null
      return data
    } catch {
      return null
    }
  },

  /** Preview URL (object URL) — caller must revoke. */
  async fetchLogoObjectUrl(): Promise<string | null> {
    const blob = await this.fetchLogoBlob()
    if (!blob) return null
    return URL.createObjectURL(blob)
  },

  /** PNG data URL listo para jsPDF, o null si no hay logo. */
  async fetchLogoPngDataUrl(): Promise<string | null> {
    const blob = await this.fetchLogoBlob()
    if (!blob) return null
    try {
      if (blob.type === 'image/png' || blob.type === 'image/jpeg' || blob.type === 'image/webp') {
        return blobToDataUrl(blob)
      }
      return await blobToPngDataUrl(blob)
    } catch {
      return null
    }
  },
}
