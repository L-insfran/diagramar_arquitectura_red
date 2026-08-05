export type SystemBrandingDto = {
  reportTagline: string | null
  hasLogo: boolean
  logoMimeType: string | null
  logoOriginalFilename: string | null
  logoSizeBytes: number | null
  updatedAt: string | null
}

export type UpdateSystemBrandingInput = {
  reportTagline?: string | null
}
