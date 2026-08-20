import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, levelFor, type Role, type Section } from "./permissions";
import { ROLE_ORDER, SECTION_LABELS } from "./roles";

/**
 * La matriz de `reglas_negocio.md` §1.7, transcrita tal cual. Es la fuente de
 * verdad: si un permiso cambia, primero cambia el documento y después esta
 * tabla — nunca al revés, y nunca solo `permissions.ts`.
 *
 * Niveles: F = completo (crear + editar + archivar) · E = ver + editar ·
 *          V = solo ver · – = sin acceso.
 */
const MATRIZ_1_7: Record<Section, Record<Role, "F" | "E" | "V" | "–">> = {
  //                    admin  manager  operator  sales  accountant
  agenda:          { admin: "F", manager: "F", operator: "F", sales: "–", accountant: "–" },
  facturacion:     { admin: "F", manager: "F", operator: "E", sales: "–", accountant: "V" },
  crm:             { admin: "F", manager: "F", operator: "F", sales: "F", accountant: "–" },
  // Configuración del CRM (credenciales de IA, canales, automatizaciones).
  // No es una fila de §1.7: es cableado del sistema, y por eso admin sola.
  "crm-config":    { admin: "F", manager: "–", operator: "–", sales: "–", accountant: "–" },
  catalogo:        { admin: "F", manager: "F", operator: "E", sales: "–", accountant: "–" },
  proveedoras:     { admin: "F", manager: "F", operator: "–", sales: "–", accountant: "–" },
  "sitio-web":     { admin: "F", manager: "F", operator: "E", sales: "–", accountant: "–" },
  "config-local":  { admin: "F", manager: "–", operator: "–", sales: "–", accountant: "–" },
  usuarios:        { admin: "F", manager: "–", operator: "–", sales: "–", accountant: "–" },
  permisos:        { admin: "V", manager: "–", operator: "–", sales: "–", accountant: "–" },
};

const SECCIONES = Object.keys(MATRIZ_1_7) as Section[];

describe("PERMISSIONS respeta la matriz de reglas_negocio.md §1.7", () => {
  for (const seccion of SECCIONES) {
    for (const rol of ROLE_ORDER) {
      const esperado = MATRIZ_1_7[seccion][rol];
      it(`${seccion} / ${rol} → ${esperado}`, () => {
        expect(levelFor(seccion, rol)).toBe(esperado);
      });
    }
  }
});

describe("can()", () => {
  it("niega todo cuando no hay rol", () => {
    // El front pinta el nav antes de saber el rol; sin esto se vería completo
    // durante un instante y después se recortaría.
    expect(can(null, "agenda", "view")).toBe(false);
    expect(can(undefined, "usuarios", "manage")).toBe(false);
  });

  it("restringir la config del CRM no le saca a nadie el CRM", () => {
    // En julio se dejaron los canales en admin recortando `crm.manage`, y con
    // eso sales perdió el CRM que §1.7 le da. Por eso `crm-config` es su
    // propia sección: se puede endurecer sin tocar la fila del CRM.
    for (const rol of ["admin", "manager", "operator", "sales"] as const) {
      expect(can(rol, "crm", "manage")).toBe(true);
      expect(can(rol, "crm-config", "manage")).toBe(rol === "admin");
    }
  });

  it("sales entra a CRM y a nada más", () => {
    expect(can("sales", "crm", "manage")).toBe(true);
    expect(can("sales", "catalogo", "view")).toBe(false);
    expect(can("sales", "facturacion", "view")).toBe(false);
    expect(can("sales", "agenda", "view")).toBe(false);
    expect(can("sales", "crm-config", "view")).toBe(false);
  });

  it("accountant solo lee facturación", () => {
    expect(can("accountant", "facturacion", "view")).toBe(true);
    expect(can("accountant", "facturacion", "edit")).toBe(false);
    expect(can("accountant", "crm", "view")).toBe(false);
  });

  it("operator edita catálogo pero no archiva (regla 1.3)", () => {
    expect(can("operator", "catalogo", "edit")).toBe(true);
    expect(can("operator", "catalogo", "manage")).toBe(false);
  });

  it("solo admin toca usuarios y la config del local", () => {
    for (const rol of ROLE_ORDER) {
      const esAdmin = rol === "admin";
      expect(can(rol, "usuarios", "manage")).toBe(esAdmin);
      expect(can(rol, "config-local", "manage")).toBe(esAdmin);
    }
  });

  it("nadie edita ni gestiona permisos, ni siquiera admin", () => {
    // La matriz se cambia editando el código, no desde la UI.
    for (const rol of ROLE_ORDER) {
      expect(can(rol, "permisos", "edit")).toBe(false);
      expect(can(rol, "permisos", "manage")).toBe(false);
    }
  });
});

describe("coherencia interna de la matriz", () => {
  it("quien gestiona también edita, y quien edita también ve", () => {
    // Un rol con `manage` pero sin `view` haría que el front le esconda la
    // sección y el backend le acepte el POST.
    for (const seccion of SECCIONES) {
      const p = PERMISSIONS[seccion];
      for (const rol of p.manage) expect(p.edit).toContain(rol);
      for (const rol of p.edit) expect(p.view).toContain(rol);
    }
  });

  it("cada sección tiene etiqueta para la UI", () => {
    for (const seccion of SECCIONES) {
      expect(SECTION_LABELS[seccion]).toBeTruthy();
    }
  });

  it("la matriz cubre exactamente las secciones declaradas", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(SECCIONES.slice().sort());
  });
});
