import { jsPDF } from 'jspdf'

/** Orientación de impresión / exportación PDF. */
export type PrintOrientation = 'landscape' | 'portrait'

/** Márgenes y cabeceras (mm) alineados con la exportación PDF. */
export const MARGIN = 12
/** Cabecera principal (logo + nombre + título + subtítulo). */
export const HEADER_H = 44
export const FOOTER_H = 16
export const LEGEND_H = 12
/** Cabecera compacta de páginas de sector. */
export const SECTOR_HEADER_H = 24

export type A4RectMm = { x: number; y: number; w: number; h: number }

export type A4Geometry = {
  orientation: PrintOrientation
  pageW: number
  pageH: number
  /** Área útil de la portada (vista general + leyenda). */
  cover: A4RectMm
  /** Área útil de cada página de sector ampliado. */
  sector: A4RectMm
  /** Área útil del cuerpo de tablas. */
  table: A4RectMm
}

const cachedGeometry: Partial<Record<PrintOrientation, A4Geometry>> = {}

/**
 * Geometría A4 única para portada, sectores y tablas.
 * Toda la exportación PDF debe dibujar dentro de estos rects.
 */
export function getA4Geometry(orientation: PrintOrientation): A4Geometry {
  const cached = cachedGeometry[orientation]
  if (cached) return cached

  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  const cover: A4RectMm = {
    x: MARGIN,
    y: HEADER_H + 2,
    w: pageW - MARGIN * 2,
    h: pageH - HEADER_H - FOOTER_H - LEGEND_H - 4,
  }

  const sector: A4RectMm = {
    x: MARGIN,
    y: SECTOR_HEADER_H + 2,
    w: pageW - MARGIN * 2,
    h: pageH - SECTOR_HEADER_H - 2 - FOOTER_H - 4,
  }

  const table: A4RectMm = {
    x: MARGIN,
    y: HEADER_H + 2,
    w: pageW - MARGIN * 2,
    h: pageH - HEADER_H - FOOTER_H - 22,
  }

  const value: A4Geometry = { orientation, pageW, pageH, cover, sector, table }
  cachedGeometry[orientation] = value
  return value
}

/**
 * Área útil (mm) de la página de portada — compatibilidad con callers legacy.
 */
export function getA4DiagramUsableMm(orientation: PrintOrientation): { usableW: number; usableH: number } {
  const { cover } = getA4Geometry(orientation)
  return { usableW: cover.w, usableH: cover.h }
}
