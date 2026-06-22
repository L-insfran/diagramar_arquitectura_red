export interface SnmpConfig {
  host: string
  port?: number
  community?: string
  version?: '1' | '2c' | '3'
}

export interface SnmpResult {
  oid: string
  value: string
  type: string
}

export default class SnmpService {
  /**
   * Placeholder for future SNMP polling
   * Will be implemented when SNMP integration is needed
   */
  async poll(_config: SnmpConfig): Promise<SnmpResult[]> {
    throw new Error('SNMP polling not yet implemented')
  }

  async getDeviceInfo(_config: SnmpConfig): Promise<Record<string, string>> {
    throw new Error('SNMP device info not yet implemented')
  }

  async getInterfaces(_config: SnmpConfig): Promise<any[]> {
    throw new Error('SNMP interfaces not yet implemented')
  }

  async walk(_config: SnmpConfig, _oid: string): Promise<SnmpResult[]> {
    throw new Error('SNMP walk not yet implemented')
  }
}
