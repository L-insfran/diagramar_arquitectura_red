import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * ADR 0001 opción A: companies → projects, company_id → project_id.
 * Historical migrations 0001–0025 stay unchanged.
 */
export default class extends BaseSchema {
  private childTables = [
    'system_users',
    'departments',
    'employees',
    'devices',
    'vlans',
    'networks',
    'connections',
    'employee_credentials',
    'topology_canvas_layouts',
    'company_memberships',
  ] as const

  async up() {
    // Drop FKs and uniques that reference companies / company_id
    this.schema.raw(`
      ALTER TABLE system_users DROP CONSTRAINT IF EXISTS system_users_company_id_foreign;
      ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_company_id_foreign;
      ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_company_id_foreign;
      ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_company_id_foreign;
      ALTER TABLE vlans DROP CONSTRAINT IF EXISTS vlans_company_id_foreign;
      ALTER TABLE vlans DROP CONSTRAINT IF EXISTS vlans_company_id_vlan_id_unique;
      ALTER TABLE networks DROP CONSTRAINT IF EXISTS networks_company_id_foreign;
      ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_company_id_foreign;
      ALTER TABLE employee_credentials DROP CONSTRAINT IF EXISTS employee_credentials_company_id_foreign;
      ALTER TABLE topology_canvas_layouts DROP CONSTRAINT IF EXISTS topology_canvas_layouts_company_id_foreign;
      ALTER TABLE topology_canvas_layouts DROP CONSTRAINT IF EXISTS topology_canvas_layouts_company_id_layer_scope_unique;
      ALTER TABLE company_memberships DROP CONSTRAINT IF EXISTS company_memberships_company_id_foreign;
      ALTER TABLE company_memberships DROP CONSTRAINT IF EXISTS company_memberships_system_user_id_company_id_unique;
      DROP INDEX IF EXISTS company_memberships_company_id_index;
    `)

    this.schema.renameTable('companies', 'projects')

    for (const tableName of this.childTables) {
      this.schema.alterTable(tableName, (table) => {
        table.renameColumn('company_id', 'project_id')
      })
    }

    this.schema.renameTable('company_memberships', 'project_memberships')

    this.schema.raw(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_memberships_role') THEN
          ALTER TYPE company_memberships_role RENAME TO project_memberships_role;
        END IF;
      END $$;
    `)

    // Recreate FKs, uniques, indexes
    this.schema.raw(`
      ALTER TABLE system_users
        ADD CONSTRAINT system_users_project_id_foreign
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

      ALTER TABLE departments
        ADD CONSTRAINT departments_project_id_foreign
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

      ALTER TABLE employees
        ADD CONSTRAINT employees_project_id_foreign
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

      ALTER TABLE devices
        ADD CONSTRAINT devices_project_id_foreign
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

      ALTER TABLE vlans
        ADD CONSTRAINT vlans_project_id_foreign
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
      ALTER TABLE vlans
        ADD CONSTRAINT vlans_project_id_vlan_id_unique UNIQUE (project_id, vlan_id);

      ALTER TABLE networks
        ADD CONSTRAINT networks_project_id_foreign
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

      ALTER TABLE connections
        ADD CONSTRAINT connections_project_id_foreign
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

      ALTER TABLE employee_credentials
        ADD CONSTRAINT employee_credentials_project_id_foreign
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

      ALTER TABLE topology_canvas_layouts
        ADD CONSTRAINT topology_canvas_layouts_project_id_foreign
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
      ALTER TABLE topology_canvas_layouts
        ADD CONSTRAINT topology_canvas_layouts_project_id_layer_scope_unique
        UNIQUE (project_id, layer, scope);

      ALTER TABLE project_memberships
        ADD CONSTRAINT project_memberships_project_id_foreign
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
      ALTER TABLE project_memberships
        ADD CONSTRAINT project_memberships_system_user_id_project_id_unique
        UNIQUE (system_user_id, project_id);
      CREATE INDEX IF NOT EXISTS project_memberships_project_id_index ON project_memberships (project_id);
    `)
  }

  async down() {
    this.schema.raw(`
      ALTER TABLE system_users DROP CONSTRAINT IF EXISTS system_users_project_id_foreign;
      ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_project_id_foreign;
      ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_project_id_foreign;
      ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_project_id_foreign;
      ALTER TABLE vlans DROP CONSTRAINT IF EXISTS vlans_project_id_foreign;
      ALTER TABLE vlans DROP CONSTRAINT IF EXISTS vlans_project_id_vlan_id_unique;
      ALTER TABLE networks DROP CONSTRAINT IF EXISTS networks_project_id_foreign;
      ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_project_id_foreign;
      ALTER TABLE employee_credentials DROP CONSTRAINT IF EXISTS employee_credentials_project_id_foreign;
      ALTER TABLE topology_canvas_layouts DROP CONSTRAINT IF EXISTS topology_canvas_layouts_project_id_foreign;
      ALTER TABLE topology_canvas_layouts DROP CONSTRAINT IF EXISTS topology_canvas_layouts_project_id_layer_scope_unique;
      ALTER TABLE project_memberships DROP CONSTRAINT IF EXISTS project_memberships_project_id_foreign;
      ALTER TABLE project_memberships DROP CONSTRAINT IF EXISTS project_memberships_system_user_id_project_id_unique;
      DROP INDEX IF EXISTS project_memberships_project_id_index;
    `)

    this.schema.renameTable('project_memberships', 'company_memberships')

    const reverseTables = [
      'system_users',
      'departments',
      'employees',
      'devices',
      'vlans',
      'networks',
      'connections',
      'employee_credentials',
      'topology_canvas_layouts',
      'company_memberships',
    ] as const

    for (const tableName of reverseTables) {
      this.schema.alterTable(tableName, (table) => {
        table.renameColumn('project_id', 'company_id')
      })
    }

    this.schema.renameTable('projects', 'companies')

    this.schema.raw(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_memberships_role') THEN
          ALTER TYPE project_memberships_role RENAME TO company_memberships_role;
        END IF;
      END $$;
    `)

    this.schema.raw(`
      ALTER TABLE system_users
        ADD CONSTRAINT system_users_company_id_foreign
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      ALTER TABLE departments
        ADD CONSTRAINT departments_company_id_foreign
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      ALTER TABLE employees
        ADD CONSTRAINT employees_company_id_foreign
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      ALTER TABLE devices
        ADD CONSTRAINT devices_company_id_foreign
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      ALTER TABLE vlans
        ADD CONSTRAINT vlans_company_id_foreign
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      ALTER TABLE vlans
        ADD CONSTRAINT vlans_company_id_vlan_id_unique UNIQUE (company_id, vlan_id);
      ALTER TABLE networks
        ADD CONSTRAINT networks_company_id_foreign
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      ALTER TABLE connections
        ADD CONSTRAINT connections_company_id_foreign
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      ALTER TABLE employee_credentials
        ADD CONSTRAINT employee_credentials_company_id_foreign
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      ALTER TABLE topology_canvas_layouts
        ADD CONSTRAINT topology_canvas_layouts_company_id_foreign
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      ALTER TABLE topology_canvas_layouts
        ADD CONSTRAINT topology_canvas_layouts_company_id_layer_scope_unique
        UNIQUE (company_id, layer, scope);
      ALTER TABLE company_memberships
        ADD CONSTRAINT company_memberships_company_id_foreign
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      ALTER TABLE company_memberships
        ADD CONSTRAINT company_memberships_system_user_id_company_id_unique
        UNIQUE (system_user_id, company_id);
      CREATE INDEX IF NOT EXISTS company_memberships_company_id_index ON company_memberships (company_id);
    `)
  }
}
