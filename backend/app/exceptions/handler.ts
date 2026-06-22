import { ExceptionHandler, type HttpContext } from '@adonisjs/core/http'

export default class Handler extends ExceptionHandler {
  async handle(error: any, ctx: HttpContext) {
    const code = error?.code
    if (code === 'E_VALIDATION_FAILURE' || code === 'E_VALIDATION_ERROR') {
      return ctx.response.unprocessableEntity({
        success: false,
        message: 'Validation failed',
        errors: error.messages,
      })
    }

    if (code === 'E_ROW_NOT_FOUND') {
      return ctx.response.notFound({
        success: false,
        message: 'Resource not found',
      })
    }

    return ctx.response.status(error.status || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    })
  }

  async report(error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500
    if (status >= 500) {
      console.error(error)
    }
  }
}
