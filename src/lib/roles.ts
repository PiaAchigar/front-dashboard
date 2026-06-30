import type { Role, Section } from "./permissions";

export const ROLE_ORDER: Role[] = ["admin", "manager", "operator", "sales", "accountant"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  manager: "Encargado",
  operator: "Operador",
  sales: "Ventas",
  accountant: "Contador",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Acceso total: gestión de usuarios, roles, acuerdos de pago y configuración del local.",
  manager:
    "Todo lo operativo: agenda, facturación, CRM, catálogo y proveedoras. No toca usuarios ni la configuración del local.",
  operator:
    "Recepción/staff: agenda, facturación (crear), CRM, catálogo (editar) y sitio web. Sin proveedoras ni configuración.",
  sales: "Solo CRM: contactos, clientes y oportunidades.",
  accountant: "Solo lectura y descarga de facturas.",
};

export const SECTION_LABELS: Record<Section, string> = {
  agenda: "Agenda",
  facturacion: "Facturación",
  crm: "CRM",
  catalogo: "Catálogo",
  proveedoras: "Proveedoras",
  "sitio-web": "Sitio Web",
  "config-local": "Config del local",
  usuarios: "Usuarios y roles",
  permisos: "Permisos",
};
