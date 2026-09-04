import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ role: "admin", session: null, user: null, loading: false, signOut: vi.fn() }),
}));

import { AREAS, PESTANAS, acentoDe } from "../../lib/admin-nav";
import { SectionSubnav } from "../../components/SectionSubnav";

describe("PESTANAS — el orden y los grupos que pidió Pia", () => {
  const etiquetas = PESTANAS.map((p) => p.label);

  it("PROMOS va primera: es la única pestaña comercial", () => {
    expect(etiquetas[0]).toBe("Promos");
  });

  it("los ejes van después de Promos y antes de los recursos", () => {
    const ejes = ["Estética", "Depilación", "Medicina y Dermatología", "Masajes y Bienestar"];
    const posiciones = ejes.map((e) => etiquetas.indexOf(e));
    expect(posiciones.every((p) => p > 0)).toBe(true);
    // Cada eje aparece antes que el primer recurso.
    expect(Math.max(...posiciones)).toBeLessThan(etiquetas.indexOf("Proveedores"));
  });

  it("Categorías va última: es meta, no catálogo ni recurso", () => {
    expect(etiquetas[etiquetas.length - 1]).toBe("Categorías");
  });

  it('dice "Proveedores", no "Proveedoras"', () => {
    expect(etiquetas).toContain("Proveedores");
    expect(etiquetas).not.toContain("Proveedoras");
  });

  it("ninguna pestaña apunta a una ruta vacía", () => {
    for (const p of PESTANAS) expect(p.to).toMatch(/^\/admin\/.+/);
  });

  it("no hay etiquetas ni rutas repetidas", () => {
    expect(new Set(etiquetas).size).toBe(etiquetas.length);
    expect(new Set(PESTANAS.map((p) => p.to)).size).toBe(PESTANAS.length);
  });
});

describe("AREAS — cada área tiene su pestaña y su ruta", () => {
  // Un desajuste acá no rompe nada visible: deja una pestaña que carga una
  // lista vacía, que es peor que un error porque parece un catálogo sin datos.
  it("cada área tiene una pestaña que apunta a su ruta", () => {
    for (const a of AREAS) {
      expect(PESTANAS.map((p) => p.to)).toContain(`/admin/${a.path}`);
    }
  });

  it("cada área nombra una categoría, y no queda vacía", () => {
    for (const a of AREAS) {
      expect(a.categoria.trim()).not.toBe("");
      expect(a.path).toMatch(/^[a-z]+$/);
    }
  });

  // Verificado contra producción el 2026-09-04: son los `name` exactos de las
  // categorías con kind='area'. El filtro compara por igualdad, así que un
  // acento de menos deja la pestaña sin servicios.
  it("los nombres coinciden EXACTO con las categorías de la base", () => {
    expect(AREAS.map((a) => a.categoria)).toEqual([
      "Estética",
      "Medicina y Dermatología",
      "Masajes y Bienestar",
    ]);
  });
});

describe("acentoDe — el color dice el propósito, no la posición", () => {
  it("Promos tiene su propio acento, distinto de todos los demás", () => {
    const promo = acentoDe("promo").texto;
    for (const g of ["eje", "recurso", "meta"] as const) {
      expect(acentoDe(g).texto).not.toBe(promo);
    }
  });

  // Regresión real: el subrayado se armaba con acento.replace("text-","bg-").
  // Tailwind escanea texto plano, así que `bg-promo` y `bg-resource` nunca se
  // compilaron y el subrayado de esas pestañas quedaba invisible — sin error.
  it("cada acento trae su clase de barra escrita entera, no derivada", () => {
    for (const g of ["promo", "eje", "recurso", "meta"] as const) {
      const a = acentoDe(g);
      expect(a.texto).toMatch(/^text-/);
      expect(a.barra).toMatch(/^bg-/);
      expect(a.barra).toBe(a.texto.replace("text-", "bg-"));
    }
  });

  it("los seis ejes comparten acento: son el corazón del sistema", () => {
    const ejes = PESTANAS.filter((p) => p.grupo === "eje");
    expect(ejes.length).toBeGreaterThan(1);
    expect(new Set(ejes.map((p) => acentoDe(p.grupo).texto)).size).toBe(1);
  });

  it("los recursos comparten un acento distinto del de los ejes", () => {
    expect(acentoDe("recurso").texto).not.toBe(acentoDe("eje").texto);
  });

  it("los cuatro grupos tienen cuatro acentos distintos", () => {
    const acentos = (["promo", "eje", "recurso", "meta"] as const).map((g) => acentoDe(g).texto);
    expect(new Set(acentos).size).toBe(4);
  });
});

describe("SectionSubnav — el acento se aplica sin perder el nombre", () => {
  const items = [
    { to: "/admin/promos", label: "Promos", accent: { texto: "text-promo", barra: "bg-promo" } },
    { to: "/admin/estetica", label: "Estética", accent: { texto: "text-primary", barra: "bg-primary" } },
  ];

  it("renderiza cada pestaña con su nombre visible", () => {
    render(
      <MemoryRouter initialEntries={["/admin/promos"]}>
        <SectionSubnav items={items} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Promos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Estética" })).toBeInTheDocument();
  });

  // Regla del spec: el color nunca es el único portador de significado. Si el
  // acento fuera lo único que distingue una pestaña, quien no ve esos tonos no
  // podría usar el sistema.
  it("el nombre está en el texto, no sólo en el color", () => {
    render(
      <MemoryRouter initialEntries={["/admin/promos"]}>
        <SectionSubnav items={items} />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Promos" });
    expect(link).toHaveTextContent("Promos");
  });

  it("la pestaña activa usa su propio acento, no el de otra", () => {
    render(
      <MemoryRouter initialEntries={["/admin/promos"]}>
        <SectionSubnav items={items} />
      </MemoryRouter>,
    );
    const activa = screen.getByRole("link", { name: "Promos" });
    expect(activa.className).toContain("text-promo");
    expect(activa.className).not.toContain("text-primary");
  });

  it("sin accent no rompe: cae al color por defecto", () => {
    render(
      <MemoryRouter initialEntries={["/admin/x"]}>
        <SectionSubnav items={[{ to: "/admin/x", label: "Equis" }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Equis" })).toBeInTheDocument();
  });
});
