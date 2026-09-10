import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ResourceManager } from "../../components/ResourceManager";
import { AreaLayout } from "./AreaLayout";
import { useContextoDeArea } from "./contexto-de-area";
import { AREAS } from "../../lib/admin-nav";

const ESTETICA = AREAS.find((a) => a.path === "estetica")!;

/** Una pantalla mínima que se comporta como las de área. */
function PantallaDePrueba() {
  const ctx = useContextoDeArea();
  return (
    <ResourceManager<{ id: string }>
      title="Combo"
      slotAcciones={ctx?.slotAcciones ?? null}
      alturaLibre={!!ctx}
      rows={[]}
      columns={[{ key: "n", header: "Nombre", render: () => null }]}
      loading={false}
      error={null}
      rowKey={(r) => r.id}
      isArchived={() => false}
      search=""
      onSearch={() => {}}
      showArchived={false}
      onToggleArchived={() => {}}
      canCreate
      onAdd={() => {}}
    />
  );
}

function montar(ruta = "/admin/estetica/combos") {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/admin/estetica" element={<AreaLayout area={ESTETICA} />}>
          <Route path="combos" element={<PantallaDePrueba />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AreaLayout", () => {
  it("sube el botón Agregar al renglón del título del área", () => {
    montar();
    const titulo = screen.getByRole("heading", { name: "Estética" });
    const boton = screen.getByRole("button", { name: /agregar/i });

    // El botón vive en el encabezado del ÁREA, no adentro de la pantalla: es
    // lo que le devuelve el alto a la tabla.
    expect(titulo.parentElement).toContainElement(boton);
  });

  it("no repite el nombre de la entidad: ya lo dice la solapa activa", () => {
    montar();
    // El <h2> "Combo" del ResourceManager desaparece cuando hay slot. Si
    // volviera, sería la fila que Pia pidió sacar.
    expect(screen.queryByRole("heading", { name: "Combo" })).not.toBeInTheDocument();
  });

  it("muestra las tres solapas del área", () => {
    montar();
    for (const nombre of ["Servicios", "Combos", "Packs"]) {
      expect(screen.getByRole("link", { name: new RegExp(`^${nombre}`) })).toBeInTheDocument();
    }
  });

  it("declara un solo scroll vertical, el del contenido del área", () => {
    const { container } = montar();
    // La tabla ya NO pide scroll vertical propio: con `alturaLibre` crece a lo
    // que necesite y quien scrollea es el área. Con los dos habría una barra
    // adentro de la otra.
    //
    // ⚠️ Esto mira las clases, no el estilo calculado — jsdom no resuelve
    // `overflow`. Alcanza para cazar el caso que importa (que alguien le
    // devuelva el `overflow-y-auto` a la tabla), no para probar cómo se ve.
    expect(container.querySelectorAll(".overflow-y-auto")).toHaveLength(1);
  });
});

describe("ResourceManager sin contexto de área", () => {
  it("conserva su propio encabezado cuando nadie le ofrece un lugar mejor", () => {
    render(
      <MemoryRouter>
        <PantallaDePrueba />
      </MemoryRouter>,
    );
    // "Todos los servicios" corre así, y tiene que seguir viéndose igual.
    expect(screen.getByRole("heading", { name: "Combo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /agregar/i })).toBeInTheDocument();
  });
});
