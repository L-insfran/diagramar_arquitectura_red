import type {
  CableCategory,
  ConnectionMetadata,
  ConnectionStatus,
  FiberConnector,
  FiberType,
  MediumType,
  PortFace,
  WifiBand,
  WifiSecurity,
  WifiStandard,
} from '#models/connection'

export type CreateConnectionInput = {
  projectId: string
  sourcePortId: string
  targetPortId: string
  sourceFace?: PortFace
  targetFace?: PortFace
  connectionType?: 'physical' | 'logical'
  mediumType?: MediumType
  cableTypeId?: string | null
  cableCategory?: CableCategory | null
  fiberType?: FiberType | null
  fiberConnector?: FiberConnector | null
  wifiSsid?: string | null
  wifiStandard?: WifiStandard | null
  wifiBand?: WifiBand | null
  wifiSecurity?: WifiSecurity | null
  cableLength?: string | null
  connectionStatus?: ConnectionStatus
  bandwidth?: string | null
  description?: string | null
  metadata?: ConnectionMetadata | null
}

export type UpdateConnectionInput = {
  sourcePortId?: string
  targetPortId?: string
  sourceFace?: PortFace
  targetFace?: PortFace
  connectionType?: 'physical' | 'logical'
  mediumType?: MediumType
  cableTypeId?: string | null
  cableCategory?: CableCategory | null
  fiberType?: FiberType | null
  fiberConnector?: FiberConnector | null
  wifiSsid?: string | null
  wifiStandard?: WifiStandard | null
  wifiBand?: WifiBand | null
  wifiSecurity?: WifiSecurity | null
  cableLength?: string | null
  connectionStatus?: ConnectionStatus
  bandwidth?: string | null
  description?: string | null
  metadata?: ConnectionMetadata | null
}

export type UpsertCanvasLayoutInput = {
  projectId: string
  nodePositions: Record<string, { x: number; y: number }>
  labelOffsets: Record<string, { x: number; y: number; bendX?: number; bendY?: number }>
  workAreas?: Array<{
    id: string
    name: string
    x: number
    y: number
    width: number
    height: number
    titleFontSize?: number
  }>
  nodeParents?: Record<string, string>
}
