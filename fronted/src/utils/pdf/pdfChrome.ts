import type { jsPDF } from 'jspdf'
import { FOOTER_H, HEADER_H, MARGIN, SECTOR_HEADER_H } from './a4Geometry'

export type PdfHeaderBranding = {
  logoDataUrl?: string
  reportTagline?: string
}

export function drawHeader(
  pdf: jsPDF,
  pageW: number,
  title: string,
  projectName: string | undefined,
  subtitle: string | undefined,
  authorName: string | undefined,
  dateStr: string,
  branding?: PdfHeaderBranding,
) {
  pdf.setFillColor(15, 23, 42)
  pdf.rect(0, 0, pageW, HEADER_H - 4, 'F')

  const logoMaxH = 12
  const logoMaxW = 48
  const logoY = 4.5
  const hasLogo = Boolean(branding?.logoDataUrl)
  const tagline = branding?.reportTagline?.trim() || undefined
  const rightReserved = 52
  let brandBottom = logoY

  if (hasLogo && branding?.logoDataUrl) {
    try {
      const format = branding.logoDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
      const props = pdf.getImageProperties(branding.logoDataUrl)
      const aspect = props.width / Math.max(1, props.height)
      let logoW = logoMaxH * aspect
      let logoH = logoMaxH
      if (logoW > logoMaxW) {
        logoW = logoMaxW
        logoH = logoW / aspect
      }
      pdf.addImage(branding.logoDataUrl, format, MARGIN, logoY, logoW, logoH)
      brandBottom = logoY + logoH
    } catch {
      // logo inválido: continuar solo con texto
    }

    if (tagline) {
      pdf.setFontSize(6.5)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(180, 190, 210)
      pdf.text(tagline, MARGIN, brandBottom + 3.5, {
        maxWidth: pageW - MARGIN * 2 - rightReserved,
      })
      brandBottom += 5
    }
  } else if (projectName) {
    // Sin logo: el nombre del proyecto actúa como marca (comportamiento legacy)
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text(projectName, MARGIN, 13)
    brandBottom = 13

    if (tagline) {
      pdf.setFontSize(6.5)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(180, 190, 210)
      pdf.text(tagline, MARGIN, 18, {
        maxWidth: pageW - MARGIN * 2 - rightReserved,
      })
      brandBottom = 18
    }
  }

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(hasLogo || projectName ? 10 : 14)
  pdf.setFont('helvetica', hasLogo || projectName ? 'normal' : 'bold')
  const titleY = hasLogo || projectName ? Math.max(24, brandBottom + 6) : 15
  pdf.text(title, MARGIN, titleY)

  if (subtitle) {
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(200, 200, 200)
    pdf.text(subtitle, MARGIN, titleY + 8, {
      maxWidth: pageW - MARGIN * 2 - rightReserved,
    })
  }

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.text(dateStr, pageW - MARGIN, 13, { align: 'right' })

  if (authorName) {
    pdf.setFontSize(7)
    pdf.text(`Generado por: ${authorName}`, pageW - MARGIN, 20, { align: 'right' })
  }

  pdf.setDrawColor(59, 130, 246)
  pdf.setLineWidth(0.6)
  pdf.line(0, HEADER_H - 4, pageW, HEADER_H - 4)
}

export function drawSectorHeader(
  pdf: jsPDF,
  pageW: number,
  title: string,
  projectName: string | undefined,
  sectorLabel: string,
) {
  pdf.setFillColor(30, 41, 59)
  pdf.rect(0, 0, pageW, SECTOR_HEADER_H, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.text(projectName ? `${projectName} — ${title}` : title, MARGIN, 10)

  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(180, 190, 210)
  pdf.text(sectorLabel, MARGIN, 17)

  pdf.setDrawColor(59, 130, 246)
  pdf.setLineWidth(0.4)
  pdf.line(0, SECTOR_HEADER_H, pageW, SECTOR_HEADER_H)
}

export function drawGridIndicator(
  pdf: jsPDF,
  pageW: number,
  cols: number,
  rows: number,
  activeCol: number,
  activeRow: number,
) {
  const cellSize = 6
  const gap = 1.5
  const gridW = cols * (cellSize + gap) - gap
  const startX = pageW - MARGIN - gridW
  const startY = SECTOR_HEADER_H + 2

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (cellSize + gap)
      const y = startY + r * (cellSize + gap)
      if (r === activeRow && c === activeCol) {
        pdf.setFillColor(59, 130, 246)
        pdf.rect(x, y, cellSize, cellSize, 'F')
      } else {
        pdf.setFillColor(226, 232, 240)
        pdf.rect(x, y, cellSize, cellSize, 'F')
      }
    }
  }
}

export function drawLegend(pdf: jsPDF, _pageW: number, pageH: number) {
  const legendY = pageH - FOOTER_H - 6
  pdf.setFontSize(6)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(100, 100, 100)
  pdf.text('LEYENDA:', MARGIN, legendY)

  const items = [
    { color: [59, 130, 246] as [number, number, number], label: 'Cable UTP', dash: false },
    { color: [249, 115, 22] as [number, number, number], label: 'Fibra óptica', dash: false },
    { color: [34, 197, 94] as [number, number, number], label: 'WiFi', dash: true },
  ]

  let x = MARGIN + 17
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6)
  for (const item of items) {
    pdf.setDrawColor(item.color[0], item.color[1], item.color[2])
    pdf.setLineWidth(0.8)
    if (item.dash) {
      for (let dx = 0; dx < 8; dx += 3) pdf.line(x + dx, legendY - 1.2, x + dx + 1.5, legendY - 1.2)
    } else {
      pdf.line(x, legendY - 1.2, x + 8, legendY - 1.2)
    }
    pdf.setTextColor(80, 80, 80)
    pdf.text(item.label, x + 11, legendY)
    x += 32
  }

  x += 2
  pdf.setTextColor(80, 80, 80)
  pdf.text('Trunk / Access', x, legendY)
  x += 28

  const statusItems = [
    { color: [250, 204, 21] as [number, number, number], label: 'Planificada' },
    { color: [96, 165, 250] as [number, number, number], label: 'Implementada' },
    { color: [52, 211, 153] as [number, number, number], label: 'Verificada' },
  ]
  for (const item of statusItems) {
    pdf.setFillColor(item.color[0], item.color[1], item.color[2])
    pdf.circle(x + 1, legendY - 1.2, 1, 'F')
    pdf.setTextColor(80, 80, 80)
    pdf.text(item.label, x + 4, legendY)
    x += 24
  }
}

export function drawFooter(
  pdf: jsPDF,
  pageW: number,
  pageH: number,
  page: number,
  total: number,
  _dateStr: string,
  sectionLabel?: string,
) {
  const y = pageH - 6
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.2)
  pdf.line(MARGIN, y - 4, pageW - MARGIN, y - 4)

  pdf.setFontSize(6)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(150, 150, 150)
  pdf.text('Network Architecture Documenter', MARGIN, y)
  if (sectionLabel) {
    pdf.text(sectionLabel, pageW / 2, y, { align: 'center' })
  }
  pdf.text(`Página ${page} de ${total}`, pageW - MARGIN, y, { align: 'right' })
}

export function safePdfFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '_')
}
