import Vlan from '#models/vlan'

/** 802.1Q VLAN 1 — default / “Sin VLAN” for networks in this product. */
export const NATIVE_VLAN_TAG = 1

export default class VlanService {
  static readonly nativeVlanName = 'vlan default'
  static readonly nativeVlanDescription =
    'System-native VLAN (802.1Q ID 1). Auto-created for untagged / default network association.'

  /**
   * Ensures the project has VLAN 1 in inventory (idempotent, race-safe).
   */
  async ensureNativeVlan(projectId: string): Promise<Vlan> {
    const found = await Vlan.query()
      .where('project_id', projectId)
      .where('vlan_id', NATIVE_VLAN_TAG)
      .first()

    if (found) {
      if (found.name === 'Default') {
        found.merge({ name: VlanService.nativeVlanName })
        await found.save()
      }
      return found
    }

    try {
      return await Vlan.create({
        projectId,
        vlanId: NATIVE_VLAN_TAG,
        name: VlanService.nativeVlanName,
        description: VlanService.nativeVlanDescription,
      })
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === '23505') {
        return await Vlan.query()
          .where('project_id', projectId)
          .where('vlan_id', NATIVE_VLAN_TAG)
          .firstOrFail()
      }
      throw error
    }
  }
}
