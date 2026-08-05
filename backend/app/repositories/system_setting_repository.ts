import SystemSetting from '#models/system_setting'

export default class SystemSettingRepository {
  async findSingleton(): Promise<SystemSetting | null> {
    return SystemSetting.query().orderBy('created_at', 'asc').first()
  }

  async createEmpty(): Promise<SystemSetting> {
    return SystemSetting.create({
      reportTagline: null,
      logoStoragePath: null,
      logoMimeType: null,
      logoOriginalFilename: null,
      logoSizeBytes: null,
    })
  }

  async save(row: SystemSetting): Promise<SystemSetting> {
    await row.save()
    return row
  }
}
