import router from '@adonisjs/core/services/router'

const AuthController = () => import('#controllers/auth_controller')
const CompaniesController = () => import('#controllers/companies_controller')
const DevicesController = () => import('#controllers/devices_controller')
const PortsController = () => import('#controllers/ports_controller')
const VlansController = () => import('#controllers/vlans_controller')
const NetworksController = () => import('#controllers/networks_controller')
const EmployeesController = () => import('#controllers/employees_controller')
const DepartmentsController = () => import('#controllers/departments_controller')
const TopologyController = () => import('#controllers/topology_controller')
const DeviceTypesController = () => import('#controllers/device_types_controller')
const DeviceCredentialsController = () => import('#controllers/device_credentials_controller')
const EmployeeCredentialsController = () => import('#controllers/employee_credentials_controller')
const SystemUsersController = () => import('#controllers/system_users_controller')

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

    // Companies
    router.get('/companies', [CompaniesController, 'index'])
    router.post('/companies', [CompaniesController, 'store'])
    router.get('/companies/:id', [CompaniesController, 'show'])
    router.put('/companies/:id', [CompaniesController, 'update'])
    router.delete('/companies/:id', [CompaniesController, 'destroy'])

    // Devices
    router.get('/devices', [DevicesController, 'index'])
    router.post('/devices', [DevicesController, 'store'])
    router.get('/devices/:id', [DevicesController, 'show'])
    router.put('/devices/:id', [DevicesController, 'update'])
    router.delete('/devices/:id', [DevicesController, 'destroy'])

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
