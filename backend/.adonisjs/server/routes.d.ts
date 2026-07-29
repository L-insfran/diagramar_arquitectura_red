import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'me.companies': { paramsTuple?: []; params?: {} }
    'companies.index': { paramsTuple?: []; params?: {} }
    'companies.store': { paramsTuple?: []; params?: {} }
    'companies.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'companies.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'companies.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'devices.index': { paramsTuple?: []; params?: {} }
    'devices.store': { paramsTuple?: []; params?: {} }
    'devices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'devices.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'devices.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ports.index': { paramsTuple?: []; params?: {} }
    'ports.store': { paramsTuple?: []; params?: {} }
    'ports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ports.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ports.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vlans.index': { paramsTuple?: []; params?: {} }
    'vlans.store': { paramsTuple?: []; params?: {} }
    'vlans.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vlans.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vlans.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'networks.index': { paramsTuple?: []; params?: {} }
    'networks.store': { paramsTuple?: []; params?: {} }
    'networks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'networks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'networks.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.index': { paramsTuple?: []; params?: {} }
    'employees.store': { paramsTuple?: []; params?: {} }
    'employees.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'departments.index': { paramsTuple?: []; params?: {} }
    'departments.store': { paramsTuple?: []; params?: {} }
    'departments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'departments.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'departments.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'topology.canvas_layout_show': { paramsTuple?: []; params?: {} }
    'topology.canvas_layout_update': { paramsTuple?: []; params?: {} }
    'topology.canvas_layout_destroy': { paramsTuple?: []; params?: {} }
    'topology.index': { paramsTuple?: []; params?: {} }
    'topology.store': { paramsTuple?: []; params?: {} }
    'topology.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'topology.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_types.index': { paramsTuple?: []; params?: {} }
    'device_types.store': { paramsTuple?: []; params?: {} }
    'device_types.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_types.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_types.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_credentials.index': { paramsTuple?: []; params?: {} }
    'device_credentials.store': { paramsTuple?: []; params?: {} }
    'device_credentials.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_credentials.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_credentials.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'system_users.index': { paramsTuple?: []; params?: {} }
    'system_users.store': { paramsTuple?: []; params?: {} }
    'system_users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'system_users.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'system_users.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'user_memberships.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'user_memberships.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employee_credentials.index': { paramsTuple?: []; params?: {} }
    'employee_credentials.store': { paramsTuple?: []; params?: {} }
    'employee_credentials.reveal': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employee_credentials.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employee_credentials.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employee_credentials.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'auth.me': { paramsTuple?: []; params?: {} }
    'me.companies': { paramsTuple?: []; params?: {} }
    'companies.index': { paramsTuple?: []; params?: {} }
    'companies.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'devices.index': { paramsTuple?: []; params?: {} }
    'devices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ports.index': { paramsTuple?: []; params?: {} }
    'ports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vlans.index': { paramsTuple?: []; params?: {} }
    'vlans.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'networks.index': { paramsTuple?: []; params?: {} }
    'networks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.index': { paramsTuple?: []; params?: {} }
    'employees.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'departments.index': { paramsTuple?: []; params?: {} }
    'departments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'topology.canvas_layout_show': { paramsTuple?: []; params?: {} }
    'topology.index': { paramsTuple?: []; params?: {} }
    'device_types.index': { paramsTuple?: []; params?: {} }
    'device_types.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_credentials.index': { paramsTuple?: []; params?: {} }
    'device_credentials.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'system_users.index': { paramsTuple?: []; params?: {} }
    'system_users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'user_memberships.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employee_credentials.index': { paramsTuple?: []; params?: {} }
    'employee_credentials.reveal': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employee_credentials.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  HEAD: {
    'auth.me': { paramsTuple?: []; params?: {} }
    'me.companies': { paramsTuple?: []; params?: {} }
    'companies.index': { paramsTuple?: []; params?: {} }
    'companies.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'devices.index': { paramsTuple?: []; params?: {} }
    'devices.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ports.index': { paramsTuple?: []; params?: {} }
    'ports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vlans.index': { paramsTuple?: []; params?: {} }
    'vlans.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'networks.index': { paramsTuple?: []; params?: {} }
    'networks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.index': { paramsTuple?: []; params?: {} }
    'employees.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'departments.index': { paramsTuple?: []; params?: {} }
    'departments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'topology.canvas_layout_show': { paramsTuple?: []; params?: {} }
    'topology.index': { paramsTuple?: []; params?: {} }
    'device_types.index': { paramsTuple?: []; params?: {} }
    'device_types.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_credentials.index': { paramsTuple?: []; params?: {} }
    'device_credentials.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'system_users.index': { paramsTuple?: []; params?: {} }
    'system_users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'user_memberships.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employee_credentials.index': { paramsTuple?: []; params?: {} }
    'employee_credentials.reveal': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employee_credentials.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  POST: {
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'companies.store': { paramsTuple?: []; params?: {} }
    'devices.store': { paramsTuple?: []; params?: {} }
    'ports.store': { paramsTuple?: []; params?: {} }
    'vlans.store': { paramsTuple?: []; params?: {} }
    'networks.store': { paramsTuple?: []; params?: {} }
    'employees.store': { paramsTuple?: []; params?: {} }
    'departments.store': { paramsTuple?: []; params?: {} }
    'topology.store': { paramsTuple?: []; params?: {} }
    'device_types.store': { paramsTuple?: []; params?: {} }
    'device_credentials.store': { paramsTuple?: []; params?: {} }
    'system_users.store': { paramsTuple?: []; params?: {} }
    'employee_credentials.store': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'companies.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'devices.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ports.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vlans.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'networks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'departments.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'topology.canvas_layout_update': { paramsTuple?: []; params?: {} }
    'topology.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_types.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_credentials.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'system_users.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'user_memberships.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employee_credentials.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'companies.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'devices.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ports.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vlans.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'networks.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employees.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'departments.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'topology.canvas_layout_destroy': { paramsTuple?: []; params?: {} }
    'topology.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_types.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device_credentials.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'system_users.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'employee_credentials.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}