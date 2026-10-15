import api from './api'
import type { ApiResponse } from '../types'

export interface ReleaseNote {
  version: string
  title: string
  highlights: string[]
}

export interface ReleaseStatus {
  current: ReleaseNote | null
  unseen: ReleaseNote[]
  history: ReleaseNote[]
}

export const releasesService = {
  async status(): Promise<ReleaseStatus> {
    const { data } = await api.get<ApiResponse<ReleaseStatus>>('/system/release')
    return data.data
  },

  async acknowledge(): Promise<ReleaseStatus> {
    const { data } = await api.post<ApiResponse<ReleaseStatus>>('/system/release/ack')
    return data.data
  },
}
