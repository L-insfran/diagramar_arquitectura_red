import { ExceptionHandler, type HttpContext } from '@adonisjs/core/http'

export default class Handler extends ExceptionHandler {
  async handle(error: any, ctx: HttpContext) {
    const code = error?.code
    if (code === 'E_VALIDATION_FAILURE' || code === 'E_VALIDATION_ERROR') {
      const messages = error.messages
      let detail = 'Validation failed'
      if (Array.isArray(messages) && messages[0]?.message) {
        const first = messages[0]
        detail = first.field ? `${first.field}: ${first.message}` : first.message
      }
      return ctx.response.unprocessableEntity({
        success: false,
        message: detail,
        errors: messages,
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
