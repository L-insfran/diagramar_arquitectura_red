import db from '@adonisjs/lucid/services/db'

export default class NetworkService {
  /**
   * VLAN UUIDs that appear on at least one port (layer-2 assignment).
   * Used to determine if a logical network backed by that VLAN is "in use".
   */
  async getVlanIdsAssignedToPorts(vlanIds: string[]): Promise<Set<string>> {
    const unique = [...new Set(vlanIds.filter(Boolean))]
    if (unique.length === 0) {
      return new Set()
    }
    const rows = await db
      .from('port_vlans')
      .select('vlan_id')
      .whereIn('vlan_id', unique)
      .groupBy('vlan_id')
    return new Set(rows.map((r) => r.vlan_id as string))
  }
}
