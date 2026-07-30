import type { HttpContext } from '@adonisjs/core/http'
import DashboardService from '#services/dashboard_service'
import { requireProjectContext } from '#services/project_context_service'

export default class DashboardController {
  private dashboard = new DashboardService()

  async show(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const data = await this.dashboard.getMetrics(context.projectId)
    return ctx.response.ok({ success: true, data })
  }
}
