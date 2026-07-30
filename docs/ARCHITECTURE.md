# Arquitectura actual

Documento descriptivo del sistema **tal como existe hoy**. No es la visión objetivo (ver [PRODUCT-VISION.md](PRODUCT-VISION.md) y [ROADMAP.md](ROADMAP.md)).

---

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | AdonisJS 7, Lucid 22, VineJS, `@adonisjs/auth` (access tokens), PostgreSQL (`pg`) |
| Frontend | React 19, Vite 8, TypeScript, Tailwind 4, React Router 7 |
| Diagramas | `@xyflow/react` (React Flow), dagre, html-to-image, jspdf |
| HTTP cliente | axios (`fronted/src/services/api.ts`) |
| Iconos | lucide-react |

Monorepo informal:

```
diagramar_arquitectura_red/
├── backend/     # API AdonisJS
├── fronted/     # SPA React (nombre histórico con typo; no renombrar sin plan)
├── docs/        # Documentación y ADRs
├── .cursor/rules/
└── AGENTS.md
```

---

## Capas backend

```
HTTP → routes.ts → Controller → Service → Model Lucid (PostgreSQL)
                 ↘ Validator (VineJS)
```

**Hoy no hay** capa Repository ni DTO. Los services consultan Lucid directamente. Algunos controllers aún tocan modelos sin pasar por service (deuda a migrar al tocarlos). Objetivo documentado en [adr/0002-capa-repository-y-dto.md](adr/0002-capa-repository-y-dto.md).

### Carpetas relevantes

| Ruta | Contenido |
|------|-----------|
| `backend/app/controllers/` | ~17 controllers |
| `backend/app/models/` | ~18 modelos Lucid |
| `backend/app/services/` | Services de dominio + `snmp/`, authz, project context, crypto |
| `backend/app/validators/` | VineJS |
| `backend/app/middleware/` | auth, role (role no siempre cableado en routes) |
| `backend/database/migrations/` | `0001` … `0026` (siguiente: `0027_`) |
| `backend/start/routes.ts` | Definición de rutas API |
| `backend/database/seeders/initial_seeder.ts` | Datos demo |

---

## Flujo de request

1. Middleware global: bodyparser, auth initialize, CORS.
2. Rutas públicas: health, login, register.
3. Grupo `/api` autenticado (authenticate inline en `routes.ts`).
4. Controller resuelve **project context**:
   - `requireProjectContext(ctx)` — lectura
   - `requireMutateProjectContext(ctx)` — escritura
5. Orden de resolución de proyecto (`project_context_service.ts`):
   - Header `X-Project-Id`
   - Query/body `projectId` / `project_id`
   - Membership `is_default`
   - `user.projectId`
6. Service ejecuta lógica; Model persiste.
7. Respuesta JSON: `{ success: true, data }` o error con `message`.

---

## Scope raíz: Project

ADR 0001 **aceptado** (opción A: Company es el Proyecto):

- Tabla `projects`
- Membresías `project_memberships` (rol por proyecto)
- FK `project_id` en devices, vlans, networks, connections, topology layouts, employees, etc.
- Frontend: `ProjectContext`, localStorage `nm:active-project`, interceptor axios con `X-Project-Id`
- UX: páginas Proyectos / SelectProject / Topbar selector

---

## Permisos

### Roles

| Nivel | Campo | Valores |
|-------|-------|---------|
| Global | `system_users.role` | `admin`, `operator`, `viewer` |
| Por company | `company_memberships.role` | mismo enum |

### Helpers backend (`authorization_service.ts`)

- `isAdmin(user)` — admin de plataforma
- `canMutate(user)` — legacy global admin/operator
- `canAccessCompany` / `canMutateInCompany` / `resolveRoleForCompany`

### Frontend (`usePermissions.ts`)

- `canMutate`, `isAdmin`, `isGlobalAdmin` (`user.role === 'admin'`)
- Guards en `App.tsx`: `ProtectedRoute`, `CompanyGate`, `MutateOnly`, `AdminOnly`, `GlobalAdminOnly`

No hay Bouncer/policies implementadas (carpeta policies vacía). No existe el string `globalAdmin` en backend.

---

## Frontend

### Estado

- Contexts: Auth, Company, Theme, Toast (+ TopologyCanvasInteraction en topología)
- Hook `useApi` para fetch local por componente
- **Sin** React Query, Zustand ni Redux

### Rutas principales (`App.tsx`)

Login, SelectClient, Dashboard, Devices (+ create/edit/detail), VLANs, Networks, Topology, Employees, Clients (global admin), Settings (users, device-types, port-types).

### UI propia

`Button`, `Card`, `DataTable`, `Input`, `Modal`, `Select`, `PageHeader`, `StatusBadge` en `fronted/src/components/`.

---

## Módulo de topología

Pieza más madura del producto.

| Pieza | Rol |
|-------|-----|
| `pages/Topology.tsx` | Contenedor de página |
| `TopologyFlowCanvas.tsx` | Canvas React Flow, layout, export |
| `DeviceFlowNode` / `CloudFlowNode` / `WorkAreaFlowNode` | Nodos |
| `PortLinkEdge` / `ConnectionModal` | Enlaces y alta/edición de conexión |
| `topology.service.ts` (API) | CRUD conexiones + canvas layout |
| `topology_service.ts` (backend) | Persistencia y grafo |
| `topology_canvas_layouts` | `node_positions`, `label_offsets`, `work_areas`, `node_parents` (JSONB) |
| Utils `topology*.ts` | Layout dagre, work areas, puertos, escala, print/PDF |

Las **conexiones** ya son entidades de primera clase en DB (`connections` con puertos, medio, categoría de cable, fibra, wifi, longitud, estado, metadata).

---

## Auditoría y borrado

- Solo `created_at` / `updated_at` en tablas principales.
- **No** hay `created_by`, `updated_by`, `deleted_by`, `deleted_at`.
- Borrados actuales: **hard delete**.

---

## SNMP (semilla)

Existe `backend/app/services/snmp/snmp_service.ts` como punto de extensión hacia inventario/monitoreo futuro. No es aún un módulo completo de descubrimiento.

---

## Referencias

- Dominio y gaps: [DOMAIN-MODEL.md](DOMAIN-MODEL.md)
- Roadmap: [ROADMAP.md](ROADMAP.md)
- Visión: [PRODUCT-VISION.md](PRODUCT-VISION.md)
