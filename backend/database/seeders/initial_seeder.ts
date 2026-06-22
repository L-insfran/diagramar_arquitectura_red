import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Company from '#models/company'
import Department from '#models/department'
import SystemUser from '#models/system_user'
import DeviceType from '#models/device_type'

export default class extends BaseSeeder {
  async run() {
    const company = await Company.create({
      name: 'Demo Company',
      domain: 'demo.local',
      address: '123 Network Street',
      phone: '+1-555-0100',
      isActive: true,
    })

    await Department.createMany([
      { companyId: company.id, name: 'IT', description: 'Information Technology' },
      { companyId: company.id, name: 'Engineering', description: 'Software Engineering' },
      { companyId: company.id, name: 'Operations', description: 'Network Operations Center' },
    ])

    await SystemUser.create({
      companyId: company.id,
      email: 'admin@demo.local',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
    })

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
