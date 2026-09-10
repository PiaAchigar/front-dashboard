import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ResourceManager } from "../../../components/ResourceManager";
import { DepilacionLayout } from "./DepilacionLayout";
import { useContextoDeArea } from "../contexto-de-area";

/** Una pantalla mínima que se comporta como Zonas o Combos. */
function PantallaDePrueba() {
  const ctx = useContextoDeArea();
  return (
    <ResourceManager<{ id: string }>
      title="Zonas"
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

function montar() {
  return render(
    <MemoryRouter initialEntries={["/admin/depilacion/zonas"]}>
      <Routes>
        <Route path="/admin/depilacion" element={<DepilacionLayout />}>
          <Route path="zonas" element={<PantallaDePrueba />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("DepilacionLayout", () => {
  it("sube el botón Agregar al renglón del título del área", () => {
    montar();
    const titulo = screen.getByRole("heading", { name: "Depilación" });
    expect(titulo.parentElement).toContainElement(
      screen.getByRole("button", { name: /agregar/i }),
    );
  });

  it("no repite 'Zonas': ya lo dice la solapa activa", () => {
    montar();
    // Era la fila que se llevaba el alto de la tabla (pedido de Pia,
    // 2026-09-10). El nombre sigue estando, pero en la solapa.
    expect(screen.queryByRole("heading", { name: "Zonas" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zonas" })).toBeInTheDocument();
  });

  it("declara un solo scroll vertical, el del contenido del área", () => {
    const { container } = montar();
    // ⚠️ Mira las clases, no el estilo calculado: jsdom no resuelve `overflow`.
    // Alcanza para cazar el caso que importa —que alguien le devuelva el
    // `overflow-y-auto` a la tabla— y dejar dos barras anidadas.
    expect(container.querySelectorAll(".overflow-y-auto")).toHaveLength(1);
  });

  it("conserva las tres solapas de depilación", () => {
    montar();
    for (const nombre of ["Zonas", "Precios", "Combos"]) {
      expect(screen.getByRole("link", { name: nombre })).toBeInTheDocument();
    }
  });
});
