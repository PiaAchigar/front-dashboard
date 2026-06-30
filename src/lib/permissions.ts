/** Espejo de api-sistema-central/src/lib/permissions.ts. FUENTE: reglas_negocio.md §1.7.
 *  Mantener ambos sincronizados. */

export type Role = "admin" | "manager" | "operator" | "sales" | "accountant";
export type Capability = "view" | "edit" | "manage"; // manage = crear + archivar
export type Section =
  | "agenda"
  | "facturacion"
  | "crm"
  | "catalogo"
  | "proveedoras"
  | "sitio-web"
  | "config-local"
  | "usuarios"
  | "permisos";

export const PERMISSIONS: Record<Section, Record<Capability, Role[]>> = {
  agenda: {
    view: ["admin", "manager", "operator"],
    edit: ["admin", "manager", "operator"],
    manage: ["admin", "manager", "operator"],
  },
  facturacion: {
    view: ["admin", "manager", "operator", "accountant"],
    edit: ["admin", "manager", "operator"],
    manage: ["admin", "manager"],
  },
  crm: {
    view: ["admin", "manager", "operator", "sales"],
    edit: ["admin", "manager", "operator", "sales"],
    manage: ["admin", "manager", "operator", "sales"],
  },
  catalogo: {
    view: ["admin", "manager", "operator"],
    edit: ["admin", "manager", "operator"],
    manage: ["admin", "manager"],
  },
  proveedoras: {
    view: ["admin", "manager"],
    edit: ["admin", "manager"],
    manage: ["admin", "manager"],
  },
  "sitio-web": {
    view: ["admin", "manager", "operator"],
    edit: ["admin", "manager", "operator"],
    manage: ["admin", "manager"],
  },
  "config-local": { view: ["admin"], edit: ["admin"], manage: ["admin"] },
  usuarios: { view: ["admin"], edit: ["admin"], manage: ["admin"] },
  permisos: { view: ["admin"], edit: [], manage: [] },
};

export function can(
  role: Role | null | undefined,
  section: Section,
  cap: Capability,
): boolean {
  if (!role) return false;
  return PERMISSIONS[section][cap].includes(role as Role);
}

export function levelFor(section: Section, role: Role): "F" | "E" | "V" | "–" {
  const p = PERMISSIONS[section];
  if (p.manage.includes(role)) return "F";
  if (p.edit.includes(role)) return "E";
  if (p.view.includes(role)) return "V";
  return "–";
}
