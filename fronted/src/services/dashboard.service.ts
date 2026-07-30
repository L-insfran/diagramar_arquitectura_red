import api from './api'
import type { ApiResponse, DashboardMetrics } from '../types'

export const dashboardService = {
  async getMetrics(): Promise<DashboardMetrics> {
    const { data } = await api.get<ApiResponse<DashboardMetrics>>('/dashboard')
    return data.data
  },
}
