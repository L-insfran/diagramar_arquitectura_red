import type { HttpContext } from '@adonisjs/core/http'
import EmployeeCredential from '#models/employee_credential'
import Employee from '#models/employee'
import SystemUser from '#models/system_user'
import {
  canAccessProject,
  canMutateInProject,
  findLinkedEmployee,
  resolveRoleForProject,
} from '#services/authorization_service'
import {
  createEmployeeCredentialValidator,
  updateEmployeeCredentialValidator,
} from '#validators/employee_credential_validator'
import { encryptText, decryptText } from '#services/crypto_service'

function safeJson(credential: EmployeeCredential) {
  const { passwordCiphertext: _omit, ...rest } = credential.serialize() as Record<string, unknown>
  return rest
}

export default class EmployeeCredentialsController {
  /**
   * Viewer: only allowed to operate on their own linked employee's credentials.
   * Returns the linked employee or null if not linked / not matching target.
   */
  private async assertViewerOwnership(
    user: SystemUser,
    employeeId: string,
    projectId?: string
  ): Promise<Employee | null> {
    const linked = await findLinkedEmployee(user, projectId)
    if (!linked || linked.id !== employeeId) return null
    return linked
  }

  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const employeeId = request.input('employee_id') as string | undefined
    if (!employeeId) {
      return response.badRequest({
        success: false,
        message: 'employee_id query parameter is required',
      })
    }
    const employee = await Employee.findOrFail(employeeId)
    if (!(await canAccessProject(user, employee.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const role = await resolveRoleForProject(user, employee.projectId)
    if (role === 'viewer') {
      const linked = await this.assertViewerOwnership(user, employeeId, employee.projectId)
      if (!linked) {
        return response.forbidden({ success: false, message: 'Insufficient permissions' })
      }
    }
    const rows = await EmployeeCredential.query()
      .where('employee_id', employeeId)
      .orderBy('kind', 'asc')
      .orderBy('created_at', 'asc')
    return response.ok({ success: true, data: rows.map(safeJson) })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const data = await request.validateUsing(createEmployeeCredentialValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const role = await resolveRoleForProject(user, data.projectId)
    if (role === 'viewer') {
      const linked = await this.assertViewerOwnership(user, data.employeeId, data.projectId)
      if (!linked) {
        return response.forbidden({ success: false, message: 'Insufficient permissions' })
      }
    }
    const { password, ...rest } = data
    const credential = await EmployeeCredential.create({
      ...rest,
      passwordCiphertext: encryptText(password),
    })
    return response.created({ success: true, data: safeJson(credential) })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const credential = await EmployeeCredential.query()
      .where('id', params.id)
      .preload('employee')
      .firstOrFail()
    if (!(await canAccessProject(user, credential.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const role = await resolveRoleForProject(user, credential.projectId)
    if (role === 'viewer') {
      const linked = await this.assertViewerOwnership(user, credential.employeeId, credential.projectId)
      if (!linked) {
        return response.forbidden({ success: false, message: 'Insufficient permissions' })
      }
    }
    return response.ok({ success: true, data: safeJson(credential) })
  }

  async reveal({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const credential = await EmployeeCredential.findOrFail(params.id)
    if (!(await canAccessProject(user, credential.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const role = await resolveRoleForProject(user, credential.projectId)
    if (role === 'viewer') {
      const linked = await this.assertViewerOwnership(user, credential.employeeId, credential.projectId)
      if (!linked) {
        return response.forbidden({
          success: false,
          message: 'Only admin/operator can reveal other credentials',
        })
      }
    }
    let plainPassword: string
    try {
      plainPassword = decryptText(credential.passwordCiphertext)
    } catch {
      return response.internalServerError({ success: false, message: 'Could not decrypt credential' })
    }
    return response.ok({ success: true, data: { password: plainPassword } })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const credential = await EmployeeCredential.findOrFail(params.id)
    if (!(await canAccessProject(user, credential.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const role = await resolveRoleForProject(user, credential.projectId)
    if (role === 'viewer') {
      const linked = await this.assertViewerOwnership(user, credential.employeeId, credential.projectId)
      if (!linked) {
        return response.forbidden({ success: false, message: 'Insufficient permissions' })
      }
    }
    const data = await request.validateUsing(updateEmployeeCredentialValidator)
    const { password, ...rest } = data
    if (password) {
      credential.passwordCiphertext = encryptText(password)
    }
    credential.merge(rest)
    await credential.save()
    return response.ok({ success: true, data: safeJson(credential) })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const credential = await EmployeeCredential.findOrFail(params.id)
    if (!(await canMutateInProject(user, credential.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await credential.delete()
    return response.ok({ success: true, message: 'Credential deleted', data: null })
  }
}
