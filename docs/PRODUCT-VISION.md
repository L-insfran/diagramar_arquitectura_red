# Visión del producto

Fuente de verdad del producto. Todo desarrollo debe alinearse con este documento.

---

## Contexto del proyecto

A partir de este momento no se razona como si este proyecto fuera un simple CRUD.

Este software es una **plataforma profesional** para documentación de infraestructura IT y redes empresariales.

TODO el código que se genere debe respetar esta visión.

- Nunca generar soluciones rápidas.
- Nunca romper la arquitectura existente.
- Siempre extender el sistema existente.
- El proyecto **YA EXISTE**. No crear una aplicación desde cero.
- Siempre analizar primero la arquitectura existente antes de modificar código.
- Todo nuevo desarrollo debe integrarse respetando la estructura actual.
- No eliminar funcionalidades existentes.
- Refactorizar únicamente cuando sea necesario para mantener una arquitectura limpia.

---

## Visión del producto

El objetivo es construir un software comparable a herramientas como:

- NetBox
- RackTables
- RackManage
- Device42 (documentación)

pero con una experiencia de usuario mucho más moderna.

**NO** será multiempresa (NO Multi Tenant aislado por empresa).

El sistema tendrá múltiples usuarios.

Cada usuario podrá trabajar sobre múltiples proyectos.

**Proyecto = infraestructura completa de un cliente.**

No existe aislamiento por empresa como concepto de producto.

Todo gira alrededor del proyecto.

```
Proyecto
│
├── Sitios
├── Áreas
├── Racks
├── Equipos
├── VLANs
├── Redes
├── Conexiones
├── Patch Panels
├── Switches
├── Servidores
├── PCs
└── Documentación
```

Todo debe pertenecer a un Proyecto.

> **Nota:** el scope raíz en código/DB es `projects` (`project_id`, `X-Project-Id`). ADR [0001](adr/0001-project-como-scope-raiz.md) aceptado (opción A).

---

## Filosofía

El software **NO** administra solamente dispositivos.

Administra **relaciones**.

El dato más importante es cómo se conecta todo.

Cada objeto existe porque se relaciona con otro.

Las conexiones son ciudadanos de primera clase.

Nunca modelar conexiones como simples textos.

Siempre deben ser entidades.

---

## Concepto principal

Todo dispositivo es una instancia de un Template.

Nunca crear dispositivos completamente libres.

Siempre deben nacer desde un Template.

```
Template → Instancia → Conexiones → Documentación
```

---

## Templates

El sistema debe permitir crear Templates reutilizables.

Ejemplos: Cisco Catalyst 2960 24 Puertos, Cisco Catalyst 9300 48 Puertos, Mikrotik RB4011, Fortigate 100F, Dell R740, Patch Panel 24/48, UPS APC, Servidor HP, PC, Notebook, Impresora, Access Point, Cámara IP, Teléfono IP, Router, Firewall, PLC, etc.

### Los Templates definen

Marca, Modelo, Cantidad de puertos, Tipo de puertos, Cantidad de U, Imagen, Consumo eléctrico, Peso, Posición de puertos, Vista frontal, Vista trasera, Campos personalizados, Características, Capacidad, Observaciones.

**Nunca** modificar estos datos en la instancia.

La instancia solamente podrá modificar: Nombre, Número de serie, IP, MAC, Hostname, Estado, Ubicación, Rack, Proyecto, Notas.

---

## Tipos de puertos

Los puertos también son Templates.

Ejemplos: RJ45, SFP, SFP+, QSFP, USB, HDMI, Serial, Console, Power, Fiber LC, Fiber SC, Coaxial, etc.

Cada puerto conoce: Nombre, Velocidad, Tipo, Color, Icono, Dirección (Entrada / Salida / Bidireccional).

---

## Conexiones

Las conexiones son entidades independientes.

Una conexión posee: Origen, Puerto origen, Destino, Puerto destino, Tipo de cable, Longitud, Estado, Etiqueta, Observaciones, Fecha, Usuario.

Debe ser imposible conectar un puerto ocupado.

Cada puerto solamente puede tener **una conexión activa**.

### Tipos de cable

UTP Cat5e, UTP Cat6, UTP Cat6A, Fibra MM, Fibra SM, DAC, Console, Power, Coaxial, Otros.

---

## Racks

Cada rack pertenece a: Proyecto, Sitio, Área.

El rack conoce: Nombre, Código, Cantidad de U, Fabricante, Modelo, Ubicación, Observaciones.

### Visualización del rack

Debe existir un visor visual. El rack debe dibujarse completo (42U, 45U, 48U, etc.).

Cada equipo ocupa sus unidades correspondientes. No puede existir superposición. Debe calcular automáticamente el espacio disponible y el porcentaje de ocupación. Debe permitir Drag and Drop.

---

## Equipos

Todo equipo puede estar: En Rack, Sobre escritorio, En pared, En techo, En piso, Dentro de gabinete.

Cada ubicación tiene distinta representación.

---

## Sitios

```
Proyecto → Sitios → Áreas → Racks → Equipos
```

---

## Redes

Módulo completo para: Subredes, CIDR, Gateway, DNS, DHCP, VLAN, Máscara, Descripción, Estado, Proyecto.

---

## VLANs

Número, Nombre, Color, Descripción, Proyecto.

---

## Documentación

Cada objeto puede tener: Archivos, PDF, Planos, Fotos, Diagramas, Contraseñas cifradas, Notas, Links.

---

## Dashboard

Mostrar: Cantidad de equipos, Cantidad de racks, Puertos libres, Puertos ocupados, Conexiones, VLANs, Redes, Ocupación de racks, Equipos sin documentar, Equipos desconectados, Alertas.

---

## Permisos

Mantener el sistema existente.

Roles actuales: Admin, Global Admin (admin de plataforma), Usuario (operator/viewer).

Respetar: `canMutate`, `admin`, `isGlobalAdmin` / admin global.

No romper el sistema actual.

---

## Frontend

La prioridad es UX.

Pantallas limpias. Minimalistas. Profesionales.

Mucho uso de: Cards, Drawer, Context Menu, Tabs, Split View, Panel lateral, Drag & Drop, Diagramas interactivos.

No abusar de modales.

---

## Arquitectura de software

Siempre trabajar con:

```
Controller → Service → Repository → DTO → Validator
```

Nunca acceder a la base desde el Controller.

Nunca colocar lógica de negocio en React.

Toda lógica vive en Services.

---

## Base de datos

Diseñar pensando en crecimiento. Evitar duplicación. Normalizar. Usar claves foráneas. Índices. Soft Delete cuando corresponda. Auditoría: `createdBy`, `updatedBy`, `deletedBy`, timestamps.

---

## Escalabilidad

Aunque hoy el sistema sea simple, debe poder crecer hacia:

Monitoreo, SNMP, LLDP, CDP, Importación desde switches, Escaneo de red, Inventario automático, Visor topológico, Mapa físico, Mapa lógico, Integración con Zabbix / PRTG / LibreNMS.

Sin necesidad de rehacer la arquitectura.

---

## Reglas para el agente (Cursor)

Antes de escribir código:

1. Analizar la arquitectura existente.
2. Buscar reutilización.
3. Evitar duplicación.
4. Mantener consistencia.
5. Pensar si el cambio afectará futuros módulos.
6. Priorizar escalabilidad.
7. No crear componentes gigantes.
8. Preferir componentes reutilizables.
9. Mantener nombres claros.
10. Documentar el código complejo.

Cuando existan varias soluciones, elegir siempre la más mantenible, escalable y profesional.

No generar código "rápido". Generar código preparado para evolucionar durante años.
