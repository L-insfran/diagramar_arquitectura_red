import router from '@adonisjs/core/services/router'

const AuthController = () => import('#controllers/auth_controller')
const ProjectsController = () => import('#controllers/projects_controller')
const DevicesController = () => import('#controllers/devices_controller')
const PortsController = () => import('#controllers/ports_controller')
const VlansController = () => import('#controllers/vlans_controller')
const NetworksController = () => import('#controllers/networks_controller')
const EmployeesController = () => import('#controllers/employees_controller')
const DepartmentsController = () => import('#controllers/departments_controller')
const TopologyController = () => import('#controllers/topology_controller')
const DeviceTypesController = () => import('#controllers/device_types_controller')
const DeviceTemplatesController = () => import('#controllers/device_templates_controller')
const SitesController = () => import('#controllers/sites_controller')
const RacksController = () => import('#controllers/racks_controller')
const PortTypesController = () => import('#controllers/port_types_controller')
const CableTypesController = () => import('#controllers/cable_types_controller')
const AttachmentsController = () => import('#controllers/attachments_controller')
const SecretsController = () => import('#controllers/secrets_controller')
const DeviceCredentialsController = () => import('#controllers/device_credentials_controller')
const EmployeeCredentialsController = () => import('#controllers/employee_credentials_controller')
const SystemUsersController = () => import('#controllers/system_users_controller')
const MeController = () => import('#controllers/me_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const UserMembershipsController = () => import('#controllers/user_memberships_controller')

// Health check
router.get('/', async () => {
  return { success: true, message: 'Network Manager API v1.0' }
})

// Auth routes (public)
router.group(() => {
  router.post('/login', [AuthController, 'login'])
  router.post('/register', [AuthController, 'register'])
}).prefix('/api/auth')

// Protected routes
router
  .group(() => {
    // Auth
    router.post('/auth/logout', [AuthController, 'logout'])
    router.get('/auth/me', [AuthController, 'me'])
    router.get('/me/projects', [MeController, 'projects'])
    router.get('/dashboard', [DashboardController, 'show'])

    // Projects
    router.get('/projects', [ProjectsController, 'index'])
    router.post('/projects', [ProjectsController, 'store'])
    router.get('/projects/:id', [ProjectsController, 'show'])
    router.put('/projects/:id', [ProjectsController, 'update'])
    router.delete('/projects/:id', [ProjectsController, 'destroy'])

    // Devices
    router.get('/devices', [DevicesController, 'index'])
    router.post('/devices', [DevicesController, 'store'])
    router.get('/devices/:id', [DevicesController, 'show'])
    router.put('/devices/:id', [DevicesController, 'update'])
    router.delete('/devices/:id', [DevicesController, 'destroy'])
    router.put('/devices/:id/ports/status', [DevicesController, 'bulkUpdatePortsStatus'])
    router.put('/devices/:id/ports/passthrough', [DevicesController, 'bulkUpdatePortsPassthrough'])

    // Ports
    router.get('/ports', [PortsController, 'index'])
    router.post('/ports', [PortsController, 'store'])
    router.get('/ports/:id', [PortsController, 'show'])
    router.put('/ports/:id', [PortsController, 'update'])
    router.delete('/ports/:id', [PortsController, 'destroy'])

    // VLANs
    router.get('/vlans', [VlansController, 'index'])
    router.post('/vlans', [VlansController, 'store'])
    router.get('/vlans/:id', [VlansController, 'show'])
    router.put('/vlans/:id', [VlansController, 'update'])
    router.delete('/vlans/:id', [VlansController, 'destroy'])

    // Networks
    router.get('/networks', [NetworksController, 'index'])
    router.post('/networks', [NetworksController, 'store'])
    router.get('/networks/:id', [NetworksController, 'show'])
    router.put('/networks/:id', [NetworksController, 'update'])
    router.delete('/networks/:id', [NetworksController, 'destroy'])

    // Employees
    router.get('/employees', [EmployeesController, 'index'])
    router.post('/employees', [EmployeesController, 'store'])
    router.get('/employees/:id', [EmployeesController, 'show'])
    router.put('/employees/:id', [EmployeesController, 'update'])
    router.delete('/employees/:id', [EmployeesController, 'destroy'])

    // Departments
    router.get('/departments', [DepartmentsController, 'index'])
    router.post('/departments', [DepartmentsController, 'store'])
    router.get('/departments/:id', [DepartmentsController, 'show'])
    router.put('/departments/:id', [DepartmentsController, 'update'])
    router.delete('/departments/:id', [DepartmentsController, 'destroy'])

    // Topology (rutas estáticas antes de /topology/:id)
    router.get('/topology/canvas-layout', [TopologyController, 'canvasLayoutShow'])
    router.put('/topology/canvas-layout', [TopologyController, 'canvasLayoutUpdate'])
    router.delete('/topology/canvas-layout', [TopologyController, 'canvasLayoutDestroy'])
    router.get('/topology', [TopologyController, 'index'])
    router.post('/topology', [TopologyController, 'store'])
    router.put('/topology/:id', [TopologyController, 'update'])
    router.delete('/topology/:id', [TopologyController, 'destroy'])

    // Device Types
    router.get('/device-types', [DeviceTypesController, 'index'])
    router.post('/device-types', [DeviceTypesController, 'store'])
    router.get('/device-types/:id', [DeviceTypesController, 'show'])
    router.put('/device-types/:id', [DeviceTypesController, 'update'])
    router.delete('/device-types/:id', [DeviceTypesController, 'destroy'])

    // Device Templates
    router.get('/device-templates', [DeviceTemplatesController, 'index'])
    router.post('/device-templates', [DeviceTemplatesController, 'store'])
    router.get('/device-templates/:id', [DeviceTemplatesController, 'show'])
    router.put('/device-templates/:id', [DeviceTemplatesController, 'update'])
    router.delete('/device-templates/:id', [DeviceTemplatesController, 'destroy'])
    router.get('/device-templates/:id/ports', [DeviceTemplatesController, 'portsIndex'])
    router.put('/device-templates/:id/ports/passthrough', [
      DeviceTemplatesController,
      'portsBulkPassthrough',
    ])
    router.post('/device-templates/:id/ports', [DeviceTemplatesController, 'portsStore'])
    router.put('/device-templates/:id/ports/:portId', [DeviceTemplatesController, 'portsUpdate'])
    router.delete('/device-templates/:id/ports/:portId', [
      DeviceTemplatesController,
      'portsDestroy',
    ])

    // Sites & Areas (inventory físico — distinto de work_areas del canvas)
    router.get('/sites', [SitesController, 'index'])
    router.post('/sites', [SitesController, 'store'])
    router.get('/sites/:id', [SitesController, 'show'])
    router.put('/sites/:id', [SitesController, 'update'])
    router.delete('/sites/:id', [SitesController, 'destroy'])
    router.get('/sites/:id/areas', [SitesController, 'areasIndex'])
    router.post('/sites/:id/areas', [SitesController, 'areasStore'])
    router.put('/sites/:id/areas/:areaId', [SitesController, 'areasUpdate'])
    router.delete('/sites/:id/areas/:areaId', [SitesController, 'areasDestroy'])

    // Racks (inventario físico bajo área)
    router.get('/racks', [RacksController, 'index'])
    router.post('/racks', [RacksController, 'store'])
    router.get('/racks/:id/occupancy', [RacksController, 'occupancy'])
    router.get('/racks/:id', [RacksController, 'show'])
    router.put('/racks/:id', [RacksController, 'update'])
    router.delete('/racks/:id', [RacksController, 'destroy'])

    // Port Types
    router.get('/port-types', [PortTypesController, 'index'])
    router.post('/port-types', [PortTypesController, 'store'])
    router.get('/port-types/:id', [PortTypesController, 'show'])
    router.put('/port-types/:id', [PortTypesController, 'update'])
    router.delete('/port-types/:id', [PortTypesController, 'destroy'])

    // Cable Types (catálogo global)
    router.get('/cable-types', [CableTypesController, 'index'])
    router.post('/cable-types', [CableTypesController, 'store'])
    router.get('/cable-types/:id', [CableTypesController, 'show'])
    router.put('/cable-types/:id', [CableTypesController, 'update'])
    router.delete('/cable-types/:id', [CableTypesController, 'destroy'])

    // Attachments (documentación polimórfica)
    router.get('/attachments', [AttachmentsController, 'index'])
    router.post('/attachments', [AttachmentsController, 'store'])
    router.get('/attachments/:id/download', [AttachmentsController, 'download'])
    router.get('/attachments/:id', [AttachmentsController, 'show'])
    router.put('/attachments/:id', [AttachmentsController, 'update'])
    router.delete('/attachments/:id', [AttachmentsController, 'destroy'])

    // Secrets cifrados (polimórficos; reveal solo mutate)
    router.get('/secrets', [SecretsController, 'index'])
    router.post('/secrets', [SecretsController, 'store'])
    router.get('/secrets/:id/reveal', [SecretsController, 'reveal'])
    router.put('/secrets/:id', [SecretsController, 'update'])
    router.delete('/secrets/:id', [SecretsController, 'destroy'])

    // Device Credentials
    router.get('/device-credentials', [DeviceCredentialsController, 'index'])
    router.post('/device-credentials', [DeviceCredentialsController, 'store'])
    router.get('/device-credentials/:id', [DeviceCredentialsController, 'show'])
    router.put('/device-credentials/:id', [DeviceCredentialsController, 'update'])
    router.delete('/device-credentials/:id', [DeviceCredentialsController, 'destroy'])

    // System Users (admin-only)
    router.get('/system-users', [SystemUsersController, 'index'])
    router.post('/system-users', [SystemUsersController, 'store'])
    router.get('/system-users/:id', [SystemUsersController, 'show'])
    router.put('/system-users/:id', [SystemUsersController, 'update'])
    router.delete('/system-users/:id', [SystemUsersController, 'destroy'])
    router.get('/system-users/:id/memberships', [UserMembershipsController, 'index'])
    router.put('/system-users/:id/memberships', [UserMembershipsController, 'update'])

    // Employee Network Credentials
    router.get('/employee-credentials', [EmployeeCredentialsController, 'index'])
    router.post('/employee-credentials', [EmployeeCredentialsController, 'store'])
    router.get('/employee-credentials/:id/reveal', [EmployeeCredentialsController, 'reveal'])
    router.get('/employee-credentials/:id', [EmployeeCredentialsController, 'show'])
    router.put('/employee-credentials/:id', [EmployeeCredentialsController, 'update'])
    router.delete('/employee-credentials/:id', [EmployeeCredentialsController, 'destroy'])
  })
  .prefix('/api')
  .use(async (ctx, next) => {
    try {
      await ctx.auth.authenticate()
      return next()
    } catch {
      return ctx.response.unauthorized({ success: false, message: 'Authentication required' })
    }
  })
