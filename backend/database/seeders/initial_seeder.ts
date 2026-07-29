import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Company from '#models/company'
import CompanyMembership from '#models/company_membership'
import Department from '#models/department'
import SystemUser from '#models/system_user'
import DeviceType from '#models/device_type'
import VlanService from '#services/vlan_service'

export default class extends BaseSeeder {
  async run() {
    const vlanService = new VlanService()

    const company = await Company.firstOrCreate(
      { domain: 'demo.local' },
      {
        name: 'Demo Company',
        domain: 'demo.local',
        address: '123 Network Street',
        phone: '+1-555-0100',
        isActive: true,
      }
    )
    await vlanService.ensureNativeVlan(company.id)

    const clientTwo = await Company.firstOrCreate(
      { domain: 'cliente2.local' },
      {
        name: 'Cliente 2 S.A.',
        domain: 'cliente2.local',
        address: 'Av. Industrial 450',
        phone: '+1-555-0200',
        isActive: true,
      }
    )
    await vlanService.ensureNativeVlan(clientTwo.id)

    await Department.firstOrCreate(
      { companyId: company.id, name: 'IT' },
      { companyId: company.id, name: 'IT', description: 'Information Technology' }
    )
    await Department.firstOrCreate(
      { companyId: company.id, name: 'Engineering' },
      { companyId: company.id, name: 'Engineering', description: 'Software Engineering' }
    )
    await Department.firstOrCreate(
      { companyId: company.id, name: 'Operations' },
      { companyId: company.id, name: 'Operations', description: 'Network Operations Center' }
    )

    const admin = await SystemUser.updateOrCreate(
      { email: 'admin@demo.local' },
      {
        companyId: company.id,
        email: 'admin@demo.local',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true,
      }
    )

    await CompanyMembership.updateOrCreate(
      { systemUserId: admin.id, companyId: company.id },
      { systemUserId: admin.id, companyId: company.id, role: 'admin', isDefault: true }
    )
    await CompanyMembership.updateOrCreate(
      { systemUserId: admin.id, companyId: clientTwo.id },
      { systemUserId: admin.id, companyId: clientTwo.id, role: 'admin', isDefault: false }
    )

    const deviceTypes = [
      { name: 'Router', icon: 'globe', description: 'Network router for traffic routing' },
      { name: 'Switch', icon: 'server', description: 'Network switch for LAN connectivity' },
      { name: 'Firewall', icon: 'shield', description: 'Security firewall appliance' },
      { name: 'Access Point', icon: 'radio', description: 'Wireless access point' },
      { name: 'CCTV', icon: 'camera', description: 'Closed-circuit television cameras and recording equipment' },
      {
        name: 'Cableado Estructurado',
        icon: 'network',
        description: 'Structured cabling elements such as patch panels and horizontal runs',
      },
      { name: 'Server', icon: 'cpu', description: 'Physical or virtual server' },
      { name: 'ESXi', icon: 'box', description: 'VMware ESXi hypervisor host' },
      { name: 'Virtual Machine', icon: 'monitor', description: 'Virtual machine instance' },
      {
        name: 'Internet Service Provider',
        icon: 'cloud',
        description: 'ISP edge equipment or provider-managed CPE',
      },
      { name: 'Telephone IP', icon: 'phone', description: 'IP desk phone or softphone endpoint' },
      { name: 'Notebock', icon: 'laptop', description: 'Laptop or portable computer' },
      {
        name: 'Telephone Exchange',
        icon: 'phone-forwarded',
        description: 'PBX or telephone exchange system',
      },
      { name: 'Printer', icon: 'printer', description: 'Network or local printer' },
    ] as const

    await DeviceType.query().where('name', 'Notebook').update({ name: 'Notebock' })

    for (const dt of deviceTypes) {
      await DeviceType.firstOrCreate({ name: dt.name }, { icon: dt.icon, description: dt.description })
    }
  }
}
