export type DeviceTemplateFilters = {
  deviceTypeId?: string
  search?: string
}

export type CreateDeviceTemplateInput = {
  deviceTypeId: string
  name: string
  manufacturer?: string | null
  model?: string | null
  rackUnits?: number | null
  imageUrl?: string | null
  frontViewUrl?: string | null
  rearViewUrl?: string | null
  powerConsumptionW?: number | null
  weightKg?: number | null
  customFields?: Record<string, unknown> | null
  notes?: string | null
}

export type UpdateDeviceTemplateInput = {
  deviceTypeId?: string
  name?: string
  manufacturer?: string | null
  model?: string | null
  rackUnits?: number | null
  imageUrl?: string | null
  frontViewUrl?: string | null
  rearViewUrl?: string | null
  powerConsumptionW?: number | null
  weightKg?: number | null
  customFields?: Record<string, unknown> | null
  notes?: string | null
}

export type CreateDeviceTemplatePortInput = {
  name: string
  portNumber: number
  portType: string
  speed?: string | null
  description?: string | null
  isPassthrough?: boolean
}

export type UpdateDeviceTemplatePortInput = {
  name?: string
  portNumber?: number
  portType?: string
  speed?: string | null
  description?: string | null
  isPassthrough?: boolean
}
