import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResourceManager, type Column, type Group } from "./ResourceManager";

type Fila = { id: string; nombre: string; cat: string; archivada?: boolean };

const FILAS: Fila[] = [
  { id: "1", nombre: "Pierna entera", cat: "grande" },
  { id: "2", nombre: "Brazos", cat: "grande" },
  { id: "3", nombre: "Abdomen", cat: "mediana" },
  { id: "4", nombre: "Axila", cat: "chica" },
];

const COLUMNAS: Column<Fila>[] = [{ key: "nombre", header: "Nombre", render: (r) => r.nombre }];

const GRUPOS: Group[] = [
  { key: "grande", label: "Grande" },
  { key: "mediana", label: "Mediana" },
  { key: "chica", label: "Chica" },
];

function base(overrides: Partial<React.ComponentProps<typeof ResourceManager<Fila>>> = {}) {
  return {
    title: "Zonas",
    rows: FILAS,
    columns: COLUMNAS,
    rowKey: (r: Fila) => r.id,
    isArchived: (r: Fila) => Boolean(r.archivada),
    search: "",
    onSearch: vi.fn(),
    showArchived: false,
    onToggleArchived: vi.fn(),
    ...overrides,
  };
}

/** Los nombres de fila que se ven en el tbody, en orden. */
function filasVisibles() {
  return screen
    .getAllByRole("row")
    .flatMap((tr) => within(tr).queryAllByText(/Pierna entera|Brazos|Abdomen|Axila/))
    .map((el) => el.textContent);
}

describe("ResourceManager — agrupado colapsable", () => {
  it("sin las props de grupo la tabla queda plana, sin encabezados de sección", () => {
    render(<ResourceManager {...base()} />);

    expect(filasVisibles()).toEqual(["Pierna entera", "Brazos", "Abdomen", "Axila"]);
    expect(screen.queryByRole("button", { name: /Grande/ })).not.toBeInTheDocument();
  });

  it("agrupa las filas bajo su sección y arranca con todas abiertas", () => {
    render(<ResourceManager {...base()} groups={GRUPOS} groupOf={(r) => r.cat} />);

    for (const g of ["Grande", "Mediana", "Chica"]) {
      expect(screen.getByRole("button", { name: new RegExp(g) })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    }
    expect(filasVisibles()).toEqual(["Pierna entera", "Brazos", "Abdomen", "Axila"]);
  });

  it("el contador de cada sección cuenta solo sus filas", () => {
    render(<ResourceManager {...base()} groups={GRUPOS} groupOf={(r) => r.cat} />);

    expect(screen.getByRole("button", { name: /Grande/ })).toHaveTextContent("(2)");
    expect(screen.getByRole("button", { name: /Mediana/ })).toHaveTextContent("(1)");
    expect(screen.getByRole("button", { name: /Chica/ })).toHaveTextContent("(1)");
  });

  it("colapsar una sección esconde SOLO sus filas; volver a tocar las trae", async () => {
    const user = userEvent.setup();
    render(<ResourceManager {...base()} groups={GRUPOS} groupOf={(r) => r.cat} />);

    await user.click(screen.getByRole("button", { name: /Grande/ }));

    expect(screen.getByRole("button", { name: /Grande/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // Las dos grandes se fueron; las otras dos siguen.
    expect(filasVisibles()).toEqual(["Abdomen", "Axila"]);

    await user.click(screen.getByRole("button", { name: /Grande/ }));
    expect(filasVisibles()).toEqual(["Pierna entera", "Brazos", "Abdomen", "Axila"]);
  });

  it("una sección vacía se muestra igual, en 0", () => {
    render(
      <ResourceManager
        {...base({ rows: [FILAS[0]!] })}
        groups={GRUPOS}
        groupOf={(r) => r.cat}
      />,
    );

    expect(screen.getByRole("button", { name: /Mediana/ })).toHaveTextContent("(0)");
    expect(screen.getAllByText("Nada en esta sección.")).toHaveLength(2);
  });

  it("el filtro de archivados se aplica antes de agrupar", () => {
    const filas: Fila[] = [
      { id: "1", nombre: "Pierna entera", cat: "grande" },
      { id: "2", nombre: "Brazos", cat: "grande", archivada: true },
    ];
    render(
      <ResourceManager
        {...base({ rows: filas })}
        groups={GRUPOS}
        groupOf={(r) => r.cat}
      />,
    );

    expect(screen.getByRole("button", { name: /Grande/ })).toHaveTextContent("(1)");
    expect(filasVisibles()).toEqual(["Pierna entera"]);
  });
});
