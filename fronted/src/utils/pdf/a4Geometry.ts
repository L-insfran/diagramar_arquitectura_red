import { jsPDF } from 'jspdf'

/** Orientación de impresión / exportación PDF. */
export type PrintOrientation = 'landscape' | 'portrait'

/** Formato de hoja para exportación PDF. */
export type PaperFormat = 'a4' | 'a3'

/** Márgenes y cabeceras (mm) alineados con la exportación PDF. */
export const MARGIN = 12
/** Cabecera principal (logo + nombre + título + subtítulo). */
export const HEADER_H = 44
export const FOOTER_H = 16
export const LEGEND_H = 12
/** Cabecera compacta de páginas de sector. */
export const SECTOR_HEADER_H = 24

export type PaperRectMm = { x: number; y: number; w: number; h: number }

/** @deprecated Preferir `PaperRectMm`. */
export type A4RectMm = PaperRectMm

export type PaperGeometry = {
  format: PaperFormat
  orientation: PrintOrientation
  pageW: number
  pageH: number
  /** Área útil de la portada (vista general + leyenda). */
  cover: PaperRectMm
  /** Área útil de cada página de sector ampliado. */
  sector: PaperRectMm
  /** Área útil del cuerpo de tablas. */
  table: PaperRectMm
}

/** @deprecated Preferir `PaperGeometry`. */
export type A4Geometry = PaperGeometry

const cachedGeometry: Partial<Record<string, PaperGeometry>> = {}

function cacheKey(format: PaperFormat, orientation: PrintOrientation): string {
  return `${format}:${orientation}`
}

/**
 * Geometría de hoja (A4/A3) para portada, sectores y tablas.
 * Toda la exportación PDF debe dibujar dentro de estos rects.
 */
export function getPaperGeometry(
  format: PaperFormat,
  orientation: PrintOrientation,
): PaperGeometry {
  const key = cacheKey(format, orientation)
  const cached = cachedGeometry[key]
  if (cached) return cached

  const pdf = new jsPDF({ orientation, unit: 'mm', format })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  const cover: PaperRectMm = {
    x: MARGIN,
    y: HEADER_H + 2,
    w: pageW - MARGIN * 2,
    h: pageH - HEADER_H - FOOTER_H - LEGEND_H - 4,
  }

  const sector: PaperRectMm = {
    x: MARGIN,
    y: SECTOR_HEADER_H + 2,
    w: pageW - MARGIN * 2,
    h: pageH - SECTOR_HEADER_H - 2 - FOOTER_H - 4,
  }

  const table: PaperRectMm = {
    x: MARGIN,
    y: HEADER_H + 2,
    w: pageW - MARGIN * 2,
    h: pageH - HEADER_H - FOOTER_H - 22,
  }

  const value: PaperGeometry = { format, orientation, pageW, pageH, cover, sector, table }
  cachedGeometry[key] = value
  return value
}

/**
 * Geometría A4 — wrapper de compatibilidad con topología / callers legacy.
 */
export function getA4Geometry(orientation: PrintOrientation): PaperGeometry {
  return getPaperGeometry('a4', orientation)
}

/**
 * Área útil (mm) de la página de portada — compatibilidad con callers legacy.
 */
export function getA4DiagramUsableMm(orientation: PrintOrientation): { usableW: number; usableH: number } {
  const { cover } = getPaperGeometry('a4', orientation)
  return { usableW: cover.w, usableH: cover.h }
}

/**
 * Área útil (mm) de la portada para un formato de hoja dado.
 */
export function getPaperDiagramUsableMm(
  format: PaperFormat,
  orientation: PrintOrientation,
): { usableW: number; usableH: number } {
  const { cover } = getPaperGeometry(format, orientation)
  return { usableW: cover.w, usableH: cover.h }
}
