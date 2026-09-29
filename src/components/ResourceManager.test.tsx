import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResourceManager, type Column, type Group } from "./ResourceManager";

type Fila = { id: string; nombre: string; cat: string; archivada?: boolean };

const FILAS: Fila[] = [
  { id: "1", nombre: "Pierna entera", cat: "grande" },
  { id: "2", nombre: "Brazos", cat: "grande" },
  { id: "3", nombre: "Abdomen", cat: "mediana" },
  { id: "4", nombre: "Axila", cat: "chica" },
];

const COLUMNAS: Column<Fila>[] = [
  { key: "nombre", header: "Nombre", render: (r) => r.nombre },
];

const GRUPOS: Group[] = [
  { key: "grande", label: "Grande" },
  { key: "mediana", label: "Mediana" },
  { key: "chica", label: "Chica" },
];

function base(
  overrides: Partial<React.ComponentProps<typeof ResourceManager<Fila>>> = {},
) {
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
    .flatMap((tr) =>
      within(tr).queryAllByText(/Pierna entera|Brazos|Abdomen|Axila/),
    )
    .map((el) => el.textContent);
}

describe("ResourceManager — agrupado colapsable", () => {
  it("sin las props de grupo la tabla queda plana, sin encabezados de sección", () => {
    render(<ResourceManager {...base()} />);

    expect(filasVisibles()).toEqual([
      "Pierna entera",
      "Brazos",
      "Abdomen",
      "Axila",
    ]);
    expect(
      screen.queryByRole("button", { name: /Grande/ }),
    ).not.toBeInTheDocument();
  });

  it("agrupa las filas bajo su sección y arranca con todas abiertas", () => {
    render(
      <ResourceManager {...base()} groups={GRUPOS} groupOf={(r) => r.cat} />,
    );

    for (const g of ["Grande", "Mediana", "Chica"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(g) }),
      ).toHaveAttribute("aria-expanded", "true");
    }
    expect(filasVisibles()).toEqual([
      "Pierna entera",
      "Brazos",
      "Abdomen",
      "Axila",
    ]);
  });

  it("el contador de cada sección cuenta solo sus filas", () => {
    render(
      <ResourceManager {...base()} groups={GRUPOS} groupOf={(r) => r.cat} />,
    );

    expect(screen.getByRole("button", { name: /Grande/ })).toHaveTextContent(
      "(2)",
    );
    expect(screen.getByRole("button", { name: /Mediana/ })).toHaveTextContent(
      "(1)",
    );
    expect(screen.getByRole("button", { name: /Chica/ })).toHaveTextContent(
      "(1)",
    );
  });

  it("colapsar una sección esconde SOLO sus filas; volver a tocar las trae", async () => {
    const user = userEvent.setup();
    render(
      <ResourceManager {...base()} groups={GRUPOS} groupOf={(r) => r.cat} />,
    );

    await user.click(screen.getByRole("button", { name: /Grande/ }));

    expect(screen.getByRole("button", { name: /Grande/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // Las dos grandes se fueron; las otras dos siguen.
    expect(filasVisibles()).toEqual(["Abdomen", "Axila"]);

    await user.click(screen.getByRole("button", { name: /Grande/ }));
    expect(filasVisibles()).toEqual([
      "Pierna entera",
      "Brazos",
      "Abdomen",
      "Axila",
    ]);
  });

  it("una sección vacía se muestra igual, en 0", () => {
    render(
      <ResourceManager
        {...base({ rows: [FILAS[0]!] })}
        groups={GRUPOS}
        groupOf={(r) => r.cat}
      />,
    );

    expect(screen.getByRole("button", { name: /Mediana/ })).toHaveTextContent(
      "(0)",
    );
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

    expect(screen.getByRole("button", { name: /Grande/ })).toHaveTextContent(
      "(1)",
    );
    expect(filasVisibles()).toEqual(["Pierna entera"]);
  });
});

describe("ResourceManager — quién muestra el botón de eliminar definitivamente", () => {
  const CON_ARCHIVADAS: Fila[] = [
    { id: "1", nombre: "Pierna entera", cat: "grande" },
    { id: "2", nombre: "Brazos", cat: "grande", archivada: true },
  ];

  // La tabla ya filtra por el toggle: `showArchived` decide qué mitad se
  // dibuja. Por eso cada caso se prueba en las DOS vistas — un botón que
  // aparece "en todas las filas" aparece en una fila por vista, no en dos.
  const conBorrado = (
    canHardDelete: boolean | ((r: Fila) => boolean),
    showArchived: boolean,
  ) => ({
    ...base({ rows: CON_ARCHIVADAS, showArchived }),
    canHardDelete,
    onHardDeletePreview: vi.fn(async () => ({ blocked: false, cascade: {} })),
    onHardDelete: vi.fn(),
  });

  const botones = () => screen.queryAllByTitle("Eliminar definitivamente");

  it("sin la prop no aparece en ninguna vista", () => {
    render(<ResourceManager<Fila> {...base({ rows: CON_ARCHIVADAS })} />);
    expect(botones()).toHaveLength(0);
  });

  // Regresión: Servicios pasa un booleano y tiene que seguir mostrándolo tanto
  // sobre los activos como sobre los archivados.
  it("con `true` aparece en las dos vistas", () => {
    const { unmount } = render(
      <ResourceManager<Fila> {...conBorrado(true, false)} />,
    );
    expect(screen.getByText("Pierna entera")).toBeInTheDocument();
    expect(botones()).toHaveLength(1);
    unmount();

    render(<ResourceManager<Fila> {...conBorrado(true, true)} />);
    expect(screen.getByText("Brazos")).toBeInTheDocument();
    expect(botones()).toHaveLength(1);
  });

  it("con `false` no aparece en ninguna vista", () => {
    const { unmount } = render(
      <ResourceManager<Fila> {...conBorrado(false, false)} />,
    );
    expect(botones()).toHaveLength(0);
    unmount();

    render(<ResourceManager<Fila> {...conBorrado(false, true)} />);
    expect(botones()).toHaveLength(0);
  });

  // Lo que necesita Categorías: sólo del lado de archivados. Es la diferencia
  // que justifica que la prop acepte una función y no siga siendo un booleano.
  it("con una función decide fila por fila", () => {
    const soloArchivadas = (r: Fila) => Boolean(r.archivada);

    const { unmount } = render(
      <ResourceManager<Fila> {...conBorrado(soloArchivadas, false)} />,
    );
    expect(screen.getByText("Pierna entera")).toBeInTheDocument();
    expect(botones()).toHaveLength(0);
    unmount();

    render(<ResourceManager<Fila> {...conBorrado(soloArchivadas, true)} />);
    const filaArchivada = screen.getByText("Brazos").closest("tr")!;
    expect(
      within(filaArchivada).getByTitle("Eliminar definitivamente"),
    ).toBeInTheDocument();
  });

  it("una función que nunca da true se comporta igual que `false`", () => {
    render(<ResourceManager<Fila> {...conBorrado(() => false, true)} />);
    expect(botones()).toHaveLength(0);
  });
});

describe("ResourceManager — la tabla no esconde las acciones", () => {
  const DOS: Column<Fila>[] = [
    { key: "nombre", header: "Nombre", width: 200, render: (r) => r.nombre },
    { key: "cat", header: "Categoría", width: 300, render: (r) => r.cat },
  ];

  // El resize persiste el ancho en localStorage, así que sin esto un test le
  // deja los anchos puestos al siguiente.
  beforeEach(() => localStorage.clear());

  /** Los `<col>` del colgroup, que son los que fijan el ancho de cada columna. */
  function cols(container: HTMLElement) {
    return Array.from(container.querySelectorAll("col"));
  }

  // La celda de Acciones es la única con fondo propio (lo necesita: queda
  // flotando sobre las demás al scrollear). Si la caja de la tabla no fuera
  // blanca, ese blanco cortaría contra el crema de la página justo en el
  // borde de la columna fija — que es como se veía al principio.
  it("la caja de la tabla es blanca, igual que la celda fija de Acciones", () => {
    const { container } = render(
      <ResourceManager {...base({ columns: DOS })} onEdit={vi.fn()} />,
    );

    const caja = container.querySelector("table")!.parentElement!;
    expect(caja.className).toMatch(/\bbg-white\b/);

    const celda = screen
      .getByText("Pierna entera")
      .closest("tr")!
      .querySelector("td:last-child")!;
    expect(celda.className).toMatch(/\bbg-white\b/);
  });

  it("una fila archivada no le cambia el fondo a la celda fija", () => {
    render(
      <ResourceManager
        {...base({
          columns: DOS,
          rows: [{ id: "9", nombre: "Vieja", cat: "chica", archivada: true }],
          showArchived: true,
        })}
        onEdit={vi.fn()}
      />,
    );

    const celda = screen
      .getByText("Vieja")
      .closest("tr")!
      .querySelector("td:last-child")!;
    expect(celda.className).toMatch(/\bbg-white\b/);
    expect(celda.className).not.toMatch(/bg-surface-low(?!.*group-hover)/);
  });

  it("la columna de Acciones queda fija a la derecha, encabezado y celdas", () => {
    render(<ResourceManager {...base({ columns: DOS })} onEdit={vi.fn()} />);

    const encabezado = screen.getByRole("columnheader", { name: "Acciones" });
    expect(encabezado.className).toMatch(/\bsticky\b/);
    expect(encabezado.className).toMatch(/\bright-0\b/);

    const celda = screen
      .getByText("Pierna entera")
      .closest("tr")!
      .querySelector("td:last-child")!;
    expect(celda.className).toMatch(/\bsticky\b/);
    expect(celda.className).toMatch(/\bright-0\b/);
  });

  // El sobrante tiene que irse a una columna vacía. Si todas las columnas
  // declaran ancho, `table-layout: fixed` reparte el sobrante ENTRE TODAS y
  // mover una mueve las demás — que es el resizer elástico que sufría Laura.
  it("hay una columna colchón sin ancho declarado que se come el sobrante", () => {
    const { container } = render(
      <ResourceManager {...base({ columns: DOS })} onEdit={vi.fn()} />,
    );

    const anchos = cols(container).map((c) => c.style.width);
    expect(anchos).toEqual(["200px", "300px", "", "96px"]);
  });

  it("arrastrar una columna no toca el ancho de las demás", () => {
    const { container } = render(
      <ResourceManager {...base({ columns: DOS })} onEdit={vi.fn()} />,
    );

    const agarradera = screen
      .getByRole("columnheader", { name: "Nombre" })
      .querySelector("span[title]")!;
    fireEvent.pointerDown(agarradera, { clientX: 200 });
    fireEvent(window, new MouseEvent("pointermove", { clientX: 260 }));
    fireEvent(window, new MouseEvent("pointerup", {}));

    expect(cols(container).map((c) => c.style.width)).toEqual([
      "260px",
      "300px",
      "",
      "96px",
    ]);
  });

  it("ignora los anchos guardados con la clave vieja, que quedó descalibrada", () => {
    localStorage.setItem("rm-colwidths:Zonas", JSON.stringify({ nombre: 999 }));
    const { container } = render(
      <ResourceManager {...base({ columns: DOS })} onEdit={vi.fn()} />,
    );

    expect(cols(container)[0]!.style.width).toBe("200px");
  });
});
